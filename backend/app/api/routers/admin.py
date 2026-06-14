from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_roles
from app.db.session import get_db
from app.models import Friendship, Group, GroupMember, User, UserRole, VideoSession, Task
from app.schemas import (
    AdminAnalyticsOverview,
    AdminGroupMemberUpdate,
    AdminGroupRead,
    AdminGroupUpdate,
    AdminUserCreate,
    AdminUserUpdate,
    UserDirectoryRead,
    UserRead,
)
from app.services.auth_service import AuthService
from app.repositories.user_repository import UserRepository

router = APIRouter()


def _user_read(user: User) -> UserRead:
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


def _directory_user(user: User) -> UserDirectoryRead:
    return UserDirectoryRead(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_online=False,
        current_status='Нет активной сессии',
        is_active=user.is_active,
        avatar_url=user.avatar_url or '',
    )


def _group_read(db: Session, group: Group) -> AdminGroupRead:
    active_sessions = db.query(VideoSession).filter(VideoSession.group_id == group.id, VideoSession.is_active.is_(True)).count()
    members = [
        {
            'user_id': member.user_id,
            'full_name': member.user.full_name,
            'email': member.user.email,
            'role': member.user.role,
            'can_moderate': member.can_moderate,
            'joined_at': member.joined_at,
        }
        for member in sorted(group.members, key=lambda item: item.joined_at)
        if member.user
    ]
    return AdminGroupRead(
        id=group.id,
        name=group.name,
        description=group.description,
        visibility=group.visibility,
        invite_key=group.invite_key,
        owner_id=group.owner_id,
        owner_name=group.owner.full_name if group.owner else 'Неизвестно',
        member_count=len(members),
        active_sessions=active_sessions,
        created_at=group.created_at,
        members=members,
    )


@router.get('/analytics', response_model=AdminAnalyticsOverview)
def analytics_overview(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin, UserRole.analyst)),
):
    role_distribution = {
        role.value: db.query(User).filter(User.role == role).count()
        for role in UserRole
    }
    top_groups_query = (
        db.query(Group, func.count(GroupMember.id).label('member_count'))
        .outerjoin(GroupMember, GroupMember.group_id == Group.id)
        .group_by(Group.id)
        .order_by(func.count(GroupMember.id).desc(), Group.created_at.desc())
        .limit(5)
        .all()
    )
    recent_users = db.query(User).order_by(User.created_at.desc()).limit(5).all()
    return AdminAnalyticsOverview(
        total_users=db.query(User).count(),
        active_users=db.query(User).filter(User.is_active.is_(True)).count(),
        total_groups=db.query(Group).count(),
        private_groups=db.query(Group).filter(Group.visibility == 'private').count(),
        total_friendships=db.query(Friendship).count(),
        active_sessions=db.query(VideoSession).filter(VideoSession.is_active.is_(True)).count(),
        completed_tasks=db.query(Task).filter(Task.is_completed.is_(True)).count(),
        pending_tasks=db.query(Task).filter(Task.is_completed.is_(False)).count(),
        role_distribution=role_distribution,
        top_groups=[
            {'id': group.id, 'name': group.name, 'member_count': int(member_count or 0)}
            for group, member_count in top_groups_query
        ],
        recent_users=[_directory_user(item) for item in recent_users],
    )


@router.get('/users', response_model=list[UserRead])
def list_users(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin)),
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [_user_read(item) for item in users]


@router.post('/users', response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: AdminUserCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin)),
):
    if payload.role == UserRole.admin:
        raise HTTPException(status_code=400, detail='Создание новых администраторов через интерфейс отключено.')
    service = AuthService(UserRepository(db))
    created = service.register(payload.email, payload.full_name, payload.password, payload.role, payload.skills)
    created.is_active = payload.is_active
    db.commit()
    db.refresh(created)
    return _user_read(created)


@router.patch('/users/{user_id}', response_model=UserRead)
def update_user(
    user_id: int,
    payload: AdminUserUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin)),
):
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail='Пользователь не найден.')
    if payload.role == UserRole.admin and target.email != 'admin':
        raise HTTPException(status_code=400, detail='Назначение новых администраторов отключено.')
    if payload.full_name is not None:
        target.full_name = payload.full_name
    if payload.role is not None:
        target.role = payload.role
    if payload.is_active is not None:
        target.is_active = payload.is_active
    if payload.workload_limit is not None:
        target.workload_limit = payload.workload_limit
    if payload.reliability_score is not None:
        target.reliability_score = payload.reliability_score
    if payload.skills is not None:
        target.skills = ','.join(sorted({skill.strip().lower() for skill in payload.skills if skill.strip()}))
    db.commit()
    db.refresh(target)
    return _user_read(target)


@router.get('/groups', response_model=list[AdminGroupRead])
def list_groups(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin, UserRole.analyst)),
):
    groups = (
        db.query(Group)
        .options(
            joinedload(Group.owner),
            joinedload(Group.members).joinedload(GroupMember.user),
        )
        .order_by(Group.created_at.desc())
        .all()
    )
    return [_group_read(db, group) for group in groups]


@router.patch('/groups/{group_id}', response_model=AdminGroupRead)
def update_group(
    group_id: int,
    payload: AdminGroupUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin)),
):
    group = (
        db.query(Group)
        .options(joinedload(Group.owner), joinedload(Group.members).joinedload(GroupMember.user))
        .filter(Group.id == group_id)
        .first()
    )
    if not group:
        raise HTTPException(status_code=404, detail='Группа не найдена.')
    if payload.name is not None:
        group.name = payload.name
    if payload.description is not None:
        group.description = payload.description
    if payload.visibility is not None:
        group.visibility = payload.visibility
    db.commit()
    db.refresh(group)
    return _group_read(db, group)


@router.patch('/groups/{group_id}/members/{member_user_id}', response_model=AdminGroupRead)
def update_group_member(
    group_id: int,
    member_user_id: int,
    payload: AdminGroupMemberUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin)),
):
    group = (
        db.query(Group)
        .options(joinedload(Group.owner), joinedload(Group.members).joinedload(GroupMember.user))
        .filter(Group.id == group_id)
        .first()
    )
    if not group:
        raise HTTPException(status_code=404, detail='Группа не найдена.')
    membership = next((item for item in group.members if item.user_id == member_user_id), None)
    if not membership:
        raise HTTPException(status_code=404, detail='Участник группы не найден.')
    membership.can_moderate = payload.can_moderate
    db.commit()
    db.refresh(group)
    return _group_read(db, group)


@router.delete('/groups/{group_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin)),
):
    group = db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail='Группа не найдена.')
    db.delete(group)
    db.commit()
