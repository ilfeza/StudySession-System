from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import ensure_group_member, get_current_user
from app.db.session import get_db
from app.models import VideoSession
from app.schemas import ChatMessageCreate, ChatMessageRead
from app.services.session_service import SessionService
from app.websocket.manager import chat_manager

router = APIRouter()


@router.post('/message', response_model=ChatMessageRead)
async def send_message(payload: ChatMessageCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    session = db.get(VideoSession, payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail='Сессия не найдена.')

    ensure_group_member(session.group_id, user, db)
    message = SessionService(db).save_message(payload.session_id, user.id, user.full_name, payload.message)
    read = ChatMessageRead.model_validate(message)
    await chat_manager.broadcast(
        payload.session_id,
        {
            'event': 'chat_message',
            'payload': {
                'id': message.id,
                'sender_name': message.sender_name,
                'message': message.message,
                'created_at': message.created_at.isoformat(),
            },
        },
    )
    return read


@router.get('/history/{session_id}', response_model=list[ChatMessageRead])
def history(session_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    session = db.get(VideoSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail='Сессия не найдена.')
    ensure_group_member(session.group_id, user, db)
    messages = SessionService(db).history(session_id)
    return [ChatMessageRead.model_validate(item) for item in messages]
