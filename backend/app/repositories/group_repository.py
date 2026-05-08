from sqlalchemy.orm import Session

from app.models import Group, GroupMember, GroupVisibility


class GroupRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_for_user(self, user_id: int):
        return (
            self.db.query(Group)
            .join(GroupMember, GroupMember.group_id == Group.id, isouter=True)
            .filter((Group.owner_id == user_id) | (GroupMember.user_id == user_id))
            .distinct()
            .all()
        )

    def create(self, group: Group) -> Group:
        self.db.add(group)
        self.db.commit()
        self.db.refresh(group)
        return group

    def list_all(self):
        return self.db.query(Group).order_by(Group.created_at.desc()).all()

    def list_public(self):
        return (
            self.db.query(Group)
            .filter(Group.visibility == GroupVisibility.public)
            .order_by(Group.created_at.desc())
            .all()
        )

    def get_by_invite_key(self, invite_key: str) -> Group | None:
        return self.db.query(Group).filter(Group.invite_key == invite_key).first()

    def get_member(self, group_id: int, user_id: int) -> GroupMember | None:
        return (
            self.db.query(GroupMember)
            .filter(GroupMember.group_id == group_id, GroupMember.user_id == user_id)
            .first()
        )

    def add_member(self, member: GroupMember) -> GroupMember:
        self.db.add(member)
        self.db.commit()
        self.db.refresh(member)
        return member
