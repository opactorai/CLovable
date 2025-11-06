"""Shared helpers for building conversation summaries."""
from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime
from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.messages import Message
from app.models.projects import Project
from app.models.sessions import Session as ChatSession


@dataclass
class ConversationSummary:
    project_id: str
    project_name: str
    project_path: Optional[str]
    conversation_id: str
    summary: str
    first_message: Optional[str]
    last_message_at: Optional[datetime]
    cli_type: Optional[str]
    source: Optional[str]
    pinned: bool = False

    def as_dict(self) -> dict:
        data = asdict(self)
        if self.last_message_at:
            data["last_message_at"] = self.last_message_at.isoformat()
        return data


def get_conversation_summaries(db: Session) -> List[dict]:
    """Return a list of conversation summaries grouped by project."""
    base_rows = (
        db.query(
            Message.project_id,
            Message.conversation_id,
            func.min(Message.created_at).label("first_at"),
            func.max(Message.created_at).label("last_at"),
        )
        .filter(Message.conversation_id.isnot(None))
        .group_by(Message.project_id, Message.conversation_id)
        .all()
    )

    if not base_rows:
        return []

    project_ids = {row.project_id for row in base_rows}
    conversation_ids = {row.conversation_id for row in base_rows if row.conversation_id}

    projects = {
        project.id: project
        for project in db.query(Project).filter(Project.id.in_(project_ids)).all()
    }

    sessions = {
        (session.project_id, session.id): session
        for session in (
            db.query(ChatSession)
            .filter(ChatSession.project_id.in_(project_ids))
            .filter(ChatSession.id.in_(conversation_ids))
            .all()
        )
    }

    message_rows = (
        db.query(
            Message.project_id,
            Message.conversation_id,
            Message.role,
            Message.content,
            Message.cli_source,
            Message.created_at,
            Message.message_type,
        )
        .filter(Message.project_id.in_(project_ids))
        .filter(Message.conversation_id.in_(conversation_ids))
        .order_by(Message.project_id, Message.conversation_id, Message.created_at)
        .all()
    )

    first_user = {}
    last_assistant = {}
    cli_sources = {}

    for row in message_rows:
        key = (row.project_id, row.conversation_id)
        if row.role == "user" and key not in first_user:
            first_user[key] = row
        if row.role == "assistant":
            last_assistant[key] = row
        if getattr(row, "cli_source", None) and key not in cli_sources:
            cli_sources[key] = row.cli_source

    summaries: List[ConversationSummary] = []
    for base in base_rows:
        project = projects.get(base.project_id)
        if not project or not base.conversation_id:
            continue

        key = (base.project_id, base.conversation_id)
        session = sessions.get(key)
        first_user_msg = first_user.get(key)
        last_assistant_msg = last_assistant.get(key)

        summary_text = (
            (session.summary if session and session.summary else None)
            or (last_assistant_msg.content if last_assistant_msg else None)
            or (first_user_msg.content if first_user_msg else "")
        )

        cli_type = None
        if session and session.cli_type:
            cli_type = session.cli_type
        elif cli_sources.get(key):
            cli_type = cli_sources[key]

        source = None
        if session:
            if session.transcript_format == "jsonl" or (
                session.transcript_path and session.transcript_path.endswith(".jsonl")
            ):
                source = "claude_log"
            else:
                source = "database"

        pinned = bool(session.pinned) if session else False

        summaries.append(
            ConversationSummary(
                project_id=project.id,
                project_name=project.name,
                project_path=project.repo_path,
                conversation_id=base.conversation_id,
                summary=summary_text or "",
                first_message=first_user_msg.content if first_user_msg else None,
                last_message_at=base.last_at,
                cli_type=cli_type,
                source=source,
                pinned=pinned,
            )
        )

    summaries.sort(key=lambda item: item.last_message_at or datetime.min, reverse=True)
    return [summary.as_dict() for summary in summaries]


__all__ = ["get_conversation_summaries", "ConversationSummary"]
