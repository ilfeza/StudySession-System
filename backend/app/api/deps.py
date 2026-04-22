from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import get_db
from app.models import Group, GroupMember, User, UserRole

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
