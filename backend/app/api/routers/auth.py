from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.repositories.user_repository import UserRepository
from app.schemas import TokenResponse, UserCreate, UserLogin, UserRead
from app.services.auth_service import AuthService

router = APIRouter()


def _user_read(user) -> UserRead:
    return UserRead(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        skills=[skill for skill in user.skills.split(',') if skill],
        reliability_score=user.reliability_score,
        workload_limit=user.workload_limit,
        is_active=user.is_active,
        avatar_url=user.avatar_url or '',
    )


@router.post('/register', response_model=UserRead)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    service = AuthService(UserRepository(db))
    try:
        user = service.register(payload.email, payload.full_name, payload.password, payload.role, payload.skills)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return _user_read(user)


@router.post('/login', response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    service = AuthService(UserRepository(db))
    try:
        token = service.login(payload.email, payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    return TokenResponse(access_token=token)


@router.get('/me', response_model=UserRead)
def me(user=Depends(get_current_user)):
    return _user_read(user)
