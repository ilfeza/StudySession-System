from datetime import datetime, timedelta

from app.models import Group, GroupMember, Task, TaskPriority, User
from app.services.assignment_service import AssignmentService


def test_assignment_picks_best_skill_match(db_session):
    db = db_session

    owner = User(email='owner@example.com', full_name='Владелец', hashed_password='x', role='instructor', skills='python')
    best = User(email='best@example.com', full_name='Лучший', hashed_password='x', role='student', skills='python,ml', reliability_score=0.95)
    other = User(email='other@example.com', full_name='Другой', hashed_password='x', role='student', skills='design', reliability_score=0.6)
    db.add_all([owner, best, other])
    db.commit()
    db.refresh(owner)
    db.refresh(best)
    db.refresh(other)

    group = Group(name='Команда A', description='Тест', owner_id=owner.id)
    db.add(group)
    db.commit()
    db.refresh(group)

    db.add_all([
        GroupMember(group_id=group.id, user_id=best.id, can_moderate=False),
        GroupMember(group_id=group.id, user_id=other.id, can_moderate=False),
    ])
    db.commit()

    task = Task(
        group_id=group.id,
        title='Сделать модель',
        description='Нужно собрать базовую модель',
        required_skills='python,ml',
        priority=TaskPriority.high,
        deadline=datetime.utcnow() + timedelta(hours=24),
        created_by_id=owner.id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    assignment = AssignmentService(db).assign_task(task)
    assert assignment.user_id == best.id
