from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import ensure_group_member, ensure_moderator, get_current_user
from app.db.session import get_db
from app.models import Group
from app.schemas import GroupCreate, GroupMemberAdd, GroupRead
from app.services.group_service import GroupService

router = APIRouter()


@router.post('', response_model=GroupRead)
def create_group(payload: GroupCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    service = GroupService(db)
    group = service.create_group(payload.name, payload.description, user.id)
    return GroupRead.model_validate(group)


@router.get('', response_model=list[GroupRead])
def list_groups(db: Session = Depends(get_db), user=Depends(get_current_user)):
    groups = GroupService(db).list_user_groups(user.id)
    return [GroupRead.model_validate(group) for group in groups]


@router.get('/catalog', response_model=list[GroupRead])
def catalog(db: Session = Depends(get_db), _=Depends(get_current_user)):
    groups = GroupService(db).list_all_groups()
    return [GroupRead.model_validate(group) for group in groups]


@router.post('/{group_id}/members')
def add_member(group_id: int, payload: GroupMemberAdd, db: Session = Depends(get_db), user=Depends(get_current_user)):
    ensure_moderator(group_id, user, db)
    try:
        GroupService(db).add_member(group_id, payload.user_id, payload.can_moderate)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {'message': 'Участник успешно добавлен в группу.'}


@router.post('/{group_id}/join')
def join_group(group_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    try:
        GroupService(db).join_group(group_id, user.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {'message': 'Вы успешно вступили в группу.'}


@router.get('/{group_id}', response_model=GroupRead)
def group_detail(group_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    ensure_group_member(group_id, user, db)
    group = db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail='Группа не найдена.')
    return GroupRead.model_validate(group)
