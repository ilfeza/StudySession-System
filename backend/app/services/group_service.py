from sqlalchemy.orm import Session

from app.models import Group, GroupMember
from app.repositories.group_repository import GroupRepository


class GroupService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = GroupRepository(db)

    def create_group(self, name: str, description: str, owner_id: int) -> Group:
        group = Group(name=name, description=description, owner_id=owner_id)
        saved_group = self.repo.create(group)
        self.repo.add_member(GroupMember(group_id=saved_group.id, user_id=owner_id, can_moderate=True))
        return saved_group

    def add_member(self, group_id: int, user_id: int, can_moderate: bool) -> GroupMember:
        existing = self.repo.get_member(group_id, user_id)
        if existing:
            raise ValueError('Пользователь уже состоит в группе.')
        return self.repo.add_member(GroupMember(group_id=group_id, user_id=user_id, can_moderate=can_moderate))

    def list_user_groups(self, user_id: int):
        return self.repo.list_for_user(user_id)

    def list_all_groups(self):
        return self.repo.list_all()

    def join_group(self, group_id: int, user_id: int) -> GroupMember:
        group = self.db.get(Group, group_id)
        if not group:
            raise ValueError('Группа не найдена.')

        existing = self.repo.get_member(group_id, user_id)
        if existing:
            raise ValueError('Вы уже состоите в этой группе.')
        return self.repo.add_member(GroupMember(group_id=group_id, user_id=user_id, can_moderate=False))
