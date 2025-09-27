"""Utilities for syncing Claude CLI conversation logs into the database."""
from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable, List, Optional, Dict, Set, Tuple

from sqlalchemy.orm import Session

from app.models.messages import Message
from app.models.projects import Project
from app.models.sessions import Session as ChatSession

logger = logging.getLogger(__name__)

CLAUDE_ROOT = Path.home() / ".claude"
CLAUDE_PROJECTS_ROOT = CLAUDE_ROOT / "projects"


@dataclass
class ConversationFile:
    """Represents a Claude CLI JSONL transcript."""

    project: Project
    path: Path
    source: str  # "home" or "project"

    @property
    def conversation_id(self) -> str:
        return self.path.stem


@dataclass
class ParsedConversation:
    conversation_id: str
    session_id: Optional[str]
    messages: List[Message]
    first_user_message: Optional[str]
    last_assistant_message: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    model: Optional[str]
    cli_type: str = "claude"


class ClaudeConversationSync:
    """Synchronise Claude CLI transcripts into the application database."""

    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def sync(self, force: bool = True) -> dict:
        """Import Claude logs into the database.

        Args:
            force: When True, re-import conversations even if they already exist.

        Returns:
            Summary dictionary with counts and errors.
        """
        projects = self.db.query(Project).all()
        synced = 0
        errors: list[dict] = []

        for project in projects:
            try:
                conversation_files = list(self._discover_project_conversations(project))
            except Exception as exc:  # pragma: no cover - just in case discovery explodes
                logger.exception("Failed discovering conversations for %s", project.id)
                errors.append({
                    "project_id": project.id,
                    "error": str(exc),
                    "stage": "discover",
                })
                continue

            grouped: Dict[str, Tuple[ConversationFile, ParsedConversation, Set[str], Optional[datetime]]] = {}

            for conversation_file in conversation_files:
                try:
                    parsed = self._parse_conversation(conversation_file)
                except Exception as exc:  # pragma: no cover - resilient parsing
                    logger.exception("Failed parsing %s", conversation_file.path)
                    errors.append({
                        "project_id": project.id,
                        "conversation_id": conversation_file.conversation_id,
                        "path": str(conversation_file.path),
                        "error": str(exc),
                        "stage": "parse",
                    })
                    continue

                if not parsed.messages:
                    continue

                logical_id = parsed.session_id or conversation_file.conversation_id
                completed = parsed.completed_at or parsed.started_at
                if completed is None:
                    try:
                        completed = datetime.fromtimestamp(conversation_file.path.stat().st_mtime)
                    except OSError:
                        completed = None

                entry = grouped.get(logical_id)
                if entry is None:
                    grouped[logical_id] = (
                        conversation_file,
                        parsed,
                        {conversation_file.conversation_id},
                        completed,
                    )
                else:
                    existing_file, _existing_parsed, legacy_ids, existing_completed = grouped[logical_id]
                    legacy_ids.add(conversation_file.conversation_id)
                    replace = False
                    if completed and existing_completed:
                        replace = completed >= existing_completed
                    elif completed and not existing_completed:
                        replace = True
                    elif not existing_completed and not completed:
                        # Keep the latest file by modification time if timestamps missing
                        try:
                            replace = (
                                conversation_file.path.stat().st_mtime
                                >= existing_file.path.stat().st_mtime
                            )
                        except OSError:
                            replace = False
                    if replace:
                        grouped[logical_id] = (
                            conversation_file,
                            parsed,
                            legacy_ids,
                            completed,
                        )

            for logical_id, (conversation_file, parsed, legacy_ids, _completed) in grouped.items():
                try:
                    self._import_conversation(
                        conversation_file,
                        parsed,
                        legacy_ids,
                        force=force,
                    )
                    synced += 1
                except Exception as exc:  # pragma: no cover - resilient sync
                    logger.exception("Failed importing %s", conversation_file.path)
                    errors.append({
                        "project_id": project.id,
                        "conversation_id": logical_id,
                        "path": str(conversation_file.path),
                        "error": str(exc),
                        "stage": "import",
                    })

        self.db.commit()
        return {"synced": synced, "errors": errors}

    # ------------------------------------------------------------------
    # Discovery helpers
    # ------------------------------------------------------------------
    def _discover_project_conversations(self, project: Project) -> Iterable[ConversationFile]:
        repo_path = project.repo_path
        if not repo_path:
            return

        repo = Path(repo_path)

        # 1. Local project .claude/projects directory
        local_projects_dir = repo / ".claude" / "projects"
        if local_projects_dir.exists():
            for jsonl_path in local_projects_dir.rglob("*.jsonl"):
                yield ConversationFile(project=project, path=jsonl_path, source="project")

        # 2. Global ~/.claude/projects directory with slugified folder names
        if CLAUDE_PROJECTS_ROOT.exists():
            slug = self._slugify_path(repo)
            candidate = CLAUDE_PROJECTS_ROOT / slug
            if candidate.exists():
                for jsonl_path in candidate.rglob("*.jsonl"):
                    yield ConversationFile(project=project, path=jsonl_path, source="home")

    @staticmethod
    def _slugify_path(path: Path) -> str:
        # Claude CLI stores project folders as `-Users-jkneen-…`
        return "-" + str(path.resolve()).lstrip("/").replace("/", "-")

    # ------------------------------------------------------------------
    # Import helpers
    # ------------------------------------------------------------------
    def _import_conversation(
        self,
        convo_file: ConversationFile,
        parsed: ParsedConversation,
        legacy_ids: Iterable[str],
        force: bool,
    ) -> None:
        if not parsed.messages:
            logger.debug("Skipping empty transcript: %s", convo_file.path)
            return

        project = convo_file.project
        conversation_id = parsed.session_id or parsed.conversation_id

        self._remove_legacy_conversations(project.id, legacy_ids, conversation_id)

        session = (
            self.db.query(ChatSession)
            .filter(ChatSession.id == conversation_id, ChatSession.project_id == project.id)
            .one_or_none()
        )

        if session is None:
            session = ChatSession(
                id=conversation_id,
                project_id=project.id,
                cli_type=parsed.cli_type,
            )
            self.db.add(session)
        elif not force:
            return  # Nothing to do

        # Update session metadata
        session.instruction = parsed.first_user_message
        session.summary = parsed.last_assistant_message
        session.started_at = parsed.started_at or session.started_at
        session.completed_at = parsed.completed_at or session.completed_at
        session.model = parsed.model or session.model
        session.status = "completed"
        session.cli_type = parsed.cli_type
        session.transcript_path = str(convo_file.path)
        session.transcript_format = "jsonl"
        session.total_messages = len(parsed.messages)
        session.total_tools_used = sum(
            1
            for m in parsed.messages
            if m.metadata_json and m.metadata_json.get("message_type") == "tool_use"
        )
        metadata = getattr(parsed, "_metadata", {})
        session.total_tokens = metadata.get("total_tokens")
        session.duration_ms = self._calculate_duration(parsed)

        # Replace existing messages with fresh import
        self.db.query(Message).filter(
            Message.project_id == project.id,
            Message.conversation_id == conversation_id,
        ).delete(synchronize_session=False)

        for message in parsed.messages:
            # ensure message ids unique per import
            if not message.id:
                message.id = str(uuid.uuid4())
            message.project_id = project.id
            message.session_id = session.id
            message.conversation_id = conversation_id
            message.cli_source = parsed.cli_type
            self.db.add(message)

        # Update project activity timestamps
        if parsed.completed_at:
            if not project.last_active_at or project.last_active_at < parsed.completed_at:
                project.last_active_at = parsed.completed_at

    def _remove_legacy_conversations(
        self, project_id: str, legacy_ids: Iterable[str], keep_id: str
    ) -> None:
        ids_to_remove = {legacy_id for legacy_id in legacy_ids if legacy_id and legacy_id != keep_id}
        if not ids_to_remove:
            return

        self.db.query(Message).filter(
            Message.project_id == project_id,
            Message.conversation_id.in_(ids_to_remove),
        ).delete(synchronize_session=False)

        self.db.query(ChatSession).filter(
            ChatSession.project_id == project_id,
            ChatSession.id.in_(ids_to_remove),
        ).delete(synchronize_session=False)

    # ------------------------------------------------------------------
    def _parse_conversation(self, convo_file: ConversationFile) -> ParsedConversation:
        path = convo_file.path
        conversation_id = path.stem
        messages: List[Message] = []
        first_user: Optional[str] = None
        last_assistant: Optional[str] = None
        started_at: Optional[datetime] = None
        completed_at: Optional[datetime] = None
        session_id: Optional[str] = None
        model: Optional[str] = None
        total_tokens = 0

        with path.open("r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    payload = json.loads(line)
                except json.JSONDecodeError:
                    logger.debug("Skipping malformed JSONL line in %s", path)
                    continue

                msg_record = payload.get("message", {})
                role = msg_record.get("role") or payload.get("type") or "assistant"
                timestamp = self._parse_timestamp(payload.get("timestamp"))
                message_type = self._derive_message_type(msg_record)
                content = self._extract_content(msg_record)

                if role == "user" and first_user is None and content:
                    first_user = content
                if role == "assistant" and content:
                    last_assistant = content
                if msg_record.get("model") and model is None:
                    model = msg_record.get("model")
                if payload.get("sessionId"):
                    session_id = payload.get("sessionId")
                if timestamp:
                    started_at = started_at or timestamp
                    completed_at = timestamp

                usage = msg_record.get("usage")
                if usage:
                    total_tokens += usage.get("input_tokens", 0) + usage.get("output_tokens", 0)

                metadata = {
                    "source": "claude_log",
                    "message_type": message_type,
                    "raw": payload,
                }

                message = Message(
                    id=str(uuid.uuid4()),
                    project_id=convo_file.project.id,
                    role=role,
                    message_type=message_type,
                    content=content or "",
                    metadata_json=metadata,
                    parent_message_id=None,
                    session_id=None,
                    conversation_id=conversation_id,
                    cli_source="claude",
                    created_at=timestamp or datetime.utcnow(),
                )
                messages.append(message)

        parsed = ParsedConversation(
            conversation_id=conversation_id,
            session_id=session_id,
            messages=messages,
            first_user_message=first_user,
            last_assistant_message=last_assistant,
            started_at=started_at,
            completed_at=completed_at,
            model=model,
        )
        # Attach metadata for duration/token calculations without polluting dataclass signature
        parsed._metadata = {"total_tokens": total_tokens}  # type: ignore[attr-defined]
        return parsed

    @staticmethod
    def _derive_message_type(msg_record: dict) -> str:
        content = msg_record.get("content")
        if isinstance(content, list):
            for item in content:
                item_type = item.get("type") if isinstance(item, dict) else None
                if item_type == "tool_use":
                    return "tool_use"
                if item_type == "tool_result":
                    return "tool_result"
        return msg_record.get("type") or "chat"

    @staticmethod
    def _extract_content(msg_record: dict) -> str:
        content = msg_record.get("content")
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts: List[str] = []
            for item in content:
                if not isinstance(item, dict):
                    continue
                item_type = item.get("type")
                if item_type == "text":
                    parts.append(item.get("text", ""))
                elif item_type == "tool_use":
                    tool_name = item.get("name", "tool")
                    tool_input = item.get("input")
                    parts.append(f"[tool_use:{tool_name}] {json.dumps(tool_input, ensure_ascii=False)}")
                elif item_type == "tool_result":
                    tool_id = item.get("tool_use_id") or "tool"
                    tool_content = item.get("content")
                    parts.append(f"[tool_result:{tool_id}] {json.dumps(tool_content, ensure_ascii=False)}")
                else:
                    parts.append(json.dumps(item, ensure_ascii=False))
            return "\n".join(part for part in parts if part).strip()
        if content is None:
            return ""
        return json.dumps(content, ensure_ascii=False)

    @staticmethod
    def _parse_timestamp(value: Optional[str]) -> Optional[datetime]:
        if not value:
            return None
        try:
            if value.endswith("Z"):
                return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
            return datetime.fromisoformat(value)
        except ValueError:
            return None

    @staticmethod
    def _calculate_duration(parsed: ParsedConversation) -> Optional[int]:
        if parsed.started_at and parsed.completed_at:
            delta = parsed.completed_at - parsed.started_at
            return int(delta.total_seconds() * 1000)
        return None


__all__ = ["ClaudeConversationSync"]
