from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, joinedload

from app.api.deps import ensure_group_member, get_current_user
from app.db.session import get_db
from app.models import (
    Conversation,
    ConversationKind,
    ConversationMember,
    ConversationMessage,
    Friendship,
    FriendshipStatus,
    Group,
    GroupMember,
    SessionParticipant,
    User,
    VideoSession,
)
from app.schemas import (
    ConversationMessageCreate,
    ConversationMessageRead,
    ConversationRead,
    FriendshipCreate,
    FriendshipRead,
    FriendshipUpdate,
    UserDirectoryRead,
)

router = APIRouter()


def _resolve_status(db: Session, user: User) -> str:
    participation = (
        db.query(SessionParticipant, VideoSession)
        .join(VideoSession, VideoSession.id == SessionParticipant.session_id)
        .filter(SessionParticipant.user_id == user.id, SessionParticipant.is_online.is_(True))
        .order_by(SessionParticipant.last_activity_at.desc())
        .first()
    )
    if participation:
        _, session = participation
        return f'В сессии: {session.title}'
    return 'Свободен'


def _directory_user(db: Session, user: User) -> UserDirectoryRead:
    current_status = _resolve_status(db, user)
    return UserDirectoryRead(
        id=user.id,
        full_name=user.full_name,
        role=user.role,
        skills=[skill for skill in user.skills.split(',') if skill],
        is_online=current_status != 'Свободен',
        current_status=current_status,
    )


def _friendship_read(db: Session, friendship: Friendship, current_user_id: int) -> FriendshipRead:
    other_user = friendship.addressee if friendship.requester_id == current_user_id else friendship.requester
    direction = 'outgoing' if friendship.requester_id == current_user_id else 'incoming'
    return FriendshipRead(
        id=friendship.id,
        user=_directory_user(db, other_user),
        status=friendship.status,
        direction=direction,
        created_at=friendship.created_at,
    )


def _conversation_read(conversation: Conversation) -> ConversationRead:
    last_message = conversation.messages[-1] if conversation.messages else None
    updated_at = last_message.created_at if last_message else conversation.created_at
    member_names = [member.user.full_name for member in conversation.members if member.user]
    return ConversationRead(
        id=conversation.id,
        kind=conversation.kind,
        title=conversation.title,
        group_id=conversation.group_id,
        member_names=member_names,
        last_message_preview=(last_message.body[:120] if last_message else ''),
        updated_at=updated_at,
    )


def _ensure_conversation_member(db: Session, conversation_id: int, user_id: int) -> Conversation:
    conversation = (
        db.query(Conversation)
        .options(
            joinedload(Conversation.members).joinedload(ConversationMember.user),
            joinedload(Conversation.messages).joinedload(ConversationMessage.sender),
        )
        .filter(Conversation.id == conversation_id)
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=404, detail='Диалог не найден.')
    member = next((item for item in conversation.members if item.user_id == user_id), None)
    if not member:
        raise HTTPException(status_code=403, detail='Нет доступа к этому диалогу.')
    return conversation


