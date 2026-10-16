export type User = {
  id: string;
  name: string;
  email: string;
  org_id: string;
  org_name: string;
  role: string;
  permissions: string[];
};
export type Project = {
  id: string;
  name: string;
  description: string;
  owner_name: string;
  owner_id: string;
  start_date: string;
  end_date: string;
  status: string;
  budget_cents: number;
  color: string;
  progress: number;
  task_count: number;
};
export type Task = {
  id: string;
  project_id: string;
  project_name?: string;
  title: string;
  description: string;
  assignee_id: string | null;
  assignee_name?: string;
  start_date: string;
  end_date: string;
  status: string;
  priority: string;
  progress: number;
  milestone: number;
  revision: number;
};
export type Member = { id: string; name: string; email: string; role: string };
export type Document = {
  id: string;
  name: string;
  version_id: string;
  version: number;
  size: number;
  updated_at: string;
};
export type Version = {
  id: string;
  version: number;
  size: number;
  sha256: string;
  created_at: string;
};
export type Activity = { id: string; action: string; actor_name: string; created_at: string };
export const statusLabels: Record<string, string> = {
  todo: 'À faire',
  doing: 'En cours',
  review: 'À valider',
  done: 'Terminée',
  active: 'En cours',
  paused: 'En pause',
  completed: 'Clôturé',
};
export const roleLabels: Record<string, string> = {
  org_admin: 'Administrateur entreprise',
  project_manager: 'Chef de projet',
  pmo: 'PMO',
  contributor: 'Contributeur',
  reader: 'Lecteur / Client',
};
export function today() {
  return new Date().toLocaleDateString('en-CA');
}
export function shiftDate(value: string, days: number) {
  const d = new Date(value + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA');
}
export function dayDiff(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}
export function displayDate(value: string) {
  return new Date(value + 'T12:00:00').toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}
export async function api<T = unknown>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const res = await fetch('/api' + path, {
    method,
    headers: data ? { 'Content-Type': 'application/json' } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || 'La requête a échoué.');
  return result;
}
