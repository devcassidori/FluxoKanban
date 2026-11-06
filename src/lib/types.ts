export type Role = "owner" | "admin" | "member";
export type Locale = "pt-BR" | "en";

export interface Profile {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  locale: Locale;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Member {
  project_id: string;
  user_id: string;
  role: Role;
  active: boolean;
  created_at: string;
  profile: Profile;
}

export interface Invitation {
  id: string;
  project_id: string;
  email: string;
  role: Role;
  token: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  canceled_at: string | null;
}

export interface Board {
  id: string;
  project_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Column {
  id: string;
  board_id: string;
  project_id: string;
  name: string;
  position: number;
  is_done: boolean;
}

export interface Card {
  id: string;
  board_id: string;
  project_id: string;
  column_id: string;
  title: string;
  description: string;
  description_text: string;
  assignee_id: string | null;
  due_date: string | null;
  position: number;
  version: number;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface CardImage {
  id: string;
  card_id: string;
  project_id: string;
  path: string;
  mime: string;
  size_bytes: number;
  created_at: string;
}

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; detail?: string };
