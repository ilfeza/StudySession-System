from fastapi import APIRouter, Depends, File as FastAPIFile, HTTPException, UploadFile
from sqlalchemy.orm import Session
from pathlib import Path
from uuid import uuid4

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models import Task
from app.schemas import UserProfileUpdate, UserProgressRead, UserSessionHistoryItem, UserRead
from app.services.user_profile_service import UserProfileService

router = APIRouter()


def _normalize_skills(skills: list[str] | None) -> str | None:
    if skills is None:
        return None
    return ','.join(sorted({skill.strip().lower() for skill in skills if skill.strip()}))


@router.get('/me/progress', response_model=UserProgressRead)
def my_progress(db: Session = Depends(get_db), user=Depends(get_current_user)):
    stats = UserProfileService(db).progress(user.id)
    return UserProgressRead(
        user_id=user.id,
        full_name=user.full_name,
        email=user.email,
        **stats,
    )


@router.get('/me/history', response_model=list[UserSessionHistoryItem])
def my_history(db: Session = Depends(get_db), user=Depends(get_current_user)):
    service = UserProfileService(db)
    sessions = service.session_history(user.id)
    summary_by_session = service.summary_map([session.id for session in sessions])

    return [
        UserSessionHistoryItem(
            session_id=session.id,
            group_id=session.group_id,
            group_name=session.group.name if session.group else 'Комната',
            session_title=session.title,
            template_key=session.template_key,
            session_date=session.starts_at,
            participants=[participant.user.full_name for participant in session.participants if participant.user],
            tasks_total=db.query(Task).filter(Task.session_id == session.id).count(),
            tasks_completed=db.query(Task).filter(Task.session_id == session.id, Task.is_completed.is_(True)).count(),
            short_description=(summary_by_session.get(session.id).short_description if summary_by_session.get(session.id) else ''),
        )
        for session in sessions
    ]


@router.patch('/me', response_model=UserRead)
def update_me(payload: UserProfileUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.email is not None:
        user.email = payload.email
    if payload.skills is not None:
        normalized = _normalize_skills(payload.skills)
        user.skills = normalized or ''
    db.commit()
    db.refresh(user)
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


@router.post('/me/avatar', response_model=UserRead)
async def upload_avatar(
    file: UploadFile = FastAPIFile(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail='Можно загрузить только изображение.')

    extension = Path(file.filename or 'avatar.png').suffix.lower() or '.png'
    if extension not in {'.png', '.jpg', '.jpeg', '.webp', '.gif'}:
        raise HTTPException(status_code=400, detail='Неподдерживаемый формат изображения.')

    upload_dir = Path(get_settings().uploads_dir) / 'avatars'
    upload_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f'{user.id}_{uuid4().hex}{extension}'
    target = upload_dir / stored_name
    content = await file.read()
    target.write_bytes(content)

    user.avatar_url = f'/files/avatars/{stored_name}'
    db.commit()
    db.refresh(user)
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
