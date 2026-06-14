import secrets

from sqlalchemy.orm import Session, joinedload

from app.models import Group, GroupMember, GroupVisibility
from app.repositories.group_repository import GroupRepository


class GroupService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = GroupRepository(db)

    def create_group(self, name: str, description: str, owner_id: int, visibility: GroupVisibility = GroupVisibility.public) -> Group:
        group = Group(
            name=name,
            description=description,
            owner_id=owner_id,
            visibility=visibility,
            invite_key=self._generate_invite_key(),
        )
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
        return self.repo.list_public()

    def join_group(self, group_id: int, user_id: int) -> GroupMember:
        group = self.db.get(Group, group_id)
        if not group:
            raise ValueError('Группа не найдена.')

        existing = self.repo.get_member(group_id, user_id)
        if existing:
            raise ValueError('Вы уже состоите в этой группе.')
        return self.repo.add_member(GroupMember(group_id=group_id, user_id=user_id, can_moderate=False))

    def join_group_by_key(self, invite_key: str, user_id: int) -> GroupMember:
        group = self.repo.get_by_invite_key(invite_key.strip())
        if not group:
            raise ValueError('Группа по такому ключу не найдена.')
        return self.join_group(group.id, user_id)

    def update_group(self, group: Group, *, name: str | None, description: str | None, visibility: GroupVisibility | None) -> Group:
        if name is not None:
            group.name = name
        if description is not None:
            group.description = description
        if visibility is not None:
            group.visibility = visibility
        self.db.commit()
        self.db.refresh(group)
        return group

    def leave_group(self, group: Group, user_id: int) -> None:
        membership = self.repo.get_member(group.id, user_id)
        if not membership:
            raise ValueError('Вы не состоите в этой группе.')
        self.db.delete(membership)
        self.db.commit()

    def delete_group(self, group: Group) -> None:
        self.db.delete(group)
        self.db.commit()

    def remove_member(self, group: Group, user_id: int, actor_id: int) -> None:
        if group.owner_id != actor_id:
            raise ValueError('Удалять участников может только создатель группы.')
        if user_id == group.owner_id:
            raise ValueError('Нельзя удалить создателя группы.')
        membership = self.repo.get_member(group.id, user_id)
        if not membership:
            raise ValueError('Пользователь не состоит в этой группе.')
        self.db.delete(membership)
        self.db.commit()

    def list_members(self, group_id: int) -> list[GroupMember]:
        return (
            self.db.query(GroupMember)
            .options(joinedload(GroupMember.user))
            .filter(GroupMember.group_id == group_id)
            .order_by(GroupMember.joined_at.asc())
            .all()
        )

    def _generate_invite_key(self) -> str:
        while True:
            key = secrets.token_hex(4).upper()
            if not self.repo.get_by_invite_key(key):
                return key
