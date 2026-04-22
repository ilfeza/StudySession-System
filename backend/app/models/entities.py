from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class UserRole(str, enum.Enum):
    student = 'student'
    instructor = 'instructor'
    admin = 'admin'


class TaskPriority(str, enum.Enum):
    low = 'low'
    medium = 'medium'
    high = 'high'
    critical = 'critical'


class AssignmentStatus(str, enum.Enum):
    assigned = 'assigned'
    in_progress = 'in_progress'
    done = 'done'
    reassigned = 'reassigned'


class User(Base):
    __tablename__ = 'users'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.student, nullable=False)

    skills: Mapped[str] = mapped_column(Text, default='', nullable=False)
    reliability_score: Mapped[float] = mapped_column(Float, default=0.8, nullable=False)
    workload_limit: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    memberships: Mapped[list[GroupMember]] = relationship('GroupMember', back_populates='user')
    created_groups: Mapped[list[Group]] = relationship('Group', back_populates='owner')
    created_tasks: Mapped[list[Task]] = relationship('Task', back_populates='creator')
    announcements: Mapped[list['GroupAnnouncement']] = relationship('GroupAnnouncement', back_populates='author')


class Group(Base):
    __tablename__ = 'groups'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default='', nullable=False)
    owner_id: Mapped[int] = mapped_column(ForeignKey('users.id'), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    owner: Mapped[User] = relationship('User', back_populates='created_groups')
    members: Mapped[list[GroupMember]] = relationship('GroupMember', back_populates='group', cascade='all, delete-orphan')
    sessions: Mapped[list[VideoSession]] = relationship('VideoSession', back_populates='group', cascade='all, delete-orphan')
    tasks: Mapped[list[Task]] = relationship('Task', back_populates='group', cascade='all, delete-orphan')
    announcements: Mapped[list['GroupAnnouncement']] = relationship(
        'GroupAnnouncement',
        back_populates='group',
        cascade='all, delete-orphan',
    )


class GroupAnnouncement(Base):
    __tablename__ = 'group_announcements'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey('groups.id', ondelete='CASCADE'), nullable=False, index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    group: Mapped[Group] = relationship('Group', back_populates='announcements')
    author: Mapped[User] = relationship('User', back_populates='announcements')


class GroupMember(Base):
    __tablename__ = 'group_members'
    __table_args__ = (UniqueConstraint('group_id', 'user_id', name='uq_group_member'),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey('groups.id'), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), nullable=False)
    can_moderate: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    group: Mapped[Group] = relationship('Group', back_populates='members')
    user: Mapped[User] = relationship('User', back_populates='memberships')


class VideoSession(Base):
    __tablename__ = 'video_sessions'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey('groups.id'), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default='', nullable=False)
    created_by_id: Mapped[int] = mapped_column(ForeignKey('users.id'), nullable=False)
    starts_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    livekit_room: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    group: Mapped[Group] = relationship('Group', back_populates='sessions')
    participants: Mapped[list[SessionParticipant]] = relationship(
        'SessionParticipant',
        back_populates='session',
        cascade='all, delete-orphan',
    )
    chat_messages: Mapped[list[ChatMessage]] = relationship('ChatMessage', back_populates='session')


class SessionParticipant(Base):
    __tablename__ = 'session_participants'
    __table_args__ = (UniqueConstraint('session_id', 'user_id', name='uq_session_user'),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey('video_sessions.id'), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    last_activity_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    is_online: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    session: Mapped[VideoSession] = relationship('VideoSession', back_populates='participants')


class Task(Base):
    __tablename__ = 'tasks'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey('groups.id'), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default='', nullable=False)
    required_skills: Mapped[str] = mapped_column(Text, default='', nullable=False)
    priority: Mapped[TaskPriority] = mapped_column(Enum(TaskPriority), default=TaskPriority.medium, nullable=False)
    deadline: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey('users.id'), nullable=False)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    group: Mapped[Group] = relationship('Group', back_populates='tasks')
    creator: Mapped[User] = relationship('User', back_populates='created_tasks')
    assignments: Mapped[list[TaskAssignment]] = relationship(
        'TaskAssignment',
        back_populates='task',
        cascade='all, delete-orphan',
    )
    files: Mapped[list[File]] = relationship('File', back_populates='task')


class TaskAssignment(Base):
    __tablename__ = 'task_assignments'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey('tasks.id'), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), nullable=False)
    score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[AssignmentStatus] = mapped_column(Enum(AssignmentStatus), default=AssignmentStatus.assigned, nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    task: Mapped[Task] = relationship('Task', back_populates='assignments')


class ChatMessage(Base):
    __tablename__ = 'chat_messages'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey('video_sessions.id'), nullable=False, index=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey('users.id'), nullable=False)
    sender_name: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    session: Mapped[VideoSession] = relationship('VideoSession', back_populates='chat_messages')


class SessionStage(str, enum.Enum):
    discussion = 'discussion'
    work = 'work'
    summary = 'summary'


class SessionStageState(Base):
    __tablename__ = 'session_stage_states'
    __table_args__ = (UniqueConstraint('session_id', name='uq_session_stage_state_session'),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey('video_sessions.id', ondelete='CASCADE'), nullable=False, index=True)

    current_stage: Mapped[SessionStage] = mapped_column(
        Enum(SessionStage),
        default=SessionStage.discussion,
        nullable=False,
    )
    stage_started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    session: Mapped[VideoSession] = relationship('VideoSession')


class PomodoroPhase(str, enum.Enum):
    focus = 'focus'
    short_break = 'short_break'
    long_break = 'long_break'


class PomodoroState(Base):
    __tablename__ = 'pomodoro_states'
    __table_args__ = (UniqueConstraint('session_id', name='uq_pomodoro_state_session'),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey('video_sessions.id', ondelete='CASCADE'), nullable=False, index=True)

    enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    running: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    phase: Mapped[PomodoroPhase] = mapped_column(Enum(PomodoroPhase), default=PomodoroPhase.focus, nullable=False)

    focus_duration_s: Mapped[int] = mapped_column(Integer, default=25 * 60, nullable=False)
    short_break_duration_s: Mapped[int] = mapped_column(Integer, default=5 * 60, nullable=False)
    long_break_duration_s: Mapped[int] = mapped_column(Integer, default=15 * 60, nullable=False)
    cycles_before_long_break: Mapped[int] = mapped_column(Integer, default=4, nullable=False)

    cycle_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    paused_remaining_s: Mapped[int | None] = mapped_column(Integer, nullable=True)

    controller_user_id: Mapped[int | None] = mapped_column(ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    controller_name: Mapped[str] = mapped_column(String(255), default='', nullable=False)
    last_started_by_id: Mapped[int | None] = mapped_column(ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    last_started_by_name: Mapped[str] = mapped_column(String(255), default='', nullable=False)

    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    session: Mapped[VideoSession] = relationship('VideoSession')


class File(Base):
    __tablename__ = 'files'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey('tasks.id'), nullable=True)
    uploaded_by_id: Mapped[int] = mapped_column(ForeignKey('users.id'), nullable=False)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    mime_type: Mapped[str] = mapped_column(String(255), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    task: Mapped[Task] = relationship('Task', back_populates='files')
