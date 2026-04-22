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
  starts_at: string;
  is_active: boolean;
  livekit_room: string;
}

export interface Task {
  id: number;
  group_id: number;
  title: string;
  description: string;
  required_skills: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  deadline?: string;
  is_completed: boolean;
}

export interface ChatMessage {
  id: number;
  session_id: number;
  sender_id?: number;
  sender_name: string;
  message: string;
  created_at: string;
}

export interface AnnouncementFeedItem {
  id: number;
  group_id: number;
  group_name: string;
  author_name: string;
  body: string;
  created_at: string;
}