@router.get('/users', response_model=list[UserDirectoryRead])
def search_users(
    query: str = Query(default='', max_length=255),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    text = query.strip()
    items = db.query(User).filter(User.id != user.id)
    if text:
        pattern = f'%{text}%'
        items = items.filter(or_(User.full_name.ilike(pattern), User.email.ilike(pattern)))
    users = items.order_by(User.full_name.asc()).limit(30).all()
    return [_directory_user(db, item) for item in users]


@router.get('/friends', response_model=list[FriendshipRead])
def list_friendships(db: Session = Depends(get_db), user=Depends(get_current_user)):
    friendships = (
        db.query(Friendship)
        .options(joinedload(Friendship.requester), joinedload(Friendship.addressee))
        .filter(or_(Friendship.requester_id == user.id, Friendship.addressee_id == user.id))
        .order_by(Friendship.updated_at.desc(), Friendship.created_at.desc())
        .all()
    )
    return [_friendship_read(db, item, user.id) for item in friendships]


@router.post('/friends', response_model=FriendshipRead)
def create_friend_request(payload: FriendshipCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if payload.user_id == user.id:
        raise HTTPException(status_code=400, detail='Нельзя добавить в друзья самого себя.')

    other_user = db.get(User, payload.user_id)
    if not other_user:
        raise HTTPException(status_code=404, detail='Пользователь не найден.')

    now = datetime.utcnow()
    existing = (
        db.query(Friendship)
        .options(joinedload(Friendship.requester), joinedload(Friendship.addressee))
        .filter(
            or_(
                and_(Friendship.requester_id == user.id, Friendship.addressee_id == payload.user_id),
                and_(Friendship.requester_id == payload.user_id, Friendship.addressee_id == user.id),
            )
        )
        .first()
    )
    if existing:
        if existing.status == FriendshipStatus.accepted:
            return _friendship_read(db, existing, user.id)
        if existing.status == FriendshipStatus.pending:
            if existing.addressee_id == user.id:
                existing.status = FriendshipStatus.accepted
                existing.updated_at = now
                db.commit()
                db.refresh(existing)
                existing = (
                    db.query(Friendship)
                    .options(joinedload(Friendship.requester), joinedload(Friendship.addressee))
                    .filter(Friendship.id == existing.id)
                    .first()
                )
                return _friendship_read(db, existing, user.id)
            return _friendship_read(db, existing, user.id)
        raise HTTPException(status_code=400, detail='Связь с этим пользователем уже существует.')

    friendship = Friendship(
        requester_id=user.id,
        addressee_id=payload.user_id,
        status=FriendshipStatus.pending,
        created_at=now,
        updated_at=now,
    )
    db.add(friendship)
    db.commit()
    db.refresh(friendship)
    friendship = (
        db.query(Friendship)
        .options(joinedload(Friendship.requester), joinedload(Friendship.addressee))
        .filter(Friendship.id == friendship.id)
        .first()
    )
    return _friendship_read(db, friendship, user.id)


@router.patch('/friends/{friendship_id}', response_model=FriendshipRead)
def update_friendship(
    friendship_id: int,
    payload: FriendshipUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    friendship = (
        db.query(Friendship)
        .options(joinedload(Friendship.requester), joinedload(Friendship.addressee))
        .filter(Friendship.id == friendship_id)
        .first()
    )
    if not friendship:
        raise HTTPException(status_code=404, detail='Запрос в друзья не найден.')

    if payload.action == 'accept':
        if friendship.addressee_id != user.id:
            raise HTTPException(status_code=403, detail='Подтвердить запрос может только получатель.')
        friendship.status = FriendshipStatus.accepted
    elif payload.action == 'decline':
        if friendship.addressee_id != user.id:
            raise HTTPException(status_code=403, detail='Отклонить запрос может только получатель.')
        snapshot = _friendship_read(db, friendship, user.id)
        db.delete(friendship)
        db.commit()
        return snapshot
    elif payload.action == 'block':
        if user.id not in {friendship.requester_id, friendship.addressee_id}:
            raise HTTPException(status_code=403, detail='Недостаточно прав для блокировки.')
        friendship.status = FriendshipStatus.blocked
    elif payload.action == 'remove':
        if user.id not in {friendship.requester_id, friendship.addressee_id}:
            raise HTTPException(status_code=403, detail='Недостаточно прав для удаления из друзей.')
        if friendship.status != FriendshipStatus.accepted:
            raise HTTPException(status_code=400, detail='Удалить можно только принятую дружбу.')
        snapshot = _friendship_read(db, friendship, user.id)
        db.delete(friendship)
        db.commit()
        return snapshot

    friendship.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(friendship)
    friendship = (
        db.query(Friendship)
        .options(joinedload(Friendship.requester), joinedload(Friendship.addressee))
        .filter(Friendship.id == friendship.id)
        .first()
    )
    return _friendship_read(db, friendship, user.id)


@router.get('/conversations', response_model=list[ConversationRead])
def list_conversations(db: Session = Depends(get_db), user=Depends(get_current_user)):
    conversations = (
        db.query(Conversation)
        .join(ConversationMember, ConversationMember.conversation_id == Conversation.id)
        .options(
            joinedload(Conversation.members).joinedload(ConversationMember.user),
            joinedload(Conversation.messages),
        )
        .filter(ConversationMember.user_id == user.id, Conversation.kind == ConversationKind.direct)
        .order_by(Conversation.created_at.desc())
        .all()
    )
    return sorted((_conversation_read(item) for item in conversations), key=lambda item: item.updated_at, reverse=True)


@router.post('/conversations/direct/{user_id}', response_model=ConversationRead)
def create_or_get_direct_conversation(user_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if user_id == user.id:
        raise HTTPException(status_code=400, detail='Нельзя открыть личный чат с собой.')

    other_user = db.get(User, user_id)
    if not other_user:
        raise HTTPException(status_code=404, detail='Пользователь не найден.')

    conversations = (
        db.query(Conversation)
        .join(ConversationMember, ConversationMember.conversation_id == Conversation.id)
        .filter(Conversation.kind == ConversationKind.direct)
        .options(
            joinedload(Conversation.members).joinedload(ConversationMember.user),
            joinedload(Conversation.messages),
        )
        .all()
    )
    for conversation in conversations:
        member_ids = sorted(member.user_id for member in conversation.members)
        if member_ids == sorted([user.id, user_id]):
            return _conversation_read(conversation)

    conversation = Conversation(
        kind=ConversationKind.direct,
        title=f'{user.full_name} и {other_user.full_name}',
        created_by_id=user.id,
    )
    db.add(conversation)
    db.flush()
    db.add(ConversationMember(conversation_id=conversation.id, user_id=user.id))
    db.add(ConversationMember(conversation_id=conversation.id, user_id=user_id))
    db.commit()
    return _conversation_read(_ensure_conversation_member(db, conversation.id, user.id))


@router.post('/conversations/group/{group_id}', response_model=ConversationRead)
def create_or_get_group_conversation(group_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    ensure_group_member(group_id, user, db)
    group = db.get(Group, group_id)
    conversation = (
        db.query(Conversation)
        .options(
            joinedload(Conversation.members).joinedload(ConversationMember.user),
            joinedload(Conversation.messages),
        )
        .filter(Conversation.group_id == group_id, Conversation.kind == ConversationKind.group)
        .first()
    )
    if conversation:
        return _conversation_read(conversation)

    conversation = Conversation(
        kind=ConversationKind.group,
        title=f'Чат группы: {group.name}',
        group_id=group.id,
        created_by_id=user.id,
    )
    db.add(conversation)
    db.flush()
    members = (
        db.query(User)
        .join(GroupMember, GroupMember.user_id == User.id)
        .filter(GroupMember.group_id == group.id)
        .all()
    )
    for member in members:
        db.add(ConversationMember(conversation_id=conversation.id, user_id=member.id))
    db.commit()
    return _conversation_read(_ensure_conversation_member(db, conversation.id, user.id))


@router.get('/conversations/{conversation_id}/messages', response_model=list[ConversationMessageRead])
def list_messages(conversation_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    conversation = _ensure_conversation_member(db, conversation_id, user.id)
    return [
        ConversationMessageRead(
            id=message.id,
            conversation_id=message.conversation_id,
            sender_id=message.sender_id,
            sender_name=message.sender.full_name if message.sender else 'Участник',
            body=message.body,
            created_at=message.created_at,
        )
        for message in conversation.messages
    ]


@router.post('/conversations/{conversation_id}/messages', response_model=ConversationMessageRead)
def create_message(
    conversation_id: int,
    payload: ConversationMessageCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    _ensure_conversation_member(db, conversation_id, user.id)
    message = ConversationMessage(
        conversation_id=conversation_id,
        sender_id=user.id,
        body=payload.body.strip(),
        created_at=datetime.utcnow(),
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return ConversationMessageRead(
        id=message.id,
        conversation_id=message.conversation_id,
        sender_id=message.sender_id,
        sender_name=user.full_name,
        body=message.body,
        created_at=message.created_at,
    )
