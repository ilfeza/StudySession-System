from datetime import datetime, timedelta
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from app.api.deps import can_control_session_stage
from app.api.router import api_router
from app.core.config import get_settings
from app.core.security import decode_token, hash_password
from app.db.base import Base
from app.db.session import engine
from app.models import (
    ChatMessage,
    Conversation,
    ConversationKind,
    ConversationMember,
    ConversationMessage,
    Friendship,
    FriendshipStatus,
    Group,
    GroupAnnouncement,
    GroupMaterial,
    GroupMaterialKind,
    GroupMember,
    GroupVisibility,
    SessionParticipant,
    SessionSummary,
    SessionSummaryParticipant,
    SessionSummaryStatus,
    SessionTaskStatus,
    Task,
    TaskPriority,
    User,
    UserRole,
    VideoSession,
)
from app.services.pomodoro_service import (
    DEFAULT_CYCLES_BEFORE_LONG,
    DEFAULT_FOCUS_S,
    DEFAULT_LONG_BREAK_S,
    DEFAULT_SHORT_BREAK_S,
    PomodoroDurations,
    PomodoroService,
)
from app.services.session_service import SessionService
from app.services.session_stage_service import SessionStageService
from app.websocket.manager import chat_manager, tasks_manager, widgets_manager

settings = get_settings()

app = FastAPI(title=settings.app_name)
app.include_router(api_router, prefix='/api')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

Path(settings.uploads_dir).mkdir(parents=True, exist_ok=True)
app.mount('/files', StaticFiles(directory=settings.uploads_dir), name='files')


