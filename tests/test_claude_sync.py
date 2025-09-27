import json
import sys
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

ROOT = Path(__file__).resolve().parents[1]
API_ROOT = ROOT / "apps" / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.db.base import Base
from app.models.projects import Project
from app.services.chat.conversation_summary import get_conversation_summaries
from app.services.claude.conversation_sync import ClaudeConversationSync


def _make_jsonl_line(**kwargs):
    return json.dumps(kwargs)


def setup_memory_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)


def test_sync_imports_jsonl(monkeypatch, tmp_path):
    session_factory = setup_memory_db()
    db: Session = session_factory()

    project_dir = tmp_path / "project"
    project_dir.mkdir(parents=True)

    # Create matching ~/.claude/projects/<slug>
    slug = "-" + str(project_dir.resolve()).lstrip("/").replace("/", "-")
    claude_projects = tmp_path / "home" / ".claude" / "projects" / slug
    claude_projects.mkdir(parents=True)

    jsonl_path = claude_projects / "abc123.jsonl"
    jsonl_lines = [
        _make_jsonl_line(
            type="user",
            sessionId="abc123",
            timestamp="2025-01-01T00:00:00Z",
            message={"role": "user", "content": "Hello Claude"},
        ),
        _make_jsonl_line(
            type="assistant",
            timestamp="2025-01-01T00:01:00Z",
            message={
                "role": "assistant",
                "content": [
                    {"type": "text", "text": "Hi there"},
                    {"type": "tool_use", "name": "Bash", "input": {"command": "ls"}},
                ],
                "model": "claude-sonnet-4",
            },
        ),
    ]
    jsonl_path.write_text("\n".join(jsonl_lines), encoding="utf-8")

    # Register project in DB
    project = Project(
        id="proj-1",
        name="Test Project",
        repo_path=str(project_dir),
    )
    db.add(project)
    db.commit()

    # Point syncer to our temp Claude directory
    monkeypatch.setattr(
        "app.services.claude.conversation_sync.CLAUDE_PROJECTS_ROOT",
        claude_projects.parent,
        raising=False,
    )

    syncer = ClaudeConversationSync(db)
    result = syncer.sync()
    assert result["synced"] == 1
    assert not result["errors"]

    messages = db.query(Project).filter_by(id="proj-1").first().messages
    assert len(messages) == 2
    assert messages[0].conversation_id == "abc123"
    assert messages[0].content

    summary = get_conversation_summaries(db)
    assert len(summary) == 1
    entry = summary[0]
    assert entry["conversation_id"] == "abc123"
    assert entry["summary"]
    assert entry["cli_type"] == "claude"
    assert entry["source"] == "claude_log"

    db.close()
