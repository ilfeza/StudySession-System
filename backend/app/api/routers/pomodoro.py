from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import GroupMember, User, UserRole, VideoSession
from app.services.pomodoro_service import PomodoroService

router = APIRouter()


def _ensure_session_member(session_id: int, user: User, db: Session) -> None:
    session = db.get(VideoSession, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Сессия не найдена.')

    if user.role == UserRole.admin or session.created_by_id == user.id:
        return

    membership = (
        db.query(GroupMember)
        .filter(GroupMember.group_id == session.group_id, GroupMember.user_id == user.id)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Недостаточно прав для этой сессии.')


@router.get('/{session_id}/pomodoro')
def get_pomodoro_state(session_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _ensure_session_member(session_id, user, db)
    state = PomodoroService(db).get_or_create(session_id)
    return PomodoroService(db).build_snapshot(state)

