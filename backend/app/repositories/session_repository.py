from sqlalchemy.orm import Session

from app.models import ChatMessage, SessionParticipant, User, VideoSession


class SessionRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_session(self, session: VideoSession) -> VideoSession:
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def list_group_sessions(self, group_id: int):
        return (
            self.db.query(VideoSession)
            .filter(VideoSession.group_id == group_id)
            .order_by(VideoSession.starts_at.desc())
            .all()
        )

    def upsert_participant(self, participant: SessionParticipant) -> SessionParticipant:
        self.db.add(participant)
        self.db.commit()
        self.db.refresh(participant)
        return participant

    def create_message(self, message: ChatMessage) -> ChatMessage:
        self.db.add(message)
        self.db.commit()
        self.db.refresh(message)
        return message

    def list_messages(self, session_id: int):
        return (
            self.db.query(ChatMessage)
            .filter(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.asc())
            .limit(200)
            .all()
        )

    def list_participants(self, session_id: int):
        return (
            self.db.query(SessionParticipant, User)
            .join(User, User.id == SessionParticipant.user_id)
            .filter(SessionParticipant.session_id == session_id)
            .order_by(SessionParticipant.is_online.desc(), User.full_name.asc())
            .all()
        )
