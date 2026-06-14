export type UserRole = 'student' | 'instructor' | 'admin' | 'analyst';
export type GroupVisibility = 'public' | 'private';
export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';
export type ConversationKind = 'direct' | 'group';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  skills: string[];
  reliability_score: number;
  workload_limit: number;
  avatar_url?: string;
  is_active?: boolean;
}

export interface Group {
  id: number;
  name: string;
  description: string;
  owner_id: number;
  visibility: GroupVisibility;
  invite_key: string;
  created_at: string;
}

export interface GroupMember {
  user_id: number;
  full_name: string;
  email: string;
  can_moderate: boolean;
  is_owner: boolean;
  joined_at: string;
}

export interface VideoSession {
  id: number;
  group_id: number;
  title: string;
  description: string;
  template_key: string;
  starts_at: string;
  ends_at?: string | null;
  is_active: boolean;
  livekit_room: string;
}

export interface VideoSessionRoom {
  id: number;
  group_id: number;
  group_name: string;
  title: string;
  description: string;
  template_key: string;
  starts_at: string;
  ends_at?: string | null;
  is_active: boolean;
  livekit_room: string;
  created_by_id: number;
}

export type SessionTaskStatus = 'backlog' | 'assigned' | 'in_progress' | 'blocked' | 'done';

export interface Task {
  id: number;
  group_id: number;
  room_id?: number;
  created_by_id?: number;
  assignee_id?: number | null;
  title: string;
  description: string;
  status?: SessionTaskStatus;
  required_skills: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  deadline?: string;
  is_completed: boolean;
  created_at?: string;
}

export interface TaskPerson {
  id: number;
  full_name: string;
}

export interface SessionParticipant {
  id: number;
  full_name: string;
  is_online: boolean;
  can_moderate: boolean;
  is_blocked?: boolean;
}

export interface SessionDashboardParticipant {
  id: number;
  full_name: string;
  is_online: boolean;
  last_activity_at: string;
  active_tasks: number;
  completed_tasks: number;
  workload_limit: number;
  load_percent: number;
  reliability_score: number;
  is_blocked?: boolean;
  skills: string[];
}

export interface SessionTask {
  id: number;
  group_id: number;
  room_id: number;
  created_by_id: number;
  assignee_id: number | null;
  title: string;
  description: string;
  status: SessionTaskStatus;
  required_skills: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  deadline?: string | null;
  is_completed: boolean;
  created_at: string;
  created_by?: TaskPerson | null;
  assignee?: TaskPerson | null;
  workflow_stage?: string;
  created_in_stage?: string;
  assignment_status?: string;
}

export interface SessionTaskAssignmentInfo {
  assignee_name: string;
  is_auto_assigned: boolean;
  reason_codes: string[];
}

export interface SessionDashboardTask {
  id: number;
  title: string;
  description: string;
  status: SessionTaskStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  deadline?: string | null;
  assignee_id?: number | null;
  assignee_name?: string | null;
  required_skills: string[];
  is_completed: boolean;
  created_at: string;
  assignment?: SessionTaskAssignmentInfo | null;
}

export interface SessionDashboardMetrics {
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  blocked_tasks: number;
  completion_rate: number;
  average_load_percent: number;
  max_active_tasks: number;
  most_loaded_participant: { id: number; full_name: string; load_percent: number; active_tasks: number } | null;
  least_loaded_participant: { id: number; full_name: string; load_percent: number; active_tasks: number } | null;
}

export interface SessionAssignmentExplanation {
  task_id: number;
  task_title: string;
  assignee_id: number;
  assignee_name: string;
  assigned_at: string;
  reasons: string[];
  auto_assigned: boolean;
}

export interface SessionAssignmentHistoryItem {
  timestamp: string;
  task_id: number;
  message: string;
  task_title: string;
  assignee_name?: string | null;
  status: SessionTaskStatus;
}

export interface SessionDashboardSnapshot {
  session_id: number;
  generated_at: string;
  participants: SessionDashboardParticipant[];
  tasks: SessionDashboardTask[];
  metrics: SessionDashboardMetrics;
  last_assignment: SessionAssignmentExplanation | null;
  history: SessionAssignmentHistoryItem[];
}

