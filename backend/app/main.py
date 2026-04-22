from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from app.api.router import api_router
from app.core.config import get_settings
from app.core.security import decode_token
from app.db.base import Base
from app.db.session import engine
from app.models import GroupMember, User, UserRole, VideoSession
from app.services.session_service import SessionService
from app.services.pomodoro_service import (
    DEFAULT_CYCLES_BEFORE_LONG,
    DEFAULT_FOCUS_S,
    DEFAULT_LONG_BREAK_S,
    DEFAULT_SHORT_BREAK_S,
    PomodoroDurations,
    PomodoroService,
)
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


@app.on_event('startup')
def startup_event():
    Base.metadata.create_all(bind=engine)


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
            message = SessionService(db).save_message(session_id, user.id, user.full_name, message_text)
            await chat_manager.broadcast(
                session_id,
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

    service = PomodoroService(db)
    state = service.get_or_create(session_id)
    await websocket.send_json({'event': 'pomodoro_state', 'payload': service.build_snapshot(state)})

    stage_service = SessionStageService(db)
    stage_state = stage_service.get_or_create(session_id)
    await websocket.send_json({'event': 'stage_state', 'payload': stage_service.build_snapshot(stage_state)})

    try:
        while True:
            data = await websocket.receive_json()
            event = str(data.get('event', '')).strip()
            payload = data.get('payload') or {}

            state = service.get_or_create(session_id)
            state = service.normalize_progress(state)

            if event == 'stage_set':
                requested = str(payload.get('stage', '')).strip()
                can_control = False
                if user.role == UserRole.admin or session.created_by_id == user.id:
                    can_control = True
                else:
                    membership = (
                        db.query(GroupMember)
                        .filter(
                            GroupMember.group_id == session.group_id,
                            GroupMember.user_id == user.id,
                            GroupMember.can_moderate.is_(True),
                        )
                        .first()
                    )
                    can_control = membership is not None

                if not can_control:
                    await websocket.send_json({'event': 'stage_error', 'payload': {'message': 'Переключать этап может только модератор.'}})
                    continue

                stage_state = stage_service.get_or_create(session_id)
                try:
                    from app.models import SessionStage

                    next_stage = SessionStage(requested)
                except Exception:
                    await websocket.send_json({'event': 'stage_error', 'payload': {'message': 'Неизвестный этап сессии.'}})
                    continue

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
                state = service.start(
                    state,
                    controller_user_id=user.id,
                    controller_name=user.full_name,
                    durations=model,
                )
                snapshot = service.build_snapshot(state)
                await widgets_manager.broadcast(session_id, {'event': 'pomodoro_state', 'payload': snapshot})
                await widgets_manager.broadcast(session_id, {'event': 'pomodoro_started', 'payload': snapshot})
                continue

            controller_ok = state.controller_user_id is not None and int(state.controller_user_id) == int(user.id)
            if event in {'pomodoro_pause', 'pomodoro_resume', 'pomodoro_skip_phase', 'pomodoro_reset'} and not controller_ok:
                await websocket.send_json(
                    {
                        'event': 'pomodoro_error',
                        'payload': {
                            'message': 'Управлять таймером может только тот, кто его запустил.',
                            'controller_user_id': state.controller_user_id,
                            'controller_name': state.controller_name,
                        },
                    },
                )
                continue

            if event == 'pomodoro_pause':
                state = service.pause(state)
            elif event == 'pomodoro_resume':
                state = service.resume(state)
            elif event == 'pomodoro_skip_phase':
                state = service.skip_phase(state)
            elif event == 'pomodoro_reset':
                state = service.reset(state)
            elif event == 'pomodoro_claim_control':
                state = service.claim_control(state, controller_user_id=user.id, controller_name=user.full_name)
                await widgets_manager.broadcast(
                    session_id,
                    {'event': 'pomodoro_controller_changed', 'payload': service.build_snapshot(state)},
                )
                continue
            else:
                # ignore unknown event
                continue

            await widgets_manager.broadcast(session_id, {'event': 'pomodoro_state', 'payload': service.build_snapshot(state)})
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