def seed_demo_data():
    db = Session(bind=engine)
    try:
        users_payload = [
            {
                'email': 'seed.instructor@study.local',
                'full_name': 'Мария Сидорова',
                'role': UserRole.instructor,
                'skills': 'преподавание,python,backend',
                'workload_limit': 4,
            },
            {
                'email': 'seed.student1@study.local',
                'full_name': 'Алина Крылова',
                'role': UserRole.student,
                'skills': 'frontend,ui,figma',
                'workload_limit': 3,
            },
            {
                'email': 'seed.student2@study.local',
                'full_name': 'Илья Морозов',
                'role': UserRole.student,
                'skills': 'backend,api,sql',
                'workload_limit': 3,
            },
            {
                'email': 'seed.student3@study.local',
                'full_name': 'Никита Орлов',
                'role': UserRole.student,
                'skills': 'qa,tests,docs',
                'workload_limit': 2,
            },
            {
                'email': 'seed.student4@study.local',
                'full_name': 'Софья Белова',
                'role': UserRole.student,
                'skills': 'analytics,research,summary',
                'workload_limit': 2,
            },
            {
                'email': 'admin',
                'full_name': 'Администратор платформы',
                'role': UserRole.admin,
                'skills': 'admin,moderation,analytics',
                'workload_limit': 6,
                'password': 'admin',
            },
            {
                'email': 'analyst.demo@study.local',
                'full_name': 'Демо аналитик',
                'role': UserRole.analyst,
                'skills': 'analytics,dashboards,reports',
                'workload_limit': 2,
            },
            {
                'email': 'friend.one@study.local',
                'full_name': 'Елена Смирнова',
                'role': UserRole.student,
                'skills': 'marketing,notes',
                'workload_limit': 2,
            },
            {
                'email': 'friend.two@study.local',
                'full_name': 'Максим Волков',
                'role': UserRole.student,
                'skills': 'frontend,ux',
                'workload_limit': 3,
            },
            {
                'email': 'friend.three@study.local',
                'full_name': 'Ольга Николаева',
                'role': UserRole.student,
                'skills': 'research,analytics',
                'workload_limit': 2,
            },
        ]

        users: dict[str, User] = {}
        for payload in users_payload:
            user = db.query(User).filter(User.email == payload['email']).first()
            if not user:
                user = User(
                    email=payload['email'],
                    full_name=payload['full_name'],
                    hashed_password=hash_password(payload.get('password', 'StudyPass123')),
                    role=payload['role'],
                    skills=payload['skills'],
                    workload_limit=payload['workload_limit'],
                    reliability_score=0.88,
                )
                db.add(user)
                db.flush()
            else:
                user.full_name = payload['full_name']
                user.role = payload['role']
                user.skills = payload['skills']
                user.workload_limit = payload['workload_limit']
            users[payload['email']] = user

        owner = users['seed.instructor@study.local']

        group_specs = [
            {
                'name': 'Демо-группа: продуктовая сессия',
                'description': 'Основная рабочая группа для проверки видеосессий, канбан-доски, уведомлений и итогов встречи.',
                'visibility': GroupVisibility.public,
                'invite_key': 'PRODUCT1',
                'members': ['seed.instructor@study.local', 'seed.student1@study.local', 'seed.student2@study.local', 'seed.student3@study.local'],
            },
            {
                'name': 'Приватная исследовательская группа',
                'description': 'Закрытая группа для работы с материалами, приватными сессиями и ручным входом по ключу.',
                'visibility': GroupVisibility.private,
                'invite_key': 'PRIVATE7',
                'members': ['seed.instructor@study.local', 'seed.student2@study.local', 'seed.student4@study.local'],
            },
            {
                'name': 'UI Lab',
                'description': 'Группа по интерфейсам, ревью макетов и быстрым тестовым встречам.',
                'visibility': GroupVisibility.public,
                'invite_key': 'UILAB11',
                'members': ['seed.student1@study.local', 'seed.student3@study.local', 'seed.student4@study.local'],
            },
        ]

        groups: dict[str, Group] = {}
        for spec in group_specs:
            group = db.query(Group).filter(Group.name == spec['name']).first()
            if not group:
                group = Group(
                    name=spec['name'],
                    description=spec['description'],
                    owner_id=owner.id,
                    visibility=spec['visibility'],
                    invite_key=spec['invite_key'],
                )
                db.add(group)
                db.flush()
            else:
                group.description = spec['description']
                group.visibility = spec['visibility']
                group.invite_key = spec['invite_key']
            groups[spec['name']] = group

            for email in spec['members']:
                member = users[email]
                membership = db.query(GroupMember).filter(GroupMember.group_id == group.id, GroupMember.user_id == member.id).first()
                if not membership:
                    db.add(GroupMember(group_id=group.id, user_id=member.id, can_moderate=email == 'seed.instructor@study.local'))

        session_specs = [
            {
                'room': 'demo-product-session',
                'group': groups['Демо-группа: продуктовая сессия'],
                'title': 'Демо-сессия по подготовке релиза',
                'description': 'Главная встреча для проверки звонка, панели управления, задач и совместной работы.',
                'template_key': 'team_project',
                'starts_at': datetime.utcnow() - timedelta(minutes=15),
                'ends_at': datetime.utcnow() + timedelta(hours=2),
                'is_active': True,
            },
            {
                'room': 'demo-research-session',
                'group': groups['Приватная исследовательская группа'],
                'title': 'Закрытый разбор материалов',
                'description': 'Приватная рабочая сессия с историей, материалами и обсуждением следующих шагов.',
                'template_key': 'topic_review',
                'starts_at': datetime.utcnow() - timedelta(days=1, hours=2),
                'ends_at': datetime.utcnow() - timedelta(days=1, minutes=20),
                'is_active': False,
            },
            {
                'room': 'demo-ui-lab',
                'group': groups['UI Lab'],
                'title': 'Ревью интерфейса групп',
                'description': 'Встреча по навигации, карточкам групп и общему визуальному стилю.',
                'template_key': 'team_project',
                'starts_at': datetime.utcnow() + timedelta(hours=5),
                'ends_at': datetime.utcnow() + timedelta(hours=6, minutes=30),
                'is_active': False,
            },
        ]

        sessions: dict[str, VideoSession] = {}
        for spec in session_specs:
            session = db.query(VideoSession).filter(VideoSession.livekit_room == spec['room']).first()
            if not session:
                session = VideoSession(
                    group_id=spec['group'].id,
                    title=spec['title'],
                    description=spec['description'],
                    template_key=spec['template_key'],
                    created_by_id=owner.id,
                    starts_at=spec['starts_at'],
                    ends_at=spec['ends_at'],
                    is_active=spec['is_active'],
                    livekit_room=spec['room'],
                )
                db.add(session)
                db.flush()
            else:
                session.title = spec['title']
                session.description = spec['description']
                session.template_key = spec['template_key']
                session.starts_at = spec['starts_at']
                session.ends_at = spec['ends_at']
                session.is_active = spec['is_active']
            sessions[spec['room']] = session

        product_session = sessions['demo-product-session']
        participant_rows = [
            ('seed.instructor@study.local', True),
            ('seed.student1@study.local', True),
            ('seed.student2@study.local', True),
            ('seed.student3@study.local', False),
        ]
        for email, is_online in participant_rows:
            user = users[email]
            participant = db.query(SessionParticipant).filter(SessionParticipant.session_id == product_session.id, SessionParticipant.user_id == user.id).first()
            if not participant:
                db.add(SessionParticipant(session_id=product_session.id, user_id=user.id, is_online=is_online))
            else:
                participant.is_online = is_online
                participant.last_activity_at = datetime.utcnow()

        task_specs = [
            {
                'session': product_session,
                'group': groups['Демо-группа: продуктовая сессия'],
                'title': 'Подготовить финальный список задач на релиз',
                'description': 'Собрать приоритеты, проверить зависимости и закрепить ответственных.',
                'priority': TaskPriority.high,
                'status': SessionTaskStatus.in_progress,
                'assignee_email': 'seed.student2@study.local',
            },
            {
                'session': product_session,
                'group': groups['Демо-группа: продуктовая сессия'],
                'title': 'Проверить макеты для экрана сессии',
                'description': 'Сверить состояние чата, панели участников и адаптивности под ноутбук.',
                'priority': TaskPriority.medium,
                'status': SessionTaskStatus.assigned,
                'assignee_email': 'seed.student1@study.local',
            },
            {
                'session': product_session,
                'group': groups['Демо-группа: продуктовая сессия'],
                'title': 'Собрать чек-лист регрессии',
                'description': 'Отдельно проверить уведомления, переключение темы и создание задач на доске.',
                'priority': TaskPriority.critical,
                'status': SessionTaskStatus.blocked,
                'assignee_email': 'seed.student3@study.local',
            },
            {
                'session': product_session,
                'group': groups['Демо-группа: продуктовая сессия'],
                'title': 'Подготовить итог встречи',
                'description': 'Сформулировать решения и договорённости для истории сессии.',
                'priority': TaskPriority.low,
                'status': SessionTaskStatus.done,
                'assignee_email': 'seed.instructor@study.local',
            },
            {
                'session': sessions['demo-ui-lab'],
                'group': groups['UI Lab'],
                'title': 'Собрать варианты левой навигации',
                'description': 'Подготовить несколько вариантов размещения вкладок и быстрых действий.',
                'priority': TaskPriority.medium,
                'status': SessionTaskStatus.in_progress,
                'assignee_email': 'seed.student1@study.local',
            },
            {
                'session': sessions['demo-research-session'],
                'group': groups['Приватная исследовательская группа'],
                'title': 'Подготовить пакет исследовательских материалов',
                'description': 'Сформировать подборку ссылок и краткие выводы для следующей встречи.',
                'priority': TaskPriority.high,
                'status': SessionTaskStatus.done,
                'assignee_email': 'seed.student4@study.local',
            },
        ]

        existing_titles = {task.title for task in db.query(Task).all()}
        for item in task_specs:
            if item['title'] in existing_titles:
                continue
            assignee = users[item['assignee_email']]
            db.add(Task(
                group_id=item['group'].id,
                session_id=item['session'].id,
                title=item['title'],
                description=item['description'],
                required_skills='',
                priority=item['priority'],
                created_by_id=owner.id,
                assignee_id=assignee.id,
                status=item['status'],
                is_completed=item['status'] == SessionTaskStatus.done,
            ))

        if db.query(ChatMessage).filter(ChatMessage.session_id == product_session.id).count() == 0:
            demo_messages = [
                ('seed.instructor@study.local', 'Начинаем с проверки статусов и блокеров по релизу.'),
                ('seed.student2@study.local', 'Я возьму финальный список задач и обновлю приоритеты.'),
                ('seed.student1@study.local', 'Нужна помощь с проверкой адаптива на экране сессии.'),
                ('seed.student3@study.local', 'Я застрял на чек-листе регрессии, нужна помощь с уведомлениями.'),
            ]
            for email, message in demo_messages:
                author = users[email]
                db.add(ChatMessage(
                    session_id=product_session.id,
                    sender_id=author.id,
                    sender_name=author.full_name,
                    message=message,
                    stage='execution',
                ))

        if db.query(GroupAnnouncement).count() == 0:
            db.add_all([
                GroupAnnouncement(group_id=groups['Демо-группа: продуктовая сессия'].id, author_id=owner.id, body='Сегодня закрываем блокеры по сессии и приводим UI к единому стилю.'),
                GroupAnnouncement(group_id=groups['UI Lab'].id, author_id=users['seed.student1@study.local'].id, body='Завтра нужно подготовить три варианта навигации по группам.'),
            ])

        if db.query(GroupMaterial).count() == 0:
            db.add_all([
                GroupMaterial(group_id=groups['Демо-группа: продуктовая сессия'].id, uploaded_by_id=owner.id, title='План релиза', kind=GroupMaterialKind.link, url='https://example.com/release-plan'),
                GroupMaterial(group_id=groups['Демо-группа: продуктовая сессия'].id, uploaded_by_id=users['seed.student1@study.local'].id, title='Ссылка на макеты', kind=GroupMaterialKind.link, url='https://example.com/figma-session'),
                GroupMaterial(group_id=groups['Приватная исследовательская группа'].id, uploaded_by_id=users['seed.student4@study.local'].id, title='Конспект исследований', kind=GroupMaterialKind.link, url='https://example.com/research-notes'),
            ])

        research_session = sessions['demo-research-session']
        if not db.query(SessionSummary).filter(SessionSummary.session_id == research_session.id).first():
            summary = SessionSummary(
                session_id=research_session.id,
                group_id=research_session.group_id,
                created_by_id=owner.id,
                updated_by_id=owner.id,
                completed_work='Разобрали материалы, выделили ключевые гипотезы и договорились о следующем раунде проверки.',
                next_steps='Подготовить обновлённый набор материалов и вынести гипотезы на отдельную сессию.',
                short_description='Сессия завершилась списком гипотез и новым пакетом материалов.',
                status=SessionSummaryStatus.completed,
            )
            db.add(summary)
            db.flush()
            db.add_all([
                SessionSummaryParticipant(summary_id=summary.id, user_id=owner.id, full_name_snapshot=owner.full_name, role_in_session='moderator'),
                SessionSummaryParticipant(summary_id=summary.id, user_id=users['seed.student2@study.local'].id, full_name_snapshot=users['seed.student2@study.local'].full_name, role_in_session='analyst'),
                SessionSummaryParticipant(summary_id=summary.id, user_id=users['seed.student4@study.local'].id, full_name_snapshot=users['seed.student4@study.local'].full_name, role_in_session='researcher'),
            ])

        if db.query(Friendship).count() == 0:
            db.add_all([
                Friendship(requester_id=owner.id, addressee_id=users['seed.student1@study.local'].id, status=FriendshipStatus.accepted),
                Friendship(requester_id=users['seed.student2@study.local'].id, addressee_id=owner.id, status=FriendshipStatus.accepted),
                Friendship(requester_id=users['seed.student4@study.local'].id, addressee_id=users['seed.student3@study.local'].id, status=FriendshipStatus.pending),
                Friendship(requester_id=users['friend.one@study.local'].id, addressee_id=users['seed.student1@study.local'].id, status=FriendshipStatus.accepted),
                Friendship(requester_id=users['friend.two@study.local'].id, addressee_id=users['seed.student2@study.local'].id, status=FriendshipStatus.accepted),
                Friendship(requester_id=users['friend.three@study.local'].id, addressee_id=owner.id, status=FriendshipStatus.pending),
            ])

        if db.query(Conversation).count() == 0:
            group_conversation = Conversation(
                kind=ConversationKind.group,
                title='Чат группы: Демо-группа: продуктовая сессия',
                group_id=groups['Демо-группа: продуктовая сессия'].id,
                created_by_id=owner.id,
            )
            direct_conversation = Conversation(
                kind=ConversationKind.direct,
                title='Мария Сидорова и Алина Крылова',
                created_by_id=owner.id,
            )
            db.add_all([group_conversation, direct_conversation])
            db.flush()

            for email in ['seed.instructor@study.local', 'seed.student1@study.local', 'seed.student2@study.local', 'seed.student3@study.local']:
                db.add(ConversationMember(conversation_id=group_conversation.id, user_id=users[email].id))
            db.add(ConversationMember(conversation_id=direct_conversation.id, user_id=owner.id))
            db.add(ConversationMember(conversation_id=direct_conversation.id, user_id=users['seed.student1@study.local'].id))

            db.add_all([
                ConversationMessage(conversation_id=group_conversation.id, sender_id=owner.id, body='Коллеги, в чат группы скидываем ссылки на материалы и сессии.'),
                ConversationMessage(conversation_id=group_conversation.id, sender_id=users['seed.student2@study.local'].id, body='Добавил ссылку на релизный план и обновил список задач.'),
                ConversationMessage(conversation_id=direct_conversation.id, sender_id=owner.id, body='Алина, посмотри, пожалуйста, адаптив страницы групп.'),
                ConversationMessage(conversation_id=direct_conversation.id, sender_id=users['seed.student1@study.local'].id, body='Да, сегодня подготовлю несколько вариантов для ревью.'),
            ])

        db.commit()
    finally:
        db.close()


