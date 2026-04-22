export type UserRole = 'student' | 'instructor' | 'admin';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  skills: string[];
  reliability_score: number;
  workload_limit: number;
}

export interface Group {
  id: number;
  name: string;
  description: string;
  owner_id: number;
  created_at: string;
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
}

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

export type SessionTaskStatus = 'todo' | 'in_progress' | 'done';

export interface TaskPerson {
  id: number;
  full_name: string;
}

export interface SessionParticipant {
  id: number;
  full_name: string;
  is_online: boolean;
  can_moderate: boolean;
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
}

export interface ChatMessage {
  id: number;
  session_id: number;
  sender_id?: number;
  sender_name: string;
  message: string;
  created_at: string;
}

export interface AiTaskSuggestion {
  title: string;
  description: string;
  assignee?: string | null;
}

export interface AnnouncementFeedItem {
  id: number;
  group_id: number;
  group_name: string;
  author_name: string;
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
