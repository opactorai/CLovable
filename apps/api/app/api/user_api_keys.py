from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import List
import uuid

from app.db.session import get_db
from app.models.user_api_keys import UserApiKey
from app.models.users import User
from app.core.crypto import aesgcm_box


router = APIRouter(prefix="/api/v1/user/api-keys", tags=["user-api-keys"])


# Placeholder auth dependency: in real setup, replace with proper auth (e.g., Supabase/JWT)
def get_current_user(db: Session = Depends(get_db)) -> User:
    user = db.query(User).first()
    if not user:
        # Create a demo user for local development
        demo = User(id=str(uuid.uuid4()), email="demo@example.com", name="Demo")
        db.add(demo)
        db.commit()
        db.refresh(demo)
        return demo
    return user


class ApiKeyCreate(BaseModel):
    service_name: str = Field(min_length=2, max_length=50)
    api_key: str = Field(min_length=8)


class ApiKeyResponse(BaseModel):
    id: str
    service_name: str
    created_at: str

    class Config:
        from_attributes = True


@router.post("", response_model=ApiKeyResponse)
def create_api_key(payload: ApiKeyCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    encrypted = aesgcm_box.encrypt(payload.api_key)
    record = UserApiKey(
        id=str(uuid.uuid4()),
        user_id=user.id,
        service_name=payload.service_name.lower().strip(),
        api_key_encrypted=encrypted,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return ApiKeyResponse(id=record.id, service_name=record.service_name, created_at=str(record.created_at))


@router.get("", response_model=List[ApiKeyResponse])
def list_api_keys(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    items = (
        db.query(UserApiKey)
        .filter(UserApiKey.user_id == user.id)
        .order_by(UserApiKey.created_at.desc())
        .all()
    )
    return [ApiKeyResponse(id=i.id, service_name=i.service_name, created_at=str(i.created_at)) for i in items]


class ApiKeyUpdate(BaseModel):
    api_key: str = Field(min_length=8)


@router.put("/{key_id}", response_model=ApiKeyResponse)
def update_api_key(key_id: str, payload: ApiKeyUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rec = db.query(UserApiKey).filter(UserApiKey.id == key_id, UserApiKey.user_id == user.id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Not found")
    rec.api_key_encrypted = aesgcm_box.encrypt(payload.api_key)
    db.commit()
    db.refresh(rec)
    return ApiKeyResponse(id=rec.id, service_name=rec.service_name, created_at=str(rec.created_at))


@router.delete("/{key_id}")
def delete_api_key(key_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rec = db.query(UserApiKey).filter(UserApiKey.id == key_id, UserApiKey.user_id == user.id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(rec)
    db.commit()
    return {"ok": True}

