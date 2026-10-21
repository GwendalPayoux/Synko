import { useRef, useState, type FormEvent } from 'react';
import { Trash2, FileText, GitBranch, MessageSquare, Paperclip, History } from 'lucide-react';
import {
  api,
  type Task,
  type Member,
  type Project,
  type User,
  today,
  shiftDate,
  statusLabels,
} from './domain';
import { Modal, Field, Badge } from './components';
import { TaskExtras } from './modules';
export function TaskEditor({
  task,
  project,
  members,
  user,
  onClose,
  onSaved,
  onError,
}: {
  task?: Task;
  project: Project;
  members: Member[];
  user: User;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (s: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [milestone, setMilestone] = useState(!!task?.milestone),
    [confirm, setConfirm] = useState(false),
    [revision, setRevision] = useState(task?.revision),
    [tab, setTab] = useState<'overview' | 'planning' | 'documents' | 'comments' | 'history'>(
      'overview',
    );
  const form = useRef<HTMLFormElement>(null);
  const full =
      user.role === 'org_admin' ||
      (user.role === 'project_manager' && project.owner_id === user.id),
    write = full || (user.role === 'contributor' && task?.assignee_id === user.id);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const b = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError('');
    try {
      const values = full
        ? {
            ...b,
            milestone,
            end_date: milestone ? b.start_date : b.end_date,
            progress: Number(b.progress),
          }
        : { status: b.status, progress: Number(b.progress) };
      await api(
        `/projects/${project.id}/tasks${task ? '/' + task.id : ''}`,
        task ? 'PATCH' : 'POST',
        { ...values, ...(task ? { revision } : {}) },
      );
      await onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setTab('overview');
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await api(`/projects/${project.id}/tasks/${task!.id}`, 'DELETE');
      await onSaved();
      onClose();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function save() {
    setTab('overview');
    requestAnimationFrame(() => form.current?.requestSubmit());
  }
  return (
    <Modal
      title={task ? 'Détail de la tâche' : 'Nouvelle tâche'}
      onClose={onClose}
      wide
      className="task-dialog"
    >
      <div className="task-context">
        <span>{project.name}</span>
        {task && <Badge status={task.status} />}
      </div>
      {task && (
        <nav className="task-dialog-tabs" aria-label="Sections de la tâche">
          {[
            { id: 'overview', label: 'Informations', icon: FileText },
            { id: 'planning', label: 'Planification', icon: GitBranch },
            { id: 'documents', label: 'Documents', icon: Paperclip },
            { id: 'comments', label: 'Discussion', icon: MessageSquare },
            { id: 'history', label: 'Historique', icon: History },
          ].map((t) => (
            <button
              type="button"
              disabled={busy}
              className={tab === t.id ? 'active' : ''}
              aria-current={tab === t.id ? 'page' : undefined}
              key={t.id}
              onClick={() => setTab(t.id as typeof tab)}
            >
              <t.icon size={16} />
              {t.label}
            </button>
          ))}
        </nav>
      )}
      <div className="task-dialog-body">
        <div hidden={tab !== 'overview'}>
          <form ref={form} onSubmit={submit}>
            <fieldset disabled={!full || busy}>
              <Field label="Titre">
                <input
                  name="title"
                  defaultValue={task?.title}
                  placeholder="Que faut-il accomplir ?"
                  required
                  maxLength={240}
                  autoFocus
                />
              </Field>
              <Field label="Description">
                <textarea
                  name="description"
                  defaultValue={task?.description}
                  rows={3}
                  maxLength={10000}
                  placeholder="Contexte et résultat attendu…"
                />
              </Field>
              <div className="form-row">
                <Field label="Responsable">
                  <select name="assignee_id" defaultValue={task?.assignee_id || ''}>
                    <option value="">Non affectée</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Priorité">
                  <select name="priority" defaultValue={task?.priority || 'normal'}>
                    <option value="low">Basse</option>
                    <option value="normal">Normale</option>
                    <option value="high">Haute</option>
                  </select>
                </Field>
              </div>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={milestone}
                  onChange={(e) => setMilestone(e.target.checked)}
                />
                Il s’agit d’un jalon
              </label>
              <div className="form-row">
                <Field label={milestone ? 'Date du jalon' : 'Début'}>
                  <input
                    name="start_date"
                    type="date"
                    defaultValue={task?.start_date || today()}
                    required
                  />
                </Field>
                {!milestone && (
                  <Field label="Échéance">
                    <input
                      name="end_date"
                      type="date"
                      defaultValue={task?.end_date || shiftDate(today(), 7)}
                      required
                    />
                  </Field>
                )}
              </div>
            </fieldset>
            <fieldset disabled={!write || busy}>
              <div className="form-row">
                <Field label="Statut">
                  <select name="status" defaultValue={task?.status || 'todo'}>
                    {['todo', 'doing', 'review', 'done'].map((id) => (
                      <option key={id} value={id}>
                        {statusLabels[id]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Progression (%)">
                  <input
                    name="progress"
                    type="number"
                    min="0"
                    max="100"
                    defaultValue={task?.progress || 0}
                    required
                  />
                </Field>
              </div>
            </fieldset>
          </form>
        </div>
        {task && (
          <TaskExtras
            task={task}
            project={project}
            user={user}
            section={tab}
            onError={onError}
            onRevision={setRevision}
          />
        )}
      </div>
      <footer className="task-dialog-footer">
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {confirm ? (
          <div className="confirm">
            <p>Supprimer définitivement « {task?.title} » ?</p>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setConfirm(false)}
            >
              Annuler
            </button>
            <button type="button" className="danger" disabled={busy} onClick={remove}>
              Confirmer la suppression
            </button>
          </div>
        ) : (
          <div className="task-footer-actions">
            {task && full && (
              <button
                type="button"
                className="icon-button danger"
                aria-label="Supprimer la tâche"
                onClick={() => setConfirm(true)}
              >
                <Trash2 size={17} />
              </button>
            )}
            <div className="spacer" />
            <button type="button" className="secondary" onClick={onClose}>
              Fermer
            </button>
            {write && (
              <button type="button" className="primary" disabled={busy} onClick={save}>
                {busy ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            )}
          </div>
        )}
      </footer>
    </Modal>
  );
}