@app.on_event('startup')
def startup_event():
    Base.metadata.create_all(bind=engine)
    seed_demo_data()


@app.get('/health')
def health_check():
    return {'status': 'ok', 'message': 'Сервис работает стабильно.'}


@app.websocket('/ws/sessions/{session_id}/chat')
async def chat_ws(websocket: WebSocket, session_id: int):
    token = websocket.query_params.get('token', '')
    if not token:
        await websocket.close(code=4401, reason='Требуется токен авторизации.')
        return

    try:
        user_id = int(decode_token(token))
    except Exception:
        await websocket.close(code=4401, reason='Неверный токен авторизации.')
        return

    db = Session(bind=engine)
    user = db.get(User, user_id)
    if not user:
        await websocket.close(code=4404, reason='Пользователь не найден.')
        db.close()
        return

    session = db.get(VideoSession, session_id)
    if not session:
        await websocket.close(code=4404, reason='Сессия не найдена.')
        db.close()
        return

    is_allowed = False
    if user.role == UserRole.admin:
        is_allowed = True
    elif session.created_by_id == user.id:
        is_allowed = True
    else:
        membership = (
            db.query(GroupMember)
            .filter(GroupMember.group_id == session.group_id, GroupMember.user_id == user.id)
            .first()
        )
        is_allowed = membership is not None

    if not is_allowed:
        await websocket.close(code=4403, reason='Недостаточно прав для этой сессии.')
        db.close()
        return

    await chat_manager.connect(session_id, websocket)
    SessionService(db).touch_participant(session_id, user.id)

    try:
        while True:
            data = await websocket.receive_json()
            message_text = str(data.get('message', '')).strip()
            if not message_text:
                continue

            SessionService(db).touch_participant(session_id, user.id)
            task_id = data.get('task_id')
            message = SessionService(db).save_message(session_id, user.id, user.full_name, message_text, task_id)
            await chat_manager.broadcast(
                session_id,
                {
                    'event': 'chat_message',
                    'payload': {
                        'id': message.id,
                        'task_id': message.task_id,
                        'sender_name': message.sender_name,
                        'message': message.message,
                        'stage': message.stage,
                        'created_at': message.created_at.isoformat(),
                    },
                },
            )
    except WebSocketDisconnect:
        chat_manager.disconnect(session_id, websocket)
    finally:
        db.close()


