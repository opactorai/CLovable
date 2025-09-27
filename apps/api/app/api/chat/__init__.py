"""
Chat API Router
Combines all chat-related endpoints
"""
from fastapi import APIRouter

from .websocket import router as websocket_router
from .messages import router as messages_router
from .act import router as act_router
from .cli_preferences import router as cli_router
from .conversations import router as conversations_router


# Create main chat router (prefix will be added in main.py)
router = APIRouter()

# Include sub-routers
router.include_router(websocket_router, tags=["chat"])
router.include_router(messages_router, tags=["chat"])
router.include_router(act_router, tags=["chat"])
router.include_router(cli_router, tags=["chat"])
router.include_router(conversations_router, tags=["chat"])
