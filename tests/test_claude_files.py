import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
API_ROOT = ROOT / "apps" / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.api.claude_files import RESOURCE_DIRS, router as claude_files_router  # noqa: E402


def create_client():
    app = FastAPI()
    app.include_router(claude_files_router, prefix="/api")
    return TestClient(app)


def test_list_and_update_agents(monkeypatch, tmp_path):
    agents_dir = tmp_path / "agents"
    commands_dir = tmp_path / "commands"
    agents_dir.mkdir(parents=True)
    commands_dir.mkdir(parents=True)

    agent_file = agents_dir / "example.agent.md"
    agent_file.write_text("Hello agent", encoding="utf-8")
    command_file = commands_dir / "deploy.md"
    command_file.write_text("Run deploy", encoding="utf-8")

    monkeypatch.setitem(RESOURCE_DIRS, "agents", agents_dir)
    monkeypatch.setitem(RESOURCE_DIRS, "commands", commands_dir)

    client = create_client()

    # List agents
    resp = client.get("/api/claude/agents")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["name"] == "example.agent.md"

    # Read single agent
    resp = client.get("/api/claude/agents/example.agent.md")
    assert resp.status_code == 200
    assert resp.json()["content"] == "Hello agent"

    # Update agent content
    resp = client.put(
        "/api/claude/agents/example.agent.md",
        json={"content": "Updated agent"},
    )
    assert resp.status_code == 200
    assert agent_file.read_text(encoding="utf-8") == "Updated agent"

    # Commands listing works too
    resp = client.get("/api/claude/commands")
    assert resp.status_code == 200
    assert resp.json()[0]["name"] == "deploy.md"
