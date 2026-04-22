from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Task
from app.schemas import UserProgressRead, UserSessionHistoryItem
from app.services.user_profile_service import UserProfileService

router = APIRouter()


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
