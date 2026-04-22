from __future__ import annotations

from sqlalchemy import desc
from sqlalchemy.orm import Session, joinedload

from app.models import Group, GroupAnnouncement, GroupMember, User


class AnnouncementService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _accessible_group_ids(self, user: User) -> list[int]:
        owned = [r[0] for r in self.db.query(Group.id).filter(Group.owner_id == user.id).all()]
        member_rows = (
            self.db.query(GroupMember.group_id).filter(GroupMember.user_id == user.id).all()
        )
        member_ids = [r[0] for r in member_rows]
        return list({*owned, *member_ids})

    def list_feed(self, user: User, limit: int = 40) -> list[GroupAnnouncement]:
        gids = self._accessible_group_ids(user)
        if not gids:
            return []
        return (
            self.db.query(GroupAnnouncement)
            .options(joinedload(GroupAnnouncement.group), joinedload(GroupAnnouncement.author))
            .filter(GroupAnnouncement.group_id.in_(gids))
            .order_by(desc(GroupAnnouncement.created_at))
            .limit(limit)
            .all()
        )

    def create(self, group_id: int, body: str, user: User) -> GroupAnnouncement:
        text = body.strip()
        if len(text) < 1:
            raise ValueError('Текст объявления не может быть пустым.')
        if len(text) > 4000:
            raise ValueError('Объявление слишком длинное (максимум 4000 символов).')
        row = GroupAnnouncement(group_id=group_id, author_id=user.id, body=text)
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return (
            self.db.query(GroupAnnouncement)
            .options(joinedload(GroupAnnouncement.group), joinedload(GroupAnnouncement.author))
            .filter(GroupAnnouncement.id == row.id)
            .one()
        )