@app.websocket('/ws/sessions/{session_id}/widgets')
async def widgets_ws(websocket: WebSocket, session_id: int):
    token = websocket.query_params.get('token', '')
    if not token:
        await websocket.close(code=4401, reason='Требуется токен авторизации.')
        return

    try:
        user_id = int(decode_token(token))
    except Exception:
        await websocket.close(code=4401, reason='Неверный токен авторизации.')
        return

    db = Session(bind=engine)
    user = db.get(User, user_id)
    if not user:
        await websocket.close(code=4404, reason='Пользователь не найден.')
        db.close()
        return

    session = db.get(VideoSession, session_id)
    if not session:
        await websocket.close(code=4404, reason='Сессия не найдена.')
        db.close()
        return

    is_allowed = False
    if user.role == UserRole.admin:
        is_allowed = True
    elif session.created_by_id == user.id:
        is_allowed = True
    else:
        membership = (
            db.query(GroupMember)
            .filter(GroupMember.group_id == session.group_id, GroupMember.user_id == user.id)
            .first()
        )
        is_allowed = membership is not None

    if not is_allowed:
        await websocket.close(code=4403, reason='Недостаточно прав для этой сессии.')
        db.close()
        return

    await widgets_manager.connect(session_id, websocket)
    SessionService(db).touch_participant(session_id, user.id)

    pomodoro_service = PomodoroService(db)
    pomodoro_state = pomodoro_service.get_or_create(session_id)
    await websocket.send_json({'event': 'pomodoro_state', 'payload': pomodoro_service.build_snapshot(pomodoro_state)})

    stage_service = SessionStageService(db)
    stage_state, _ = stage_service.sync_stage_for_session(session_id)
    await websocket.send_json({'event': 'stage_state', 'payload': stage_service.build_snapshot(stage_state)})

    try:
        while True:
            data = await websocket.receive_json()
            event = str(data.get('event', '')).strip()
            payload = data.get('payload') or {}

            pomodoro_state = pomodoro_service.get_or_create(session_id)
            pomodoro_state = pomodoro_service.normalize_progress(pomodoro_state)

            if event == 'stage_set':
                requested = str(payload.get('stage', '')).strip()

                if not can_control_session_stage(session, user, db):
                    await websocket.send_json({'event': 'stage_error', 'payload': {'message': 'Переключать этап могут только модераторы сессии.'}})
                    continue

                try:
                    from app.models import SessionStage

                    next_stage = SessionStage(requested)
                except Exception:
                    await websocket.send_json({'event': 'stage_error', 'payload': {'message': 'Неизвестный этап сессии.'}})
                    continue

                stage_state = stage_service.get_or_create(session_id)
                stage_state = stage_service.set_stage(stage_state, next_stage)
                snapshot = stage_service.build_snapshot(stage_state)
                await widgets_manager.broadcast(session_id, {'event': 'stage_state', 'payload': snapshot})
                await widgets_manager.broadcast(session_id, {'event': 'stage_changed', 'payload': snapshot})
                continue

            if event == 'pomodoro_start':
                durations = payload.get('durations') or {}
                model = PomodoroDurations(
                    focus_duration_s=int(durations.get('focus_duration_s', DEFAULT_FOCUS_S)),
                    short_break_duration_s=int(durations.get('short_break_duration_s', DEFAULT_SHORT_BREAK_S)),
                    long_break_duration_s=int(durations.get('long_break_duration_s', DEFAULT_LONG_BREAK_S)),
                    cycles_before_long_break=int(durations.get('cycles_before_long_break', DEFAULT_CYCLES_BEFORE_LONG)),
                )
                pomodoro_state = pomodoro_service.start(
                    pomodoro_state,
                    controller_user_id=user.id,
                    controller_name=user.full_name,
                    durations=model,
                )
                snapshot = pomodoro_service.build_snapshot(pomodoro_state)
                await widgets_manager.broadcast(session_id, {'event': 'pomodoro_state', 'payload': snapshot})
                await widgets_manager.broadcast(session_id, {'event': 'pomodoro_started', 'payload': snapshot})
                continue

            controller_ok = pomodoro_state.controller_user_id is not None and int(pomodoro_state.controller_user_id) == int(user.id)
            if event in {'pomodoro_pause', 'pomodoro_resume', 'pomodoro_skip_phase', 'pomodoro_reset'} and not controller_ok:
                await websocket.send_json(
                    {
                        'event': 'pomodoro_error',
                        'payload': {
                            'message': 'Управлять таймером может только тот, кто его запустил.',
                            'controller_user_id': pomodoro_state.controller_user_id,
                            'controller_name': pomodoro_state.controller_name,
                        },
                    },
                )
                continue

            if event == 'pomodoro_pause':
                pomodoro_state = pomodoro_service.pause(pomodoro_state)
            elif event == 'pomodoro_resume':
                pomodoro_state = pomodoro_service.resume(pomodoro_state)
            elif event == 'pomodoro_skip_phase':
                pomodoro_state = pomodoro_service.skip_phase(pomodoro_state)
            elif event == 'pomodoro_reset':
                pomodoro_state = pomodoro_service.reset(pomodoro_state)
            elif event == 'pomodoro_claim_control':
                pomodoro_state = pomodoro_service.claim_control(
                    pomodoro_state,
                    controller_user_id=user.id,
                    controller_name=user.full_name,
                )
                await widgets_manager.broadcast(
                    session_id,
                    {'event': 'pomodoro_controller_changed', 'payload': pomodoro_service.build_snapshot(pomodoro_state)},
                )
                continue
            else:
                continue

            await widgets_manager.broadcast(session_id, {'event': 'pomodoro_state', 'payload': pomodoro_service.build_snapshot(pomodoro_state)})
    except WebSocketDisconnect:
        widgets_manager.disconnect(session_id, websocket)
    finally:
        db.close()


