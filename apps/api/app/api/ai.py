from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from app.api.deps import get_db
from app.services.ai_connectivity import check_all_providers, openai_chat


router = APIRouter(prefix="/api/ai", tags=["ai"]) 


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = None


@router.get("/status")
async def ai_status(db = Depends(get_db)):
    return await check_all_providers(db)


@router.post("/chat")
async def ai_chat(body: ChatRequest, db = Depends(get_db)):
    try:
        result = await openai_chat(db, [m.model_dump() for m in body.messages], model=body.model)
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))

