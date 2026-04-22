from datetime import datetime
from uuid import uuid4

from livekit import api
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import ChatMessage, SessionParticipant, VideoSession
from app.repositories.session_repository import SessionRepository


class SessionService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = SessionRepository(db)

    def create_session(self, group_id: int, title: str, description: str, starts_at: datetime, user_id: int) -> VideoSession:
        room = f'group-{group_id}-session-{int(datetime.utcnow().timestamp())}'
        session = VideoSession(
            group_id=group_id,
            title=title,
            description=description,
            starts_at=starts_at,
            created_by_id=user_id,
            livekit_room=room,
        )
        return self.repo.create_session(session)

    def list_group_sessions(self, group_id: int):
        return self.repo.list_group_sessions(group_id)

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
            participant.last_activity_at = datetime.utcnow()
            participant.is_online = True
            self.db.commit()
            return participant

        return self.repo.upsert_participant(SessionParticipant(session_id=session_id, user_id=user_id))

    def save_message(self, session_id: int, sender_id: int, sender_name: str, message: str) -> ChatMessage:
        model = ChatMessage(
            session_id=session_id,
            sender_id=sender_id,
            sender_name=sender_name,
            message=message,
        )
        return self.repo.create_message(model)

    def history(self, session_id: int):
        return self.repo.list_messages(session_id)
