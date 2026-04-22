from fastapi import APIRouter, Depends, File as FastAPIFile, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import ensure_group_member, ensure_moderator, get_current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models import Group
from app.schemas import (
    GroupCreate,
    GroupMaterialCreateLink,
    GroupMaterialRead,
    GroupMemberAdd,
    GroupRead,
    SessionSummaryHistoryItem,
)
from app.services.group_service import GroupService
from app.services.material_service import MaterialService
from app.services.session_summary_service import SessionSummaryService

router = APIRouter()


def _material_read(material) -> GroupMaterialRead:
    return GroupMaterialRead(
        id=material.id,
        group_id=material.group_id,
        title=material.title,
        kind=material.kind,
        url=material.url,
        file_url=f'/files/{material.stored_name}' if material.stored_name else '',
        original_name=material.original_name,
        mime_type=material.mime_type,
        size_bytes=material.size_bytes,
        created_at=material.created_at,
    )


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


@router.get('/{group_id}/history', response_model=list[SessionSummaryHistoryItem])
def group_history(group_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    ensure_group_member(group_id, user, db)
    rows = SessionSummaryService(db).list_group_history(group_id)
    return [
        SessionSummaryHistoryItem(
            session_id=session.id,
            session_title=session.title,
            session_date=session.starts_at,
            summary_id=summary.id,
            summary_status=summary.status,
            short_description=summary.short_description,
            participants=[participant.full_name_snapshot for participant in summary.participants],
            tasks=[
                {
                    'task_id': task.task_id,
                    'title': task.title_snapshot,
                    'assignee_id': task.assignee_id,
                    'assignee_name': task.assignee_name_snapshot,
                    'deadline': task.deadline_snapshot,
                    'status_at_summary': task.status_at_summary,
                    'sort_order': task.sort_order,
                }
                for task in sorted(summary.tasks, key=lambda item: (item.sort_order, item.id))
            ],
            remind_at=summary.remind_at,
            updated_at=summary.updated_at,
        )
        for session, summary in rows
    ]


@router.get('/{group_id}/materials', response_model=list[GroupMaterialRead])
def list_group_materials(group_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    ensure_group_member(group_id, user, db)
    materials = MaterialService(db, get_settings().uploads_dir).list_group_materials(group_id)
    return [_material_read(item) for item in materials]


@router.post('/{group_id}/materials/link', response_model=GroupMaterialRead)
def add_group_material_link(
    group_id: int,
    payload: GroupMaterialCreateLink,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    ensure_group_member(group_id, user, db)
    material = MaterialService(db, get_settings().uploads_dir).create_link(group_id, user.id, payload.title, payload.url)
    return _material_read(material)


@router.post('/{group_id}/materials/upload', response_model=GroupMaterialRead)
async def upload_group_material(
    group_id: int,
    title: str = Form(...),
    file: UploadFile = FastAPIFile(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    ensure_group_member(group_id, user, db)
    if (file.content_type or '').lower() not in {'application/pdf', 'application/x-pdf'}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Можно загружать только PDF-файлы.')
    material = await MaterialService(db, get_settings().uploads_dir).upload_pdf(group_id, user.id, title, file)
    return _material_read(material)
