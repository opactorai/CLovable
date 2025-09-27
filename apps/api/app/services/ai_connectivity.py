from __future__ import annotations

from typing import Dict, Any, List, Optional

from pydantic import BaseModel

from app.services.token_service import get_token


class ProviderStatus(BaseModel):
    name: str
    configured: bool
    available: bool
    error: Optional[str] = None
    details: Dict[str, Any] = {}


async def check_openai(db) -> ProviderStatus:
    """Check OpenAI connectivity by listing models (no billable usage)."""
    provider = "openai"
    token = get_token(db, provider)
    if not token:
        return ProviderStatus(name=provider, configured=False, available=False)
    try:
        # Lazy import to avoid dependency if not used
        from openai import OpenAI  # type: ignore

        client = OpenAI(api_key=token)
        models = client.models.list()
        model_ids: List[str] = [m.id for m in getattr(models, "data", [])][:10]
        return ProviderStatus(
            name=provider,
            configured=True,
            available=True,
            details={"models": model_ids},
        )
    except Exception as e:
        return ProviderStatus(
            name=provider,
            configured=True,
            available=False,
            error=str(e),
        )


async def check_all_providers(db) -> Dict[str, Any]:
    """Check all supported AI providers and return a consolidated status."""
    results: List[ProviderStatus] = []

    # Extend with more providers as needed
    results.append(await check_openai(db))

    overall_available = any(r.available for r in results)
    overall_configured = any(r.configured for r in results)

    return {
        "overall": {
            "configured": overall_configured,
            "available": overall_available,
        },
        "providers": [r.model_dump() for r in results],
    }


async def openai_chat(db, messages: List[Dict[str, str]], model: Optional[str] = None) -> Dict[str, Any]:
    """Send a simple chat request to OpenAI and return assistant message text."""
    token = get_token(db, "openai")
    if not token:
        raise RuntimeError("OpenAI token not configured")

    try:
        from openai import OpenAI  # type: ignore

        client = OpenAI(api_key=token)
        selected_model = model or "gpt-4o-mini"
        resp = client.chat.completions.create(
            model=selected_model,
            messages=messages,
            temperature=0.3,
        )
        choice = resp.choices[0]
        content = getattr(choice.message, "content", "")
        return {
            "model": resp.model,
            "message": content,
            "usage": getattr(resp, "usage", None).model_dump() if getattr(resp, "usage", None) else None,
        }
    except Exception as e:
        raise RuntimeError(f"OpenAI chat failed: {e}")

