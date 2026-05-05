# Платформа совместной студенческой работы

Монорепозиторий для групповых видеосессий, управления задачами и ML-анализа материалов.

## Структура

- `backend` — FastAPI, PostgreSQL, WebSocket, JWT, ML
- `frontend` — React + TypeScript + Material UI + LiveKit SDK
- `nginx` — reverse proxy
- `docker-compose.yml` — запуск всех сервисов

## Архитектура

### Backend

- **Слои:** `routers -> services -> repositories -> models`
- **Аутентификация:** JWT (`/api/auth/register`, `/api/auth/login`)
- **RBAC:** роли `admin`, `instructor`, `student` + модераторы группы
- **Реалтайм:** WebSocket чат `/ws/sessions/{session_id}/chat`
- **Алгоритм задач:** навыки, надежность, загрузка, срочность, доступность
- **ML модуль:** локальная суммаризация и анализ материалов (`/api/ml/*`)


### Frontend

- Страницы: вход/регистрация, дашборд, группы, видеосессия
- Компоненты: видеосетка, центр задач, чат
- Все пользовательские тексты на русском

### Infra

- `postgres` — основная БД
- `livekit` — SFU для видеокомнат до ~30 участников
- `backend` — FastAPI + Alembic
- `frontend` — Vite dev server
- `nginx` — единая точка входа (API, WS, frontend)

## Запуск

```bash
docker-compose up --build
```

Открывайте приложение через `http://localhost`, а не через `http://0.0.0.0`.
`0.0.0.0` здесь используется только как адрес привязки сервера, и браузер не считает его безопасным origin для камеры и микрофона.

Если подключаетесь к одной и той же видеокомнате с разных устройств, задайте IP компьютера, на котором запущен Docker, в файле `.env` рядом с `docker-compose.yml`:

```env
LIVEKIT_NODE_IP=192.168.1.23
```

Тогда приложение с других устройств открывайте по `http://192.168.1.23`, а не по `localhost`.

После запуска:

- Приложение: `http://localhost`
- Health backend: `http://localhost/health`

## Тесты

### Backend

```bash
cd backend
pytest
```

### Опционально: полный локальный ML

По умолчанию backend запускается с легковесным локальным анализом (без тяжелых моделей), чтобы сборка Docker не падала из-за долгих загрузок.

Если нужен `transformers + torch`, установите дополнительно:

```bash
cd backend
pip install -r requirements-ml.txt
```

### Frontend

```bash
cd frontend
npm install
npm run test
```

## Важные endpoint'ы

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/groups`
- `POST /api/sessions`
- `GET /api/sessions/{id}/token`
- `POST /api/tasks`
- `POST /api/files/upload`
- `POST /api/ml/summarize`
- `POST /api/ml/analyze`