export interface ChatMessage {
  id: number;
  session_id: number;
  task_id?: number | null;
  sender_id?: number;
  sender_name: string;
  message: string;
  stage?: string;
  created_at: string;
}

export interface UserDirectory {
  id: number;
  email?: string;
  full_name: string;
  role: UserRole;
  skills?: string[];
  is_online: boolean;
  current_status: string;
  is_active?: boolean;
}

export interface Friendship {
  id: number;
  user: UserDirectory;
  status: FriendshipStatus;
  direction: 'incoming' | 'outgoing';
  created_at: string;
}

export interface Conversation {
  id: number;
  kind: ConversationKind;
  title: string;
  group_id?: number | null;
  member_names: string[];
  last_message_preview: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender_name: string;
  body: string;
  created_at: string;
}

export interface AiTaskSuggestion {
  title: string;
  description: string;
  assignee?: string | null;
  suggested_stage?: string;
}

export interface AnnouncementFeedItem {
  id: number;
  group_id: number;
  group_name: string;
  author_name: string;
  author_avatar_url?: string;
  body: string;
  created_at: string;
}

export type SessionSummaryStatus = 'draft' | 'completed' | 'skipped';

export interface SessionSummaryParticipant {
  user_id?: number | null;
  full_name: string;
  role_in_session: string;
}

export interface SessionSummaryTask {
  task_id?: number | null;
  title: string;
  assignee_id?: number | null;
  assignee_name: string;
  deadline?: string | null;
  status_at_summary: SessionTaskStatus;
  sort_order: number;
}

export interface SessionSummary {
  id: number;
  session_id: number;
  group_id: number;
  created_by_id: number;
  updated_by_id?: number | null;
  completed_work: string;
  next_steps: string;
  short_description: string;
  completion_summary?: string;
  contribution_summary?: string;
  bottleneck_summary?: string;
  collaboration_summary?: string;
  status: SessionSummaryStatus;
  remind_at?: string | null;
  participants: SessionSummaryParticipant[];
  tasks: SessionSummaryTask[];
  created_at: string;
  updated_at: string;
}

export interface SessionSummaryHistoryItem {
  session_id: number;
  session_title: string;
  session_date: string;
  summary_id: number;
  summary_status: SessionSummaryStatus;
  short_description: string;
  participants: string[];
  tasks: SessionSummaryTask[];
  remind_at?: string | null;
  updated_at: string;
}

export type GroupMaterialKind = 'pdf' | 'link';

export interface GroupMaterial {
  id: number;
  group_id: number;
  title: string;
  kind: GroupMaterialKind;
  url: string;
  file_url: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface UserProgress {
  user_id: number;
  full_name: string;
  email: string;
  sessions_attended: number;
  tasks_created: number;
  tasks_completed: number;
}

export interface UserSessionHistoryItem {
  session_id: number;
  group_id: number;
  group_name: string;
  session_title: string;
  template_key: string;
  session_date: string;
  participants: string[];
  tasks_total: number;
  tasks_completed: number;
  short_description: string;
}

export interface AdminAnalyticsOverview {
  total_users: number;
  active_users: number;
  total_groups: number;
  private_groups: number;
  total_friendships: number;
  active_sessions: number;
  completed_tasks: number;
  pending_tasks: number;
  role_distribution: Record<string, number>;
  top_groups: Array<{ id: number; name: string; member_count: number }>;
  recent_users: UserDirectory[];
}

export interface AdminGroupMember {
  user_id: number;
  full_name: string;
  email: string;
  role: UserRole;
  can_moderate: boolean;
  joined_at: string;
}

export interface AdminGroup {
  id: number;
  name: string;
  description: string;
  visibility: GroupVisibility;
  invite_key: string;
  owner_id: number;
  owner_name: string;
  member_count: number;
  active_sessions: number;
  created_at: string;
  members: AdminGroupMember[];
}
