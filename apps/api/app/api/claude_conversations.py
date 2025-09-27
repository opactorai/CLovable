"""Claude CLI conversation synchronisation endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.messages import Message
from app.services.chat.conversation_summary import get_conversation_summaries
from app.services.claude.conversation_sync import ClaudeConversationSync

router = APIRouter()


@router.post("/claude-conversations/sync")
async def sync_claude_conversations(
    force: bool = Query(True, description="Re-import conversations even if they exist"),
    db: Session = Depends(get_db),
):
    """Trigger a sync of Claude CLI logs into the database."""
    syncer = ClaudeConversationSync(db)
    result = syncer.sync(force=force)
    return result


@router.get("/claude-conversations")
async def list_claude_conversations(db: Session = Depends(get_db)):
    """Return conversations grouped by project for legacy compatibility."""
    summaries = get_conversation_summaries(db)

    grouped: dict[str, dict] = {}
    for summary in summaries:
        project_id = summary["project_id"]
        project_group = grouped.setdefault(
            project_id,
            {
                "project_id": project_id,
                "project_name": summary.get("project_name"),
                "project_path": summary.get("project_path"),
                "conversations": [],
            },
        )
        project_group["conversations"].append(
            {
                "id": summary["conversation_id"],
                "summary": summary.get("summary"),
                "first_message": summary.get("first_message"),
                "timestamp": summary.get("last_message_at"),
                "cli_type": summary.get("cli_type"),
                "source": summary.get("source"),
            }
        )

    # Sort conversations within each project by timestamp desc
    for project_data in grouped.values():
        project_data["conversations"].sort(
            key=lambda item: item.get("timestamp") or "",
            reverse=True,
        )

    # Keep backwards-compatible shape (user = global projects list)
    return {
        "user": list(grouped.values()),
        "project": [],
    }


@router.get("/claude-conversations/{conversation_id}")
async def get_claude_conversation_detail(
    conversation_id: str,
    project_id: str | None = Query(None, description="Project ID owning the conversation"),
    db: Session = Depends(get_db),
):
    """Return the full transcript for a conversation sourced from the database."""
    query = db.query(Message).filter(Message.conversation_id == conversation_id)
    if project_id:
        query = query.filter(Message.project_id == project_id)

    messages = query.order_by(Message.created_at.asc()).all()
    if not messages:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return {
        "conversation_id": conversation_id,
        "project_id": messages[0].project_id,
        "messages": [
            {
                "id": message.id,
                "role": message.role,
                "content": message.content,
                "metadata_json": message.metadata_json,
                "created_at": message.created_at.isoformat() if message.created_at else None,
                "message_type": message.message_type,
                "cli_source": message.cli_source,
            }
            for message in messages
        ],
    }