@app.websocket('/ws/sessions/{session_id}/tasks')
async def tasks_ws(websocket: WebSocket, session_id: int):
    token = websocket.query_params.get('token', '')
    if not token:
        await websocket.close(code=4401, reason='Требуется токен авторизации.')
        return

    try:
        user_id = int(decode_token(token))
    except Exception:
        await websocket.close(code=4401, reason='Неверный токен авторизации.')
        return

    db = Session(bind=engine)
    user = db.get(User, user_id)
    if not user:
        await websocket.close(code=4404, reason='Пользователь не найден.')
        db.close()
        return

    session = db.get(VideoSession, session_id)
    if not session:
        await websocket.close(code=4404, reason='Сессия не найдена.')
        db.close()
        return

    is_allowed = False
    if user.role == UserRole.admin or session.created_by_id == user.id:
        is_allowed = True
    else:
        membership = (
            db.query(GroupMember)
            .filter(GroupMember.group_id == session.group_id, GroupMember.user_id == user.id)
            .first()
        )
        is_allowed = membership is not None

    if not is_allowed:
        await websocket.close(code=4403, reason='Недостаточно прав для этой сессии.')
        db.close()
        return

    await tasks_manager.connect(session_id, websocket)
    SessionService(db).touch_participant(session_id, user.id)

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        tasks_manager.disconnect(session_id, websocket)
    finally:
        db.close()
