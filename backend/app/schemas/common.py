from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import (
    AssignmentStatus,
    GroupMaterialKind,
    SessionSummaryStatus,
    SessionTaskStatus,
    TaskPriority,
    UserRole,
)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = 'bearer'
    message: str = 'Успешная авторизация.'


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=6, max_length=100)
    role: UserRole = UserRole.student
    skills: list[str] = []


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    role: UserRole
    skills: list[str] = []
    reliability_score: float
    workload_limit: int


class GroupCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    description: str = ''


class GroupRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    owner_id: int
    created_at: datetime


class GroupMemberAdd(BaseModel):
    user_id: int
    can_moderate: bool = False


class SessionParticipantRead(BaseModel):
    id: int
    full_name: str
    is_online: bool
    can_moderate: bool = False


class VideoSessionCreate(BaseModel):
    group_id: int
    title: str
    description: str = ''
    template_key: str = ''
    starts_at: datetime


class VideoSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_id: int
    title: str
    description: str
    template_key: str = ''
    starts_at: datetime
    ends_at: Optional[datetime] = None
    is_active: bool
    livekit_room: str


class VideoSessionRoomRead(BaseModel):
    id: int
    group_id: int
    group_name: str
    title: str
    description: str
    template_key: str = ''
    starts_at: datetime
    ends_at: Optional[datetime] = None
    is_active: bool
    livekit_room: str


class LivekitTokenResponse(BaseModel):
    room_name: str
    participant_name: str
    token: str
    can_control_stage: bool = False


class TaskCreate(BaseModel):
    group_id: Optional[int] = None
    room_id: Optional[int] = None
    title: str
    description: str = ''
    assignee_id: Optional[int] = None
    status: SessionTaskStatus = SessionTaskStatus.todo
    required_skills: list[str] = []
    priority: TaskPriority = TaskPriority.medium
    deadline: Optional[datetime] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assignee_id: Optional[int] = None
    status: Optional[SessionTaskStatus] = None
    required_skills: Optional[list[str]] = None
    priority: Optional[TaskPriority] = None
    deadline: Optional[datetime] = None
    is_completed: Optional[bool] = None


class TaskUserRead(BaseModel):
    id: int
    full_name: str


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_id: int
    room_id: Optional[int] = None
    created_by_id: int
    assignee_id: Optional[int] = None
    title: str
    description: str
    status: SessionTaskStatus
    required_skills: list[str]
    priority: TaskPriority
    deadline: Optional[datetime]
    is_completed: bool
    created_at: datetime
    created_by: Optional[TaskUserRead] = None
    assignee: Optional[TaskUserRead] = None


class AssignmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    user_id: int
    score: float
    status: AssignmentStatus


class ChatMessageCreate(BaseModel):
    session_id: int
    message: str = Field(min_length=1, max_length=3000)


class ChatMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    sender_id: int
    sender_name: str
    message: str
    created_at: datetime


class AiTaskMessageInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    sender_name: str = Field(alias='senderName')
    message: str


class AiGenerateTasksRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    room_id: Optional[int] = Field(default=None, alias='roomId')
    room_title: str = Field(alias='roomTitle', min_length=1, max_length=255)
    description: str = ''
    messages: list[AiTaskMessageInput] = []


class AiGeneratedTaskRead(BaseModel):
    title: str
    description: str = ''
    assignee: Optional[str] = None


class FileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: Optional[int]
    original_name: str
    mime_type: str
    size_bytes: int
    created_at: datetime


class SummaryRequest(BaseModel):
    text: str = Field(min_length=30)


class SummaryResponse(BaseModel):
    summary: str


class MaterialAnalysisResponse(BaseModel):
    key_ideas: list[str]
    category: str
    confidence: float


class AnnouncementCreate(BaseModel):
    group_id: int
    body: str = Field(min_length=1, max_length=4000)


class AnnouncementFeedItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_id: int
    group_name: str
    author_name: str
    body: str
    created_at: datetime


class SessionSummaryTaskPayload(BaseModel):
    task_id: Optional[int] = None
    status_at_summary: SessionTaskStatus = SessionTaskStatus.todo
    sort_order: int = 0


class SessionSummaryUpsert(BaseModel):
    completed_work: str = ''
    next_steps: str = ''
    short_description: str = ''
    status: SessionSummaryStatus = SessionSummaryStatus.completed
    tasks: list[SessionSummaryTaskPayload] = []


class SessionSummarySkip(BaseModel):
    remind_at: Optional[datetime] = None


class SessionSummaryParticipantRead(BaseModel):
    user_id: Optional[int] = None
    full_name: str
    role_in_session: str


class SessionSummaryTaskRead(BaseModel):
    task_id: Optional[int] = None
    title: str
    assignee_id: Optional[int] = None
    assignee_name: str = ''
    deadline: Optional[datetime] = None
    status_at_summary: SessionTaskStatus
    sort_order: int


class SessionSummaryRead(BaseModel):
    id: int
    session_id: int
    group_id: int
    created_by_id: int
    updated_by_id: Optional[int] = None
    completed_work: str
    next_steps: str
    short_description: str
    status: SessionSummaryStatus
    remind_at: Optional[datetime] = None
    participants: list[SessionSummaryParticipantRead]
    tasks: list[SessionSummaryTaskRead]
    created_at: datetime
    updated_at: datetime


class SessionSummaryHistoryItem(BaseModel):
    session_id: int
    session_title: str
    session_date: datetime
    summary_id: int
    summary_status: SessionSummaryStatus
    short_description: str
    participants: list[str]
    tasks: list[SessionSummaryTaskRead]
    remind_at: Optional[datetime] = None
    updated_at: datetime


class GroupMaterialCreateLink(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    url: str = Field(min_length=5, max_length=2000)


class GroupMaterialRead(BaseModel):
    id: int
    group_id: int
    title: str
    kind: GroupMaterialKind
    url: str = ''
    file_url: str = ''
    original_name: str = ''
    mime_type: str = ''
    size_bytes: int = 0
    created_at: datetime


class UserProgressRead(BaseModel):
    user_id: int
    full_name: str
    email: str
    sessions_attended: int
    tasks_created: int
    tasks_completed: int


class UserSessionHistoryItem(BaseModel):
    session_id: int
    group_id: int
    group_name: str
    session_title: str
    template_key: str = ''
    session_date: datetime
    participants: list[str]
    tasks_total: int = 0
    tasks_completed: int = 0
    short_description: str = ''
