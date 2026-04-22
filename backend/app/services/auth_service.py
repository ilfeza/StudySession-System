from app.core.security import create_access_token, hash_password, verify_password
from app.models import User
from app.repositories.user_repository import UserRepository


class AuthService:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo

    def register(self, email: str, full_name: str, password: str, role, skills: list[str]) -> User:
        if self.user_repo.get_by_email(email):
            raise ValueError('Пользователь с таким email уже существует.')

        user = User(
            email=email,
            full_name=full_name,
            hashed_password=hash_password(password),
            role=role,
            skills=','.join(sorted({skill.strip().lower() for skill in skills if skill.strip()})),
        )
        return self.user_repo.create(user)

    def login(self, email: str, password: str) -> str:
        user = self.user_repo.get_by_email(email)
        if not user or not verify_password(password, user.hashed_password):
            raise ValueError('Неверный email или пароль.')
        return create_access_token(str(user.id))
