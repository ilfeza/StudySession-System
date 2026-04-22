from fastapi import APIRouter

from app.api.routers import auth, chat, dashboard, files, groups, ml, pomodoro, sessions, tasks

api_router = APIRouter()
api_router.include_router(auth.router, prefix='/auth', tags=['Аутентификация'])
api_router.include_router(dashboard.router, prefix='/dashboard', tags=['Дашборд'])
api_router.include_router(groups.router, prefix='/groups', tags=['Группы'])
api_router.include_router(sessions.router, prefix='/sessions', tags=['Видеосессии'])
api_router.include_router(pomodoro.router, prefix='/sessions', tags=['Pomodoro'])
api_router.include_router(tasks.router, prefix='/tasks', tags=['Задачи'])
api_router.include_router(chat.router, prefix='/chat', tags=['Чат'])
api_router.include_router(files.router, prefix='/files', tags=['Файлы'])
api_router.include_router(ml.router, prefix='/ml', tags=['ML'])
