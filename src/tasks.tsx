import { useState, type FormEvent, type PointerEvent } from 'react';
import { Plus, Diamond, GripVertical, Trash2, ChevronRight } from 'lucide-react';
import {
  type Task,
  type Member,
  type User,
  type Project,
  api,
  statusLabels,
  displayDate,
  today,
  shiftDate,
  dayDiff,
} from './domain';
import { Avatar, Badge, Empty, Field, Modal, Progress } from './components';
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
    [milestone, setMilestone] = useState(Boolean(task?.milestone)),
    [confirmDelete, setConfirmDelete] = useState(false);
  const full =
    user.role === 'org_admin' || (user.role === 'project_manager' && project.owner_id === user.id);
  const canWrite = full || (user.role === 'contributor' && task?.assignee_id === user.id);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const b = Object.fromEntries(new FormData(e.currentTarget));
    const values = full
      ? {
          ...b,
          progress: Number(b.progress),
          milestone,
          end_date: milestone ? b.start_date : b.end_date,
        }
      : { status: b.status, progress: Number(b.progress) };
    try {
      await api(
        `/projects/${project.id}/tasks${task ? '/' + task.id : ''}`,
        task ? 'PATCH' : 'POST',
        { ...values, ...(task ? { revision: task.revision } : {}) },
      );
      await onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
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
  return (
    <Modal title={task ? 'Détail de la tâche' : 'Nouvelle tâche'} onClose={onClose}>
      <form onSubmit={submit}>
        <fieldset disabled={!full || busy}>
          <Field label="Titre">
            <input
              name="title"
              defaultValue={task?.title}
              placeholder="Que faut-il accomplir ?"
              maxLength={240}
              required
              autoFocus
            />
          </Field>
          <Field label="Description">
            <textarea
              name="description"
              rows={3}
              defaultValue={task?.description}
              placeholder="Contexte, livrable attendu…"
            />
          </Field>
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
          <Field label="Priorité">
            <select name="priority" defaultValue={task?.priority || 'normal'}>
              <option value="low">Basse</option>
              <option value="normal">Normale</option>
              <option value="high">Haute</option>
            </select>
          </Field>
        </fieldset>
        <fieldset disabled={!canWrite || busy}>
          <div className="form-row">
            <Field label="Statut">
              <select name="status" defaultValue={task?.status || 'todo'}>
                {Object.entries(statusLabels)
                  .filter(([id]) => ['todo', 'doing', 'review', 'done'].includes(id))
                  .map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Progression (%)">
              <input
                name="progress"
                type="number"
                min={0}
                max={100}
                defaultValue={task?.progress || 0}
                required
              />
            </Field>
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="modal-footer">
          {task && full && (
            <button type="button" className="danger subtle" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={16} />
              Supprimer
            </button>
          )}
          <div className="spacer" />
          <button type="button" className="secondary" onClick={onClose}>
            Fermer
          </button>
          {canWrite && (
            <button className="primary" disabled={busy}>
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          )}
        </div>
        {confirmDelete && (
          <div className="confirm">
            <p>Supprimer définitivement cette tâche ?</p>
            <button type="button" className="secondary" onClick={() => setConfirmDelete(false)}>
              Annuler
            </button>
            <button type="button" className="danger" disabled={busy} onClick={remove}>
              Confirmer la suppression
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}
export function TaskList({
  tasks,
  onTask,
  onStatus,
  canEdit,
  showProject = false,
}: {
  tasks: Task[];
  onTask: (t: Task) => void;
  onStatus: (t: Task, status: string) => void;
  canEdit: (t: Task) => boolean;
  showProject?: boolean;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Tâche</th>
            {showProject && <th>Projet</th>}
            <th>Échéance</th>
            <th>Priorité</th>
            <th>Statut</th>
            <th>Avancement</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id}>
              <td>
                <button className="task-title" onClick={() => onTask(t)}>
                  {t.milestone ? (
                    <Diamond size={14} />
                  ) : (
                    <span className={'task-dot ' + t.status} />
                  )}
                  <span>{t.title}</span>
                  <ChevronRight size={14} />
                </button>
              </td>
              {showProject && <td className="muted">{t.project_name}</td>}
              <td className={t.end_date < today() && t.status !== 'done' ? 'overdue' : ''}>
                {displayDate(t.end_date)}
              </td>
              <td>
                <span className={'priority ' + t.priority}>
                  {t.priority === 'high' ? 'Haute' : t.priority === 'low' ? 'Basse' : 'Normale'}
                </span>
              </td>
              <td>
                {canEdit(t) ? (
                  <select
                    className="inline-select"
                    aria-label={'Statut de ' + t.title}
                    value={t.status}
                    onChange={(e) => onStatus(t, e.target.value)}
                  >
                    {['todo', 'doing', 'review', 'done'].map((id) => (
                      <option key={id} value={id}>
                        {statusLabels[id]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge status={t.status} />
                )}
              </td>
              <td>
                <div className="progress-cell">
                  <Progress value={t.progress} />
                  <small>{t.progress}%</small>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Kanban({
  tasks,
  onTask,
  onStatus,
  canEdit,
}: {
  tasks: Task[];
  onTask: (t: Task) => void;
  onStatus: (t: Task, status: string) => void;
  canEdit: (t: Task) => boolean;
}) {
  const [drag, setDrag] = useState<string | null>(null);
  return (
    <div className="kanban">
      {['todo', 'doing', 'review', 'done'].map((status) => (
        <section
          key={status}
          className={'kanban-column ' + status}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e) => {
            e.preventDefault();
            const id = e.dataTransfer.getData('text/plain') || drag;
            const t = tasks.find((t) => t.id === id);
            if (t && canEdit(t) && t.status !== status) onStatus(t, status);
            setDrag(null);
          }}
        >
          <h3>
            <span className={'task-dot ' + status} />
            {statusLabels[status]}
            <span className="count">{tasks.filter((t) => t.status === status).length}</span>
          </h3>
          {tasks
            .filter((t) => t.status === status)
            .map((t) => (
              <button
                key={t.id}
                draggable={canEdit(t)}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', t.id);
                  e.dataTransfer.effectAllowed = 'move';
                  setDrag(t.id);
                }}
                onDragEnd={() => setDrag(null)}
                onClick={() => onTask(t)}
                className={'kanban-card ' + (drag === t.id ? 'dragging' : '')}
              >
                <div>
                  <span className={'priority ' + t.priority}>
                    {t.priority === 'high' ? 'Priorité haute' : t.milestone ? 'Jalon' : 'Tâche'}
                  </span>
                  <GripVertical size={14} />
                </div>
                <strong>{t.title}</strong>
                {t.description && <p>{t.description}</p>}
                <Progress value={t.progress} />
                <footer>
                  <span className={t.end_date < today() && t.status !== 'done' ? 'overdue' : ''}>
                    {displayDate(t.end_date)}
                  </span>
                  {t.assignee_name && <Avatar name={t.assignee_name} small />}
                </footer>
              </button>
            ))}
        </section>
      ))}
    </div>
  );
}
export function Gantt({
  tasks,
  onTask,
  onDates,
  canEdit,
  project,
}: {
  tasks: Task[];
  onTask: (t: Task) => void;
  onDates: (t: Task, start: string, end: string) => void;
  canEdit: (t: Task) => boolean;
  project: Project;
}) {
  const [scale, setScale] = useState(36),
    [gesture, setGesture] = useState<{
      id: string;
      x: number;
      days: number;
      resize: boolean;
    } | null>(null);
  const first = shiftDate([project.start_date, ...tasks.map((t) => t.start_date)].sort()[0], -3);
  const last = shiftDate([project.end_date, ...tasks.map((t) => t.end_date)].sort().at(-1)!, 5);
  const count = Math.max(14, Math.min(730, dayDiff(first, last) + 1));
  function down(e: PointerEvent<HTMLButtonElement>, t: Task, resize: boolean) {
    if (!canEdit(t)) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setGesture({ id: t.id, x: e.clientX, days: 0, resize });
  }
  function move(e: PointerEvent<HTMLButtonElement>) {
    if (gesture) setGesture({ ...gesture, days: Math.round((e.clientX - gesture.x) / scale) });
  }
  function up(e: PointerEvent<HTMLButtonElement>, t: Task) {
    if (!gesture) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (gesture.days) {
      const start = gesture.resize ? t.start_date : shiftDate(t.start_date, gesture.days),
        end = shiftDate(t.end_date, gesture.days);
      if (end >= start) onDates(t, start, end);
    } else if (!gesture.resize) onTask(t);
    setGesture(null);
  }
  return (
    <section className="panel gantt-panel">
      <div className="panel-head">
        <div>
          <h3>Planning du projet</h3>
          <span className="muted">
            Déplacez une barre ou ajustez son extrémité. Double-cliquez pour ouvrir.
          </span>
        </div>
        <select
          aria-label="Zoom temporel"
          value={scale}
          onChange={(e) => setScale(Number(e.target.value))}
        >
          <option value={36}>Vue détaillée</option>
          <option value={20}>Vue compacte</option>
          <option value={9}>Vue d’ensemble</option>
        </select>
      </div>
      {!tasks.length ? (
        <Empty
          title="Dessinez la suite de votre projet"
          description="Ajoutez une première tâche ou un jalon pour construire votre planning."
        />
      ) : (
        <div className="gantt-scroll">
          <div className="gantt" style={{ gridTemplateColumns: `260px ${count * scale}px` }}>
            <div className="gantt-label head">
              Tâches et jalons <span>{tasks.length}</span>
            </div>
            <div
              className="gantt-dates"
              style={{ gridTemplateColumns: `repeat(${count},${scale}px)` }}
            >
              {Array.from({ length: count }, (_, i) => shiftDate(first, i)).map((d) => (
                <span key={d} className={d === today() ? 'today' : ''}>
                  {scale >= 20
                    ? new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'narrow' })
                    : ''}
                  <b>{scale >= 20 || Number(d.slice(-2)) === 1 ? Number(d.slice(-2)) : ''}</b>
                </span>
              ))}
            </div>
            {tasks.map((t) => {
              const delta = gesture?.id === t.id ? gesture.days : 0,
                left =
                  (dayDiff(first, t.start_date) +
                    (gesture?.id === t.id && !gesture.resize ? delta : 0)) *
                  scale,
                width = Math.max(
                  scale,
                  (dayDiff(t.start_date, t.end_date) +
                    1 +
                    (gesture?.id === t.id && gesture.resize ? delta : 0)) *
                    scale,
                );
              return (
                <div className="gantt-row" key={t.id}>
                  <button className="gantt-label" onClick={() => onTask(t)}>
                    {t.milestone ? (
                      <Diamond size={14} />
                    ) : (
                      <span className={'task-dot ' + t.status} />
                    )}
                    <span>{t.title}</span>
                    {t.assignee_name && <Avatar name={t.assignee_name} small />}
                  </button>
                  <div className="gantt-track" style={{ backgroundSize: `${scale}px 100%` }}>
                    {dayDiff(first, today()) >= 0 && (
                      <i
                        className="today-line"
                        style={{ left: dayDiff(first, today()) * scale + scale / 2 }}
                      />
                    )}
                    <button
                      aria-label={t.title + ' : déplacer avec les flèches gauche ou droite'}
                      className={'gantt-bar ' + t.status + (t.milestone ? ' diamond' : '')}
                      style={{ left, width: t.milestone ? 24 : width - 4 }}
                      onPointerDown={(e) => down(e, t, false)}
                      onPointerMove={move}
                      onPointerUp={(e) => up(e, t)}
                      onPointerCancel={() => setGesture(null)}
                      onDoubleClick={() => onTask(t)}
                      onClick={() => {
                        if (!canEdit(t)) onTask(t);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onTask(t);
                        if (canEdit(t) && ['ArrowLeft', 'ArrowRight'].includes(e.key)) {
                          e.preventDefault();
                          const n = e.key === 'ArrowLeft' ? -1 : 1;
                          onDates(t, shiftDate(t.start_date, n), shiftDate(t.end_date, n));
                        }
                      }}
                    >
                      {!t.milestone && (
                        <>
                          <span className="gantt-fill" style={{ width: t.progress + '%' }} />
                          <span className="bar-label">{t.title}</span>
                        </>
                      )}
                    </button>
                    {!t.milestone && canEdit(t) && (
                      <button
                        aria-label={'Redimensionner ' + t.title}
                        className="gantt-resize"
                        style={{ left: left + width - 12 }}
                        onPointerDown={(e) => down(e, t, true)}
                        onPointerMove={move}
                        onPointerUp={(e) => up(e, t)}
                        onPointerCancel={() => setGesture(null)}
                        onKeyDown={(e) => {
                          if (['ArrowLeft', 'ArrowRight'].includes(e.key)) {
                            e.preventDefault();
                            const end = shiftDate(t.end_date, e.key === 'ArrowLeft' ? -1 : 1);
                            if (end >= t.start_date) onDates(t, t.start_date, end);
                          }
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <footer className="gantt-footer">
        <span>
          <i className="legend-dot" />
          Aujourd’hui
        </span>
        <span>
          <Diamond size={12} />
          Jalon
        </span>
        <span>
          {tasks.length} tâche{tasks.length > 1 ? 's' : ''} ·{' '}
          {tasks.filter((t) => t.status === 'done').length} terminée
          {tasks.filter((t) => t.status === 'done').length > 1 ? 's' : ''}
        </span>
      </footer>
    </section>
  );
}
export function AddTaskButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="primary" onClick={onClick}>
      <Plus size={17} />
      Nouvelle tâche
    </button>
  );
}
