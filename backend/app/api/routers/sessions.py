from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import ensure_group_member, ensure_session_member, get_current_user
from app.db.session import get_db
from app.models import Group, GroupMember, SessionSummary, UserRole, VideoSession
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
        payload.starts_at,
        user.id,
        payload.template_key,
    )
    return VideoSessionRead.model_validate(session)


@router.get('/group/{group_id}', response_model=list[VideoSessionRead])
def list_group_sessions(group_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    ensure_group_member(group_id, user, db)
    sessions = SessionService(db).list_group_sessions(group_id)
    return [VideoSessionRead.model_validate(item) for item in sessions]


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
    can_control_stage = False
    if user.role == UserRole.admin or session.created_by_id == user.id:
        can_control_stage = True
    else:
        group = db.get(Group, session.group_id)
        if group and group.owner_id == user.id:
            can_control_stage = True
        else:
            membership = (
                db.query(GroupMember)
                .filter(
                    GroupMember.group_id == session.group_id,
                    GroupMember.user_id == user.id,
                    GroupMember.can_moderate.is_(True),
                )
                .first()
            )
            can_control_stage = membership is not None

    return LivekitTokenResponse(
        room_name=session.livekit_room,
        participant_name=user.full_name,
        token=token,
        can_control_stage=can_control_stage,
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
            can_moderate=participant_user.role == UserRole.admin
            or participant_user.id == session.created_by_id
            or participant_user.id in moderators,
        )
        for participant, participant_user in rows
    ]


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
