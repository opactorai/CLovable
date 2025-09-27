"""Conversation summary endpoints for chat sidebar."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.sessions import Session as ChatSession
from app.models.messages import Message as MessageModel
from app.services.chat.conversation_summary import get_conversation_summaries

router = APIRouter()


class ConversationPinUpdate(BaseModel):
    pinned: bool


@router.get("/conversations")
async def list_conversations(search: str = None, db: Session = Depends(get_db)):
    """Return unified conversation summaries for all projects with optional full-text search."""
    summaries = get_conversation_summaries(db)

    if not search:
        return summaries

    search_lower = search.lower()
    filtered = []

    for summary in summaries:
        if (summary.get('summary') and search_lower in summary.get('summary', '').lower()) or \
           (summary.get('first_message') and search_lower in summary.get('first_message', '').lower()) or \
           (summary.get('project_name') and search_lower in summary.get('project_name', '').lower()):
            filtered.append(summary)
            continue

        messages = db.query(MessageModel).filter(
            MessageModel.project_id == summary.get('project_id'),
            MessageModel.conversation_id == summary.get('conversation_id')
        ).all()

        for msg in messages:
            if msg.content and search_lower in msg.content.lower():
                filtered.append(summary)
                break

    return filtered


@router.patch("/conversations/{conversation_id}/pin")
async def update_conversation_pin(
    conversation_id: str,
    body: ConversationPinUpdate,
    db: Session = Depends(get_db),
):
    session = db.query(ChatSession).filter(ChatSession.id == conversation_id).one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    session.pinned = bool(body.pinned)
    db.add(session)
    db.commit()

    return {"conversation_id": conversation_id, "pinned": session.pinned}


__all__ = ["router"]
