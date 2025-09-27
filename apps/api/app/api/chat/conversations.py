"""Conversation summary endpoints for chat sidebar."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.sessions import Session as ChatSession
from app.services.chat.conversation_summary import get_conversation_summaries

router = APIRouter()


class ConversationPinUpdate(BaseModel):
    pinned: bool


@router.get("/conversations")
async def list_conversations(db: Session = Depends(get_db)):
    """Return unified conversation summaries for all projects."""
    return get_conversation_summaries(db)


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
