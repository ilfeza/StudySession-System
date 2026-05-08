import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

TEST_ROOT = Path(__file__).resolve().parent
TEST_UPLOADS_DIR = TEST_ROOT / 'test_uploads'

os.environ['DATABASE_URL'] = 'sqlite://'
os.environ['SECRET_KEY'] = 'test-secret'
os.environ['UPLOADS_DIR'] = TEST_UPLOADS_DIR.as_posix()

from app.db.base import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402

app.router.on_startup.clear()
app.router.on_shutdown.clear()

engine = create_engine(
    'sqlite://',
    connect_args={'check_same_thread': False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def reset_db():
    TEST_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client():
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def auth_headers(client: TestClient):
    register = client.post(
        '/api/auth/register',
        json={
            'email': 'member@example.com',
            'full_name': 'Анна Тестова',
            'password': 'secret123',
            'role': 'student',
            'skills': ['python', 'sql'],
        },
    )
    assert register.status_code == 200

    login = client.post('/api/auth/login', json={'email': 'member@example.com', 'password': 'secret123'})
    token = login.json()['access_token']
    return {'Authorization': f'Bearer {token}'}
