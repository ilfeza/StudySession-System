from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import can_control_session_stage, ensure_group_member, ensure_session_member, get_current_user, get_session_or_404
from app.db.session import get_db
from app.models import Group, GroupMember, SessionSummary, UserRole, VideoSession, SessionParticipant, SessionTaskStatus, Task, User
from app.schemas import (
    LivekitTokenResponse,
    SessionParticipantRead,
    SessionSummaryRead,
    SessionSummarySkip,
    SessionSummaryUpsert,
    VideoSessionCreate,
    VideoSessionRead,
    VideoSessionRoomRead,
)
from app.services.session_service import SessionService
from app.services.session_dashboard_service import SessionDashboardService
from app.services.session_summary_service import SessionSummaryService

router = APIRouter()


def _summary_read(summary: SessionSummary) -> SessionSummaryRead:
    return SessionSummaryRead(
        id=summary.id,
        session_id=summary.session_id,
        group_id=summary.group_id,
        created_by_id=summary.created_by_id,
        updated_by_id=summary.updated_by_id,
        completed_work=summary.completed_work,
        next_steps=summary.next_steps,
        short_description=summary.short_description,
        completion_summary=summary.completion_summary,
        contribution_summary=summary.contribution_summary,
        bottleneck_summary=summary.bottleneck_summary,
        collaboration_summary=summary.collaboration_summary,
        status=summary.status,
        remind_at=summary.remind_at,
        participants=[
            {
                'user_id': participant.user_id,
                'full_name': participant.full_name_snapshot,
                'role_in_session': participant.role_in_session,
            }
            for participant in summary.participants
        ],
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
        created_at=summary.created_at,
        updated_at=summary.updated_at,
    )


@router.post('', response_model=VideoSessionRead)
def create_session(payload: VideoSessionCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    ensure_group_member(payload.group_id, user, db)
    service = SessionService(db)
    session = service.create_session(
        payload.group_id,
        payload.title,
        payload.description,
        payload.starts_at or datetime.utcnow(),
        user.id,
        payload.template_key,
    )
    return VideoSessionRead.model_validate(session)


@router.get('/group/{group_id}', response_model=list[VideoSessionRead])
def list_group_sessions(group_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    ensure_group_member(group_id, user, db)
    sessions = SessionService(db).list_group_sessions(group_id)
    return [VideoSessionRead.model_validate(item) for item in sessions]


@router.delete('/{session_id}')
def delete_session(session_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    session = get_session_or_404(session_id, db)
    group = db.get(Group, session.group_id)
    if not group:
        raise HTTPException(status_code=404, detail='Группа не найдена.')
    if group.owner_id != user.id and user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail='Удалять сессии может только создатель группы.')
    try:
        SessionService(db).delete_session(session_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {'message': 'Сессия удалена.'}


@router.get('/{session_id}', response_model=VideoSessionRoomRead)
def session_detail(session_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    session = ensure_session_member(session_id, user, db)
    group = db.get(Group, session.group_id)
    return VideoSessionRoomRead(
        id=session.id,
        group_id=session.group_id,
        group_name=group.name if group else 'Комната',
        title=session.title,
        description=session.description,
        template_key=session.template_key,
        starts_at=session.starts_at,
        ends_at=session.ends_at,
        is_active=session.is_active,
        livekit_room=session.livekit_room,
        created_by_id=session.created_by_id,
    )


@router.get('/{session_id}/token', response_model=LivekitTokenResponse)
def livekit_token(session_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    session = db.get(VideoSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail='Сессия не найдена.')

    ensure_group_member(session.group_id, user, db)
    service = SessionService(db)
    token = service.create_livekit_token(session.livekit_room, user.id, user.full_name)
    service.touch_participant(session_id, user.id)
    participant = (
        db.query(SessionParticipant)
        .filter(SessionParticipant.session_id == session_id, SessionParticipant.user_id == user.id)
        .first()
    )
    if participant and participant.is_blocked:
        raise HTTPException(status_code=403, detail='Вы заблокированы в этой сессии.')
    return LivekitTokenResponse(
        room_name=session.livekit_room,
        participant_name=user.full_name,
        token=token,
        can_control_stage=can_control_session_stage(session, user, db),
    )


@router.get('/{session_id}/participants', response_model=list[SessionParticipantRead])
def session_participants(session_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    session = ensure_session_member(session_id, user, db)
    rows = SessionService(db).participants(session_id)
    moderators = {
        member.user_id
        for member in db.query(GroupMember).filter(
            GroupMember.group_id == session.group_id,
            GroupMember.can_moderate.is_(True),
        )
    }
    return [
        SessionParticipantRead(
            id=participant_user.id,
            full_name=participant_user.full_name,
            is_online=participant.is_online,
            is_blocked=participant.is_blocked,
            can_moderate=participant_user.role == UserRole.admin
            or participant_user.id == session.created_by_id
            or participant_user.id in moderators,
        )
        for participant, participant_user in rows
    ]


@router.post('/{session_id}/participants/{user_id}/block')
def block_session_participant(
    session_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    session = ensure_session_member(session_id, user, db)
    if user.role != UserRole.admin and session.created_by_id != user.id:
        raise HTTPException(status_code=403, detail='Блокировать участников может только создатель сессии.')
    if user_id == session.created_by_id:
        raise HTTPException(status_code=400, detail='Нельзя заблокировать создателя сессии.')

    participant = (
        db.query(SessionParticipant)
        .filter(SessionParticipant.session_id == session_id, SessionParticipant.user_id == user_id)
        .first()
    )
    if not participant:
        raise HTTPException(status_code=404, detail='Участник не найден в этой сессии.')

    participant.is_blocked = True
    participant.is_online = False

    active_tasks = (
        db.query(Task)
        .filter(
            Task.session_id == session_id,
            Task.assignee_id == user_id,
            Task.status.in_([SessionTaskStatus.assigned, SessionTaskStatus.in_progress, SessionTaskStatus.blocked]),
        )
        .all()
    )
    for task in active_tasks:
        task.assignee_id = None
        task.status = SessionTaskStatus.backlog

    db.commit()
    return {'message': 'Участник заблокирован в сессии.'}


@router.get('/{session_id}/dashboard')
def session_dashboard(session_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    ensure_session_member(session_id, user, db)
    return SessionDashboardService(db).build_snapshot(session_id)


@router.get('/{session_id}/summary', response_model=SessionSummaryRead)
def get_session_summary(session_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    session = ensure_session_member(session_id, user, db)
    service = SessionSummaryService(db)
    summary = service.get_summary(session_id) or service.get_or_create(session, user.id)
    return _summary_read(summary)


@router.post('/{session_id}/summary', response_model=SessionSummaryRead)
def save_session_summary(
    session_id: int,
    payload: SessionSummaryUpsert,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    session = ensure_session_member(session_id, user, db)
    summary = SessionSummaryService(db).save_summary(session, user.id, payload.model_dump())
    return _summary_read(summary)


@router.patch('/{session_id}/summary', response_model=SessionSummaryRead)
def update_session_summary(
    session_id: int,
    payload: SessionSummaryUpsert,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    session = ensure_session_member(session_id, user, db)
    summary = SessionSummaryService(db).save_summary(session, user.id, payload.model_dump())
    return _summary_read(summary)


@router.post('/{session_id}/summary/skip', response_model=SessionSummaryRead)
def skip_session_summary(
    session_id: int,
    payload: SessionSummarySkip,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    session = ensure_session_member(session_id, user, db)
    summary = SessionSummaryService(db).skip_summary(session, user.id, payload.remind_at)
    return _summary_read(summary)
