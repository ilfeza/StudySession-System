from datetime import datetime
from uuid import uuid4

from livekit import api
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import ChatMessage, SessionParticipant, VideoSession
from app.repositories.session_repository import SessionRepository
from app.services.session_stage_service import SessionStageService


class SessionService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = SessionRepository(db)

    def create_session(
        self,
        group_id: int,
        title: str,
        description: str,
        starts_at: datetime,
        user_id: int,
        template_key: str = '',
    ) -> VideoSession:
        room = f'group-{group_id}-session-{int(datetime.utcnow().timestamp())}'
        session = VideoSession(
            group_id=group_id,
            title=title,
            description=description,
            template_key=template_key.strip(),
            starts_at=starts_at,
            created_by_id=user_id,
            livekit_room=room,
        )
        return self.repo.create_session(session)

    def list_group_sessions(self, group_id: int):
        return self.repo.list_group_sessions(group_id)

    def delete_session(self, session_id: int) -> None:
        session = self.db.get(VideoSession, session_id)
        if not session:
            raise ValueError('Сессия не найдена.')
        self.db.delete(session)
        self.db.commit()

    def create_livekit_token(self, room_name: str, user_id: int, user_name: str) -> str:
        settings = get_settings()
        participant_identity = f'{user_id}-{uuid4().hex[:8]}'
        token = api.AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
        token = token.with_identity(participant_identity).with_name(user_name)
        token = token.with_grants(api.VideoGrants(room_join=True, room=room_name, can_publish=True, can_subscribe=True))
        return token.to_jwt()

    def touch_participant(self, session_id: int, user_id: int):
        participant = (
            self.db.query(SessionParticipant)
            .filter(SessionParticipant.session_id == session_id, SessionParticipant.user_id == user_id)
            .first()
        )
        if participant:
            if participant.is_blocked:
                raise HTTPException(status_code=403, detail='Вы заблокированы в этой сессии.')
            participant.last_activity_at = datetime.utcnow()
            participant.is_online = True
            self.db.commit()
            return participant

        return self.repo.upsert_participant(SessionParticipant(session_id=session_id, user_id=user_id))

    def save_message(self, session_id: int, sender_id: int, sender_name: str, message: str, task_id: int | None = None) -> ChatMessage:
        stage_state, _ = SessionStageService(self.db).sync_stage_for_session(session_id)
        model = ChatMessage(
            session_id=session_id,
            task_id=task_id,
            sender_id=sender_id,
            sender_name=sender_name,
            message=message,
            stage=stage_state.current_stage.value,
        )
        return self.repo.create_message(model)

    def history(self, session_id: int):
        return self.repo.list_messages(session_id)

    def participants(self, session_id: int):
        return self.repo.list_participants(session_id)
