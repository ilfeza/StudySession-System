"""seed catalog groups, demo instructor, fix garbled names

Revision ID: 20260411_02
Revises: 20260404_01
Create Date: 2026-04-11
"""

from __future__ import annotations

from alembic import op
from sqlalchemy import text
from sqlalchemy.orm import Session, sessionmaker

revision = '20260411_02'
down_revision = '20260404_01'
branch_labels = None
depends_on = None

CATALOG: list[tuple[str, str]] = [
    (
        'Программирование на Python',
        'Практика, мини-проекты и разбор задач по курсу Python. Подходит новичкам и тем, кто готовит экзамен.',
    ),
    (
        'Веб-разработка (Frontend)',
        'React, TypeScript, доступность и вёрстка. Обмен ревью кода и макетов.',
    ),
    (
        'Backend и API',
        'FastAPI, PostgreSQL, тесты и контейнеризация. Совместные спринты по фичам.',
    ),
    (
        'Машинное обучение',
        'Датасеты, baseline-модели и групповые эксперименты. Обсуждение метрик и ошибок.',
    ),
    (
        'Дипломный проект 2026',
        'Организация совместной работы: видеосессии, задачи, чек-листы и отчёты.',
    ),
    (
        'Английский для IT',
        'Разговорная практика и подготовка к техническим собеседованиям.',
    ),
    (
        'Алгоритмы и структуры данных',
        'Разбор задач, разбор сложности, подготовка к олимпиадам и собеседованиям.',
    ),
    (
        'UI/UX и дизайн',
        'Прототипы в Figma, критика интерфейсов и единые гайдлайны для командных проектов.',
    ),
]


def upgrade() -> None:
    bind = op.get_bind()
    SessionLocal = sessionmaker(bind=bind)
    db: Session = SessionLocal()
    try:
        from app.core.security import hash_password
        from app.models.entities import Group, GroupMember, User, UserRole

        seed_email = 'seed.instructor@study.local'
        user = db.query(User).filter(User.email == seed_email).first()
        if not user:
            user = User(
                email=seed_email,
                full_name='Мария Сидорова',
                hashed_password=hash_password('StudyPass123'),
                role=UserRole.instructor,
                skills='преподавание,python,backend',
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        owner_id = user.id

        for name, description in CATALOG:
            exists = db.query(Group).filter(Group.name == name).first()
            if exists:
                continue
            group = Group(name=name, description=description, owner_id=owner_id)
            db.add(group)
            db.flush()
            db.add(GroupMember(group_id=group.id, user_id=owner_id, can_moderate=True))
        db.commit()

        # Исправить «битые» названия (часто ??? при неверной кодировке или пустых строках)
        db.execute(
            text(
                """
                UPDATE groups
                SET
                  name = 'Учебная группа №' || id::text,
                  description = COALESCE(NULLIF(trim(description), ''), 'Совместная работа над материалами курса.')
                WHERE name LIKE '%???%'
                   OR char_length(trim(name)) < 2
                   OR trim(name) = ''
                """
            )
        )
        db.execute(
            text(
                """
                UPDATE users
                SET full_name = initcap(replace(split_part(email, '@', 1), '.', ' '))
                WHERE full_name LIKE '%???%'
                   OR trim(full_name) = ''
                """
            )
        )
        db.commit()
    finally:
        db.close()


def downgrade() -> None:
    bind = op.get_bind()
    SessionLocal = sessionmaker(bind=bind)
    db: Session = SessionLocal()
    try:
        from app.models.entities import Group, GroupMember, User

        seed_email = 'seed.instructor@study.local'
        user = db.query(User).filter(User.email == seed_email).first()
        if not user:
            return
        names = [n for n, _ in CATALOG]
        group_ids = [g.id for g in db.query(Group).filter(Group.owner_id == user.id, Group.name.in_(names)).all()]
        if group_ids:
            db.query(GroupMember).filter(GroupMember.group_id.in_(group_ids)).delete(synchronize_session=False)
            db.query(Group).filter(Group.id.in_(group_ids)).delete(synchronize_session=False)
        remaining_owned = db.query(Group).filter(Group.owner_id == user.id).count()
        if remaining_owned == 0:
            db.query(User).filter(User.id == user.id).delete()
        db.commit()
    finally:
        db.close()
