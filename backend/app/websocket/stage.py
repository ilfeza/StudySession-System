from sqlalchemy.orm import Session

from app.services.session_stage_service import SessionStageService
from app.websocket.manager import widgets_manager


async def broadcast_session_stage(session_id: int, db: Session) -> None:
    stage_service = SessionStageService(db)
    state = stage_service.get_or_create(session_id)
    snapshot = stage_service.build_snapshot(state)
    await widgets_manager.broadcast(session_id, {'event': 'stage_state', 'payload': snapshot})


async def broadcast_session_stage_if_changed(session_id: int, db: Session, stage_changed: bool) -> None:
    if stage_changed:
        await broadcast_session_stage(session_id, db)
