from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import ensure_group_member, get_current_user
from app.db.session import get_db
from app.models import Group, GroupMember, UserRole, VideoSession
from app.schemas import LivekitTokenResponse, VideoSessionCreate, VideoSessionRead
from app.services.session_service import SessionService

router = APIRouter()


@router.post('', response_model=VideoSessionRead)
def create_session(payload: VideoSessionCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    ensure_group_member(payload.group_id, user, db)
    service = SessionService(db)
    session = service.create_session(payload.group_id, payload.title, payload.description, payload.starts_at, user.id)
    return VideoSessionRead.model_validate(session)


@router.get('/group/{group_id}', response_model=list[VideoSessionRead])
def list_group_sessions(group_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    ensure_group_member(group_id, user, db)
    sessions = SessionService(db).list_group_sessions(group_id)
    return [VideoSessionRead.model_validate(item) for item in sessions]


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
