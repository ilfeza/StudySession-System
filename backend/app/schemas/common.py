from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import AssignmentStatus, TaskPriority, UserRole


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


class VideoSessionCreate(BaseModel):
    group_id: int
    title: str
    description: str = ''
    starts_at: datetime


class VideoSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_id: int
    title: str
    description: str
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
    group_id: int
    title: str
    description: str = ''
    required_skills: list[str] = []
    priority: TaskPriority = TaskPriority.medium
    deadline: Optional[datetime] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    required_skills: Optional[list[str]] = None
    priority: Optional[TaskPriority] = None
    deadline: Optional[datetime] = None
    is_completed: Optional[bool] = None


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_id: int
    title: str
    description: str
    required_skills: list[str]
    priority: TaskPriority
    deadline: Optional[datetime]
    is_completed: bool


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
