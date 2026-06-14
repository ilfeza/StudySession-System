from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import (
    AssignmentStatus,
    ConversationKind,
    FriendshipStatus,
    GroupMaterialKind,
    GroupVisibility,
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
    email: str
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
    is_active: bool = True
    avatar_url: str = ''


class UserProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=3, max_length=255)
    email: EmailStr | None = None
    bio: str | None = Field(default=None, max_length=1000)
    skills: list[str] | None = None


class UserDirectoryRead(BaseModel):
    id: int
    email: str = ''
    full_name: str
    role: UserRole
    skills: list[str] = []
    is_online: bool = False
    current_status: str = ''
    is_active: bool = True


class GroupMemberAdminRead(BaseModel):
    user_id: int
    full_name: str
    email: str
    role: UserRole
    can_moderate: bool
    joined_at: datetime


class AdminGroupRead(BaseModel):
    id: int
    name: str
    description: str
    visibility: GroupVisibility
    invite_key: str
    owner_id: int
    owner_name: str
    member_count: int
    active_sessions: int
    created_at: datetime
    members: list[GroupMemberAdminRead]


class AdminGroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = None
    visibility: GroupVisibility | None = None


class AdminGroupMemberUpdate(BaseModel):
    can_moderate: bool


class AdminUserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=4, max_length=100)
    role: UserRole = UserRole.analyst
    skills: list[str] = []
    is_active: bool = True


class AdminUserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=3, max_length=255)
    role: UserRole | None = None
    is_active: bool | None = None
    workload_limit: int | None = Field(default=None, ge=1, le=20)
    reliability_score: float | None = Field(default=None, ge=0, le=1)
    skills: list[str] | None = None


class AdminAnalyticsOverview(BaseModel):
    total_users: int
    active_users: int
    total_groups: int
    private_groups: int
    total_friendships: int
    active_sessions: int
    completed_tasks: int
    pending_tasks: int
    role_distribution: dict[str, int]
    top_groups: list[dict[str, int | str]]
    recent_users: list[UserDirectoryRead]


class GroupCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    description: str = ''
    visibility: GroupVisibility = GroupVisibility.public


class GroupRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    owner_id: int
    visibility: GroupVisibility
    invite_key: str = ''
    created_at: datetime


class GroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = None
    visibility: GroupVisibility | None = None


class GroupJoinByKey(BaseModel):
    invite_key: str = Field(min_length=4, max_length=32)


class FriendshipCreate(BaseModel):
    user_id: int


class FriendshipUpdate(BaseModel):
    action: str = Field(pattern='^(accept|decline|block|remove)$')


class FriendshipRead(BaseModel):
    id: int
    user: UserDirectoryRead
    status: FriendshipStatus
    direction: str
    created_at: datetime


class ConversationRead(BaseModel):
    id: int
    kind: ConversationKind
    title: str
    group_id: int | None = None
    member_names: list[str]
    last_message_preview: str = ''
    updated_at: datetime


class ConversationMessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class ConversationMessageRead(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    sender_name: str
    body: str
    created_at: datetime


class GroupMemberAdd(BaseModel):
    user_id: int
    can_moderate: bool = False


class GroupMemberRead(BaseModel):
    user_id: int
    full_name: str
    email: str
    can_moderate: bool
    is_owner: bool = False
    joined_at: datetime


class SessionParticipantRead(BaseModel):
    id: int
    full_name: str
    is_online: bool
    can_moderate: bool = False
    is_blocked: bool = False


class VideoSessionCreate(BaseModel):
    group_id: int
    title: str
    description: str = ''
    template_key: str = ''
    starts_at: datetime | None = None


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
    created_by_id: int


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
    status: SessionTaskStatus = SessionTaskStatus.backlog
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
    workflow_stage: str = ''
    created_in_stage: str = ''
    assignment_status: str = ''


class AssignmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    user_id: int
    score: float
    status: AssignmentStatus


class ChatMessageCreate(BaseModel):
    session_id: int
    task_id: Optional[int] = None
    message: str = Field(min_length=1, max_length=3000)


class ChatMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    task_id: Optional[int] = None
    sender_id: int
    sender_name: str
    message: str
    stage: str = ''
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
    suggested_stage: str = SessionTaskStatus.backlog.value


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
    author_avatar_url: str = ''
    body: str
    created_at: datetime


class SessionSummaryTaskPayload(BaseModel):
    task_id: Optional[int] = None
    status_at_summary: SessionTaskStatus = SessionTaskStatus.backlog
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
    completion_summary: str = ''
    contribution_summary: str = ''
    bottleneck_summary: str = ''
    collaboration_summary: str = ''
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
