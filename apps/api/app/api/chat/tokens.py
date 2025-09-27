"""Token usage endpoints for conversations."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.services.token_tracker import token_tracker

router = APIRouter()


@router.get("/{conversation_id}/tokens")
async def get_conversation_tokens(conversation_id: str, db: Session = Depends(get_db)):
    """Get real token usage for a conversation"""
    totals = token_tracker.get_conversation_totals(conversation_id, db)
    context_size = token_tracker.get_real_context_size(conversation_id, db)

    return {
        "conversation_id": conversation_id,
        "input_tokens": totals["input_tokens"],
        "output_tokens": totals["output_tokens"],
        "total_tokens": totals["total_tokens"],
        "context_size": context_size,
        "total_cost": totals["total_cost"],
        "sessions": totals["session_count"]
    }