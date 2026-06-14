from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import get_db
from app.models import Group, GroupMember, User, UserRole, VideoSession

oauth2_scheme = OAuth2PasswordBearer(tokenUrl='/api/auth/login')


def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    try:
        user_id = int(decode_token(token))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Требуется повторный вход.') from exc

    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Пользователь не найден или заблокирован.')
    return user


def require_roles(*roles: UserRole):
    def validator(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Недостаточно прав доступа.')
        return user

    return validator


def ensure_group_member(group_id: int, user: User, db: Session) -> None:
    if user.role == UserRole.admin:
        return

    group = db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Группа не найдена.')

    is_owner = group.owner_id == user.id
    membership = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == user.id,
    ).first()

    if not is_owner and not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Вы не состоите в этой группе.')


def ensure_moderator(group_id: int, user: User, db: Session) -> None:
    if user.role == UserRole.admin:
        return

    group = db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Группа не найдена.')

    if group.owner_id == user.id:
        return

    membership = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == user.id,
        GroupMember.can_moderate.is_(True),
    ).first()

    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Нужны права модератора.')


def get_session_or_404(session_id: int, db: Session) -> VideoSession:
    session = db.get(VideoSession, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Сессия не найдена.')
    return session


def ensure_session_member(session_id: int, user: User, db: Session) -> VideoSession:
    session = get_session_or_404(session_id, db)
    ensure_group_member(session.group_id, user, db)
    return session


def can_control_session_stage(session: VideoSession, user: User, db: Session) -> bool:
    if user.role == UserRole.admin or session.created_by_id == user.id:
        return True

    group = db.get(Group, session.group_id)
    if group and group.owner_id == user.id:
        return True

    membership = (
        db.query(GroupMember)
        .filter(
            GroupMember.group_id == session.group_id,
            GroupMember.user_id == user.id,
            GroupMember.can_moderate.is_(True),
        )
        .first()
    )
    return membership is not None


def ensure_session_moderator(session_id: int, user: User, db: Session) -> VideoSession:
    session = get_session_or_404(session_id, db)

    if not can_control_session_stage(session, user, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Нужны права модератора.')

    return session
