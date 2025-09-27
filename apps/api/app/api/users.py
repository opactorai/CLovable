from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.users import User
import uuid


router = APIRouter(prefix="/api/users", tags=["users"])


class CreateUserRequest(BaseModel):
    email: EmailStr
    name: str | None = None
    user_id: str | None = None


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    name: str | None

    class Config:
        from_attributes = True


@router.post("", response_model=UserResponse)
def create_user(payload: CreateUserRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    user_id = payload.user_id or str(uuid.uuid4())
    user = User(id=user_id, email=str(payload.email), name=payload.name)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

