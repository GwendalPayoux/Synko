import { ProjectIconPicker } from './project-icons';
import { useEffect, useState, type FormEvent } from 'react';
import {
  api,
  type Project,
  type User,
  type Member,
  type Task,
  today,
  roleLabels,
  displayDate,
} from './domain';
import { Field, Modal, Empty } from './components';
type Props = {
  project: Project;
  user: User;
  onError: (s: string) => void;
  onSaved: () => Promise<void>;
};
type Comment = { id: string; body: string; author_name: string; created_at: string };
export type Notice = {
  id: string;
  title: string;
  project_id: string;
  project_name: string;
  entity_id: string;
  read_at: string | null;
  created_at: string;
};
const money = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n / 100);
const form = (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  return Object.fromEntries(new FormData(e.currentTarget));
};
const fail = (e: unknown, fn: (s: string) => void) => fn((e as Error).message);
export function ProjectSettings({
  project,
  user,
  members,
  onError,
  onSaved,
}: { members: Member[] } & Props) {
  const [icon, setIcon] = useState(project.icon || 'folder');
  const [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false);
  const canWrite =
    user.role === 'org_admin' || (user.role === 'project_manager' && project.owner_id === user.id);
  async function save(e: FormEvent<HTMLFormElement>) {
    const b = form(e);
    setBusy(true);
    try {
      await api(`/projects/${project.id}`, 'PATCH', b);
      await onSaved();
    } catch (e) {
      fail(e, onError);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel settings-panel">
      <h3>Informations et cycle de vie</h3>
      <form onSubmit={save}>
        <fieldset disabled={!canWrite || busy}>
          <Field label="Nom du projet">
            <input name="name" defaultValue={project.name} required maxLength={160} />
          </Field>
          <Field label="Description">
            <textarea name="description" defaultValue={project.description} maxLength={2000} />
          </Field>
          <div className="form-row">
            <Field label="Début du projet">
              <input type="date" name="start_date" defaultValue={project.start_date} required />
            </Field>
            <Field label="Fin du projet">
              <input type="date" name="end_date" defaultValue={project.end_date} required />
            </Field>
          </div>
          <Field label="Responsable du projet">
            <select name="owner_id" defaultValue={project.owner_id}>
              {members
                .filter((m) => ['org_admin', 'project_manager'].includes(m.role))
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </Field>
          <div className="form-row">
            <Field label="Statut du projet">
              <select name="status" defaultValue={project.status}>
                <option value="active">En cours</option>
                <option value="paused">En pause</option>
                <option value="completed">Clôturé</option>
              </select>
            </Field>
            <Field label="Couleur">
              <select name="color" defaultValue={project.color}>
                <option value="sage">Sauge</option>
                <option value="blue">Ardoise</option>
                <option value="clay">Terracotta</option>
                <option value="violet">Lavande</option>
              </select>
            </Field>
          </div>
          <ProjectIconPicker value={icon} onChange={setIcon} />
          <button className="primary">Enregistrer les informations</button>
        </fieldset>
      </form>
      {canWrite && (
        <>
          <hr />
          <button className="secondary" onClick={() => setConfirm(true)}>
            {project.archived_at ? 'Restaurer le projet' : 'Archiver le projet'}
          </button>
          {confirm && (
            <div className="confirm">
              <p>
                {project.archived_at
                  ? 'Rendre ce projet actif dans le portefeuille ?'
                  : 'Masquer ce projet du portefeuille actif ? Les données seront conservées.'}
              </p>
              <button className="secondary" onClick={() => setConfirm(false)}>
                Annuler
              </button>
              <button
                className="primary"
                onClick={async () => {
                  try {
                    await api(`/projects/${project.id}`, 'PATCH', {
                      archived: !project.archived_at,
                    });
                    await onSaved();
                    setConfirm(false);
                  } catch (e) {
                    fail(e, onError);
                  }
                }}
              >
                Confirmer
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
export function Budget({ project, user, onError, onSaved }: Props) {
  type Entry = {
    id: string;
    label: string;
    category: string;
    kind: string;
    amount_cents: number;
    entry_date: string;
  };
  type Revision = { id: string; amount_cents: number; reason: string; created_at: string };
  type Data = { summary: Record<string, number>; entries: Entry[]; revisions: Revision[] };
  const [data, setData] = useState<Data | null>(null),
    [modal, setModal] = useState(''),
    [busy, setBusy] = useState(false);
  const base = `/projects/${project.id}/budget`,
    write =
      user.role === 'org_admin' ||
      (user.role === 'project_manager' && project.owner_id === user.id);
  async function load() {
    setData(await api<Data>(base));
  }
  useEffect(() => {
    load().catch((e) => onError(e.message));
  }, [project.id]);
  async function save(e: FormEvent<HTMLFormElement>) {
    const b = form(e);
    setBusy(true);
    try {
      await api(base + (modal === 'revision' ? '/revisions' : '/entries'), 'POST', {
        ...b,
        amount_cents: Math.round(Number(b.amount) * 100),
      });
      await load();
      await onSaved();
      setModal('');
    } catch (e) {
      fail(e, onError);
    } finally {
      setBusy(false);
    }
  }
  if (!data) return <p className="loading">Chargement du budget…</p>;
  return (
    <>
      <div className="metric-grid">
        {[
          ['revised_cents', 'Budget révisé'],
          ['actual_cents', 'Dépenses réelles'],
          ['commitment_cents', 'Engagements'],
          ['projected_cents', 'Coût à terminaison'],
        ].map(([k, label]) => (
          <section className="panel metric" key={k}>
            <span>{label}</span>
            <strong>{money(data.summary[k])}</strong>
          </section>
        ))}
      </div>
      <div
        className={'budget-alert ' + (data.summary.variance_cents < 0 ? 'error' : '')}
        role="status"
      >
        {data.summary.variance_cents < 0 ? 'Dépassement prévisionnel' : 'Marge prévisionnelle'} :{' '}
        {money(Math.abs(data.summary.variance_cents))}. Budget initial :{' '}
        {money(data.summary.initial_cents)}. Prévisions complémentaires :{' '}
        {money(data.summary.forecast_cents)}.
      </div>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h3>Écritures budgétaires</h3>
            <span className="muted">
              Réel + engagements non payés + prévisions complémentaires = coût à terminaison.
            </span>
          </div>
          {write && (
            <div className="row-actions">
              <button className="secondary" onClick={() => setModal('revision')}>
                Réviser le budget
              </button>
              <button className="primary" onClick={() => setModal('entry')}>
                Ajouter une écriture
              </button>
            </div>
          )}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Libellé</th>
                <th>Catégorie</th>
                <th>Date</th>
                <th>Montant</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e) => (
                <tr key={e.id}>
                  <td>{e.label}</td>
                  <td>{e.category}</td>
                  <td>{displayDate(e.entry_date)}</td>
                  <td>{money(e.amount_cents)}</td>
                  <td>
                    <select
                      aria-label={'Type de ' + e.label}
                      disabled={!write}
                      value={e.kind}
                      onChange={async (ev) => {
                        try {
                          await api(`${base}/entries/${e.id}`, 'PATCH', { kind: ev.target.value });
                          await load();
                          await onSaved();
                        } catch (e) {
                          fail(e, onError);
                        }
                      }}
                    >
                      <option value="actual">Réel</option>
                      <option value="commitment">Engagement</option>
                      <option value="forecast">Prévision complémentaire</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.entries.length && (
          <Empty
            title="Un budget prêt à suivre la réalité"
            description="Ajoutez vos dépenses, engagements ou prévisions complémentaires."
          />
        )}
        <div className="settings-panel">
          <h3>Répartition des dépenses réelles</h3>
          {Array.from(new Set(data.entries.map((e) => e.category))).map((category) => (
            <p key={category}>
              {category} :{' '}
              {money(
                data.entries
                  .filter((e) => e.category === category && e.kind === 'actual')
                  .reduce((s, e) => s + e.amount_cents, 0),
              )}
            </p>
          ))}
          <hr />
          <h3>Historique des révisions</h3>
          {data.revisions.map((r) => (
            <p key={r.id}>
              {money(r.amount_cents)} · {r.reason} ·{' '}
              {new Date(r.created_at).toLocaleString('fr-FR')}
            </p>
          ))}
        </div>
      </section>
      {modal && (
        <Modal
          title={modal === 'revision' ? 'Réviser le budget' : 'Nouvelle écriture'}
          onClose={() => setModal('')}
        >
          <form onSubmit={save}>
            {modal === 'revision' ? (
              <Field label="Motif de la révision">
                <textarea name="reason" required maxLength={1000} />
              </Field>
            ) : (
              <>
                <Field label="Libellé">
                  <input name="label" required maxLength={200} />
                </Field>
                <Field label="Catégorie">
                  <input
                    name="category"
                    required
                    maxLength={100}
                    placeholder="Ex. Prestations, équipement…"
                  />
                </Field>
                <Field label="Type d’écriture">
                  <select name="kind">
                    <option value="actual">Dépense réelle</option>
                    <option value="commitment">Engagement non payé</option>
                    <option value="forecast">Prévision complémentaire</option>
                  </select>
                </Field>
                <Field label="Date de l’écriture">
                  <input type="date" name="entry_date" defaultValue={today()} required />
                </Field>
              </>
            )}
            <Field label="Montant (€)">
              <input name="amount" type="number" step="0.01" min="0" max="1000000000" required />
            </Field>
            <button className="primary" disabled={busy}>
              Enregistrer
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function NotificationCenter({
  items,
  onRefresh,
  onOpen,
  onError,
}: {
  items: Notice[];
  onRefresh: () => Promise<void>;
  onOpen: (notice: Notice) => Promise<void>;
  onError: (s: string) => void;
}) {
  const [opening, setOpening] = useState<string | null>(null);
  return (
    <section className="notification-popover panel">
      <h3>Notifications</h3>
      <p className="muted">{items.filter((n) => !n.read_at).length} non lues</p>
      <div className="notification-list">
        {items.map((n) => (
          <article className={!n.read_at ? 'unread' : ''} key={n.id}>
            <button
              disabled={!!opening}
              onClick={async () => {
                setOpening(n.id);
                try {
                  await onOpen(n);
                } catch (e) {
                  fail(e, onError);
                } finally {
                  setOpening(null);
                }
              }}
            >
              <strong>{opening === n.id ? 'Ouverture…' : n.title}</strong>
              <small>
                {n.project_name} · {new Date(n.created_at).toLocaleString('fr-FR')}
              </small>
            </button>
            <button
              className="link"
              onClick={async () => {
                try {
                  await api(`/notifications/${n.id}`, 'PATCH', { read: !n.read_at });
                  await onRefresh();
                } catch (e) {
                  fail(e, onError);
                }
              }}
            >
              {n.read_at ? 'Marquer non lue' : 'Marquer lue'}
            </button>
          </article>
        ))}
      </div>
      {!items.length && <p>Aucune notification.</p>}
    </section>
  );
}
export function TeamManagement({
  project,
  user,
  onError,
  onSaved,
  members,
}: Props & { members: Member[] }) {
  const [load, setLoad] = useState<
      {
        id: string;
        name: string;
        remaining_hours: number;
        task_count: number;
        weekly_hours: number;
        available_hours: number;
        overloaded: boolean;
      }[]
    >([]),
    [remove, setRemove] = useState<Member | null>(null);
  useEffect(() => {
    api<typeof load>(`/projects/${project.id}/workload`)
      .then(setLoad)
      .catch((e) => onError(e.message));
  }, [project.id, members]);
  const write =
    user.role === 'org_admin' || (user.role === 'project_manager' && project.owner_id === user.id);
  return (
    <section className="panel settings-panel">
      <h3>Charge restante estimée</h3>
      <p className="muted">
        Charge restante estimée sur ce projet. La semaine glissante tient compte des capacités et
        des indisponibilités déclarées, sur cinq jours ouvrés.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Collaborateur</th>
              <th>Tâches</th>
              <th>Heures restantes</th>
              <th>7 prochains jours / capacité</th>
              <th>Accès</th>
            </tr>
          </thead>
          <tbody>
            {load.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{m.task_count}</td>
                <td>{Math.round(m.remaining_hours * 10) / 10} h</td>
                <td className={m.overloaded ? 'overdue' : ''}>
                  {m.weekly_hours} h / {m.available_hours} h {m.overloaded ? '· Surcharge' : ''}
                </td>
                <td>
                  {write && m.id !== project.owner_id && (
                    <button
                      className="link danger"
                      onClick={() => setRemove(members.find((x) => x.id === m.id) || null)}
                    >
                      Retirer du projet
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {remove && (
        <div className="confirm">
          <p>
            Retirer {remove.name} ? Ses tâches seront désaffectées et ses validations en attente
            refusées avec un motif tracé.
          </p>
          <button className="secondary" onClick={() => setRemove(null)}>
            Annuler
          </button>
          <button
            className="primary"
            onClick={async () => {
              try {
                await api(`/projects/${project.id}/members/${remove.id}`, 'DELETE');
                await onSaved();
                setRemove(null);
              } catch (e) {
                fail(e, onError);
              }
            }}
          >
            Confirmer le retrait
          </button>
        </div>
      )}
    </section>
  );
}
export type EventItem = {
  id: string;
  project_id: string;
  project_name: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  kind: string;
};
export function EventsPanel({
  projects,
  user,
  onError,
  onSaved,
  openRequest = 0,
  headerAction,
}: {
  projects: Project[];
  user: User;
  onError: (s: string) => void;
  onSaved: () => Promise<void>;
  openRequest?: number;
  headerAction?: boolean;
}) {
  const [events, setEvents] = useState<EventItem[]>([]),
    [modal, setModal] = useState(false),
    [filter, setFilter] = useState('all'),
    [kind, setKind] = useState('all'),
    [deleting, setDeleting] = useState<EventItem | null>(null),
    [busy, setBusy] = useState(false);
  async function load() {
    setEvents(await api<EventItem[]>('/events'));
  }
  useEffect(() => {
    load().catch((e) => onError(e.message));
  }, [projects]);
  const writable = projects.filter(
    (p) => user.role === 'org_admin' || (user.role === 'project_manager' && p.owner_id === user.id),
  );
  useEffect(() => {
    if (openRequest > 0) setModal(true);
  }, [openRequest]);
  async function save(e: FormEvent<HTMLFormElement>) {
    const b = form(e);
    setBusy(true);
    try {
      await api(`/projects/${b.project_id}/events`, 'POST', b);
      await load();
      await onSaved();
      setModal(false);
    } catch (e) {
      fail(e, onError);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel events-panel">
      <div className="panel-head">
        <div>
          <h3>Événements transversaux</h3>
          <span className="muted">
            Réunions, livraisons et dates importantes des projets accessibles
          </span>
        </div>
        {!headerAction && writable.length > 0 && (
          <button className="primary" onClick={() => setModal(true)}>
            Nouvel événement
          </button>
        )}
      </div>
      <div className="toolbar module-toolbar">
        <select
          aria-label="Filtrer les événements par projet"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Tous les projets</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrer les événements par type"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="all">Tous les types</option>
          <option value="meeting">Réunions</option>
          <option value="delivery">Livraisons</option>
          <option value="deadline">Échéances</option>
          <option value="event">Autres événements</option>
        </select>
      </div>
      <div className="agenda">
        {events
          .filter(
            (e) =>
              (filter === 'all' || e.project_id === filter) && (kind === 'all' || e.kind === kind),
          )
          .map((e) => (
            <article key={e.id}>
              <strong>{e.title}</strong>
              <p>
                {e.project_name} · {displayDate(e.start_date)} — {displayDate(e.end_date)}
              </p>
              <p className="muted">{e.description}</p>
              {writable.some((p) => p.id === e.project_id) && (
                <button className="link danger" onClick={() => setDeleting(e)}>
                  Supprimer
                </button>
              )}
            </article>
          ))}
      </div>
      {modal && (
        <Modal title="Nouvel événement" onClose={() => setModal(false)}>
          <form onSubmit={save}>
            <Field label="Projet de l’événement">
              <select name="project_id">
                {writable.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Titre de l’événement">
              <input name="title" required maxLength={240} />
            </Field>
            <Field label="Description">
              <textarea name="description" maxLength={2000} />
            </Field>
            <div className="form-row">
              <Field label="Début">
                <input type="date" name="start_date" defaultValue={today()} required />
              </Field>
              <Field label="Fin">
                <input type="date" name="end_date" defaultValue={today()} required />
              </Field>
            </div>
            <Field label="Type">
              <select name="kind">
                <option value="meeting">Réunion</option>
                <option value="delivery">Livraison</option>
                <option value="deadline">Échéance</option>
                <option value="event">Autre événement</option>
              </select>
            </Field>
            <button className="primary" disabled={busy}>
              Enregistrer l’événement
            </button>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal title="Supprimer cet événement ?" onClose={() => setDeleting(null)}>
          <p>{deleting.title}</p>
          <button
            className="danger"
            onClick={async () => {
              try {
                await api(`/projects/${deleting.project_id}/events/${deleting.id}`, 'DELETE');
                await load();
                await onSaved();
                setDeleting(null);
              } catch (e) {
                fail(e, onError);
              }
            }}
          >
            Confirmer la suppression
          </button>
        </Modal>
      )}
    </section>
  );
}
export function Templates({
  project,
  onError,
  onSaved,
  onCreated,
}: {
  project?: Project;
  onError: (s: string) => void;
  onSaved: () => Promise<void>;
  onCreated: (id: string) => void;
}) {
  const [items, setItems] = useState<{ id: string; name: string; description: string }[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    api<typeof items>('/templates')
      .then(setItems)
      .catch((e) => onError(e.message));
  }, [project]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    const b = form(e);
    setBusy(true);
    try {
      if (project) {
        await api(`/projects/${project.id}/template`, 'POST', b);
        await onSaved();
        setMessage('Modèle enregistré dans votre entreprise.');
      } else if (selected) {
        const p = await api<{ id: string }>(`/templates/${selected}/instantiate`, 'POST', b);
        await onSaved();
        onCreated(p.id);
      }
      setSelected(null);
    } catch (e) {
      fail(e, onError);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel settings-panel">
      <div className="section-heading">
        <h3>{project ? 'Standardiser ce projet' : 'Modèles de projets'}</h3>
        {project && (
          <button className="secondary" onClick={() => setSelected('save')}>
            Enregistrer comme modèle
          </button>
        )}
      </div>
      <p className="muted">
        Structure des tâches, sous-tâches, dépendances, charges et dossiers. Les personnes, budgets,
        fichiers et discussions ne sont pas copiés.
      </p>
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      {!project && (
        <div className="template-grid">
          {items.map((t) => (
            <button className="secondary" key={t.id} onClick={() => setSelected(t.id)}>
              {t.name}
            </button>
          ))}
          {!items.length && <p>Enregistrez un projet comme modèle depuis ses paramètres.</p>}
        </div>
      )}
      {selected && (
        <Modal
          title={project ? 'Enregistrer un modèle' : 'Créer depuis un modèle'}
          onClose={() => setSelected(null)}
        >
          <form onSubmit={submit}>
            <Field label={project ? 'Nom du modèle' : 'Nom du nouveau projet'}>
              <input name="name" required maxLength={160} />
            </Field>
            {!project && (
              <Field label="Début du nouveau projet">
                <input name="start_date" type="date" defaultValue={today()} required />
              </Field>
            )}
            <button className="primary" disabled={busy}>
              Créer
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
export function OrganizationRoles({
  members,
  user,
  onError,
  onSaved,
}: {
  members: Member[];
  user: User;
  onError: (s: string) => void;
  onSaved: () => Promise<void>;
}) {
  const [pending, setPending] = useState<{ member: Member; role: string } | null>(null);
  return (
    <>
      <div className="role-list">
        {members.map((m) => (
          <div className="org-member" key={m.id}>
            <div>
              <strong>{m.name}</strong>
              <small>{m.email}</small>
            </div>
            <select
              aria-label={'Rôle de ' + m.name}
              value={m.role}
              disabled={user.role !== 'org_admin'}
              onChange={(e) => setPending({ member: m, role: e.target.value })}
            >
              {Object.entries(roleLabels).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      {pending && (
        <Modal title="Modifier les droits d’accès ?" onClose={() => setPending(null)}>
          <p>
            {pending.member.name} deviendra {roleLabels[pending.role]}.
          </p>
          <button
            className="primary"
            onClick={async () => {
              try {
                await api(`/members/${pending.member.id}`, 'PATCH', { role: pending.role });
                await onSaved();
                setPending(null);
              } catch (e) {
                fail(e, onError);
              }
            }}
          >
            Confirmer le changement de rôle
          </button>
        </Modal>
      )}
    </>
  );
}
export function Sessions({ onError }: { onError: (s: string) => void }) {
  const [items, setItems] = useState<{ id: string; expires_at: number; current: boolean }[]>([]);
  async function load() {
    setItems(await api<typeof items>('/sessions'));
  }
  useEffect(() => {
    load().catch((e) => onError(e.message));
  }, []);
  return (
    <div className="session-list">
      {items.map((s) => (
        <div key={s.id}>
          <span>
            {s.current ? 'Session actuelle' : 'Autre session'} · expire le{' '}
            {new Date(s.expires_at).toLocaleString('fr-FR')}
          </span>
          {!s.current && (
            <button
              className="link danger"
              onClick={async () => {
                try {
                  await api(`/sessions/${s.id}`, 'DELETE');
                  await load();
                } catch (e) {
                  fail(e, onError);
                }
              }}
            >
              Révoquer
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
export function TaskExtras({
  task,
  project,
  user,
  onError,
  onRevision,
  section = 'all',
}: {
  task: Task;
  project: Project;
  user: User;
  onError: (s: string) => void;
  onRevision: (n: number) => void;
  section?: 'all' | 'overview' | 'planning' | 'documents' | 'comments' | 'history';
}) {
  type Detail = {
    task: Task;
    tasks: { id: string; title: string; parent_id: string | null }[];
    dependencies: { predecessor_id: string }[];
    comments: Comment[];
    attachments: { id: string; name: string }[];
    history: { id: string; action: string; actor_name: string; created_at: string }[];
  };
  const [data, setData] = useState<Detail | null>(null),
    [docs, setDocs] = useState<{ id: string; name: string }[]>([]),
    [busy, setBusy] = useState(false);
  const base = `/projects/${project.id}/tasks/${task.id}`,
    write =
      user.role === 'org_admin' ||
      (user.role === 'project_manager' && project.owner_id === user.id);
  async function load() {
    const d = await api<Detail>(base + '/details');
    setData(d);
    onRevision(d.task.revision);
  }
  useEffect(() => {
    load().catch((e) => onError(e.message));
    api<typeof docs>(`/projects/${project.id}/documents`)
      .then(setDocs)
      .catch((e) => onError(e.message));
  }, [task.id]);
  async function relations(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await api(base + '/details', 'PATCH', {
        parent_id: fd.get('parent_id'),
        effort_hours: Number(fd.get('effort_hours')),
        predecessor_ids: fd.getAll('predecessor_ids'),
        revision: data!.task.revision,
      });
      await load();
    } catch (e) {
      fail(e, onError);
    } finally {
      setBusy(false);
    }
  }
  if (!data) return <p className="loading">Chargement des détails…</p>;
  return (
    <div className="task-extras">
      {(section === 'all' || section === 'planning') && (
        <>
          <h3>Sous-tâches, dépendances et charge</h3>
          <form onSubmit={relations}>
            <fieldset disabled={!write || busy}>
              <Field label="Tâche parente">
                <select name="parent_id" defaultValue={data.task.parent_id || ''}>
                  <option value="">Aucune (tâche principale)</option>
                  {data.tasks
                    .filter((t) => t.id !== task.id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Charge estimée (heures)">
                <input
                  name="effort_hours"
                  type="number"
                  min="0"
                  max="10000"
                  defaultValue={data.task.effort_hours ?? 8}
                  required
                />
              </Field>
              <Field label="Prédécesseurs (sélection multiple)">
                <select
                  multiple
                  name="predecessor_ids"
                  defaultValue={data.dependencies.map((d) => d.predecessor_id)}
                >
                  {data.tasks
                    .filter((t) => t.id !== task.id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                </select>
              </Field>
              <p className="muted small-text">
                Une dépendance fin-début signale les chevauchements. Aucun décalage automatique des
                dates.
              </p>
              {write && <button className="secondary">Enregistrer les relations</button>}
            </fieldset>
          </form>
          <p className="small-text">
            Sous-tâches :{' '}
            {data.tasks
              .filter((t) => t.parent_id === task.id)
              .map((t) => t.title)
              .join(', ') || 'Aucune'}
          </p>
        </>
      )}
      {(section === 'all' || section === 'documents') && (
        <>
          <h3>Documents liés</h3>
          {data.attachments.map((d) => (
            <p key={d.id}>{d.name}</p>
          ))}
          {user.permissions.includes('document:write') && (
            <form
              onSubmit={async (e) => {
                const b = form(e);
                try {
                  await api(base + '/attachments', 'POST', b);
                  await load();
                } catch (e) {
                  fail(e, onError);
                }
              }}
            >
              <Field label="Document à joindre">
                <select name="document_id" required>
                  <option value="">Sélectionner un document du projet</option>
                  {docs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
              <button className="secondary">Joindre le document</button>
            </form>
          )}
        </>
      )}
      {(section === 'all' || section === 'comments') && (
        <>
          <h3>Commentaires</h3>
          <Comments
            items={data.comments}
            onError={onError}
            canWrite={user.role !== 'reader'}
            path={base + '/comments'}
            refresh={load}
          />
        </>
      )}
      {(section === 'all' || section === 'history') && (
        <>
          <h3>Historique de la tâche</h3>
          {data.history.map((a) => (
            <p className="small-text" key={a.id}>
              {a.action} · {a.actor_name} · {new Date(a.created_at).toLocaleString('fr-FR')}
            </p>
          ))}
        </>
      )}
    </div>
  );
}
export function Comments({
  items,
  canWrite,
  path,
  refresh,
  onError,
}: {
  items: Comment[];
  canWrite: boolean;
  path: string;
  refresh: () => Promise<void>;
  onError: (s: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="comments">
      {items.map((c) => (
        <article key={c.id}>
          <strong>{c.author_name}</strong>
          <small>{new Date(c.created_at).toLocaleString('fr-FR')}</small>
          <p>{c.body}</p>
        </article>
      ))}
      {!items.length && <p className="muted">Aucun commentaire pour le moment.</p>}
      {canWrite && (
        <form
          onSubmit={async (e) => {
            const target = e.currentTarget,
              b = form(e);
            setBusy(true);
            try {
              await api(path, 'POST', b);
              await refresh();
              target.reset();
            } catch (e) {
              fail(e, onError);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Ajouter un commentaire">
            <textarea name="body" required maxLength={10000} />
          </Field>
          <button className="secondary" disabled={busy}>
            Publier
          </button>
        </form>
      )}
    </div>
  );
}
export type Folder = { id: string; name: string; parent_id: string | null };
export function DocumentDetails({
  documentId,
  project,
  user,
  folders,
  onError,
  onChanged,
  section = 'all',
}: {
  documentId: string;
  project: Project;
  user: User;
  folders: Folder[];
  onError: (s: string) => void;
  onChanged: () => Promise<void>;
  section?: 'all' | 'info' | 'approvals' | 'comments';
}) {
  type Approval = {
    id: string;
    reviewer_id: string;
    reviewer_name: string;
    version: number;
    status: string;
    reason: string;
    created_at: string;
    decided_at: string | null;
  };
  type Detail = {
    document: {
      name: string;
      folder_id: string | null;
      audience: string;
      archived_at: string | null;
    };
    comments: Comment[];
    approvals: Approval[];
  };
  const [data, setData] = useState<Detail | null>(null),
    [members, setMembers] = useState<Member[]>([]),
    [preview, setPreview] = useState<string | null>(null),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false);
  const base = `/projects/${project.id}/documents/${documentId}`,
    write =
      user.role === 'org_admin' ||
      (user.role === 'project_manager' && project.owner_id === user.id);
  async function load() {
    setData(await api<Detail>(base + '/details'));
  }
  useEffect(() => {
    load().catch((e) => onError(e.message));
    api<Member[]>(`/projects/${project.id}/members`)
      .then(setMembers)
      .catch((e) => onError(e.message));
  }, [documentId]);
  async function save(e: FormEvent<HTMLFormElement>) {
    const b = form(e);
    setBusy(true);
    try {
      await api(base, 'PATCH', b);
      await load();
      await onChanged();
    } catch (e) {
      fail(e, onError);
    } finally {
      setBusy(false);
    }
  }
  if (!data) return <p className="loading">Chargement…</p>;
  return (
    <div className="document-details">
      {(section === 'all' || section === 'info') && (
        <>
          <h3>Métadonnées et partage</h3>
          <form onSubmit={save}>
            <fieldset disabled={!write || busy}>
              <Field label="Nom du document">
                <input name="name" defaultValue={data.document.name} required maxLength={180} />
              </Field>
              <Field label="Dossier du document">
                <select name="folder_id" defaultValue={data.document.folder_id || ''}>
                  <option value="">Racine</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Partage du document">
                <select name="audience" defaultValue={data.document.audience}>
                  <option value="project">Tous les membres du projet</option>
                  <option value="internal">Équipe interne uniquement</option>
                </select>
              </Field>
              {write && <button className="secondary">Enregistrer les métadonnées</button>}
            </fieldset>
          </form>
          {write && (
            <>
              <button className="link danger" onClick={() => setConfirm(true)}>
                {data.document.archived_at ? 'Désarchiver le document' : 'Archiver le document'}
              </button>
              {confirm && (
                <div className="confirm">
                  <p>
                    Confirmer{' '}
                    {data.document.archived_at
                      ? 'la restauration dans la liste active'
                      : 'l’archivage'}{' '}
                    de ce document ? Les versions seront conservées.
                  </p>
                  <button className="secondary" onClick={() => setConfirm(false)}>
                    Annuler
                  </button>
                  <button
                    className="primary"
                    onClick={async () => {
                      try {
                        await api(base, 'PATCH', { archived: !data.document.archived_at });
                        await load();
                        await onChanged();
                        setConfirm(false);
                      } catch (e) {
                        fail(e, onError);
                      }
                    }}
                  >
                    Confirmer
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
      {section === 'all' && (
        <>
          <hr />
          <h3>Aperçu</h3>
          <button
            className="secondary"
            onClick={async () => {
              try {
                setPreview((await api<{ content: string }>(base + '/preview')).content);
              } catch (e) {
                fail(e, onError);
              }
            }}
          >
            Lire l’aperçu texte
          </button>
          <p className="muted small-text">
            TXT, Markdown, CSV, JSON et logs, jusqu’à 1 Mo. Les autres formats se téléchargent.
          </p>
          {preview !== null && <pre className="text-preview">{preview}</pre>}
        </>
      )}
      {(section === 'all' || section === 'approvals') && (
        <>
          <h3>Validations documentaires</h3>
          {data.approvals.map((a) => (
            <article className="approval" key={a.id}>
              <strong>
                Version {a.version} · {a.reviewer_name}
              </strong>
              <p>
                {a.status === 'pending'
                  ? 'En attente'
                  : a.status === 'approved'
                    ? 'Approuvée'
                    : 'Refusée'}{' '}
                · {new Date(a.created_at).toLocaleString('fr-FR')}
              </p>
              {a.reason && <p>Motif : {a.reason}</p>}
              {a.status === 'pending' && a.reviewer_id === user.id && (
                <form
                  onSubmit={async (e) => {
                    const b = form(e);
                    setBusy(true);
                    try {
                      await api(`/projects/${project.id}/approvals/${a.id}`, 'PATCH', b);
                      await load();
                      await onChanged();
                    } catch (e) {
                      fail(e, onError);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Field label="Décision">
                    <select name="status">
                      <option value="approved">Approuver</option>
                      <option value="rejected">Refuser</option>
                    </select>
                  </Field>
                  <Field label="Motif (obligatoire en cas de refus)">
                    <textarea name="reason" maxLength={2000} />
                  </Field>
                  <button className="primary" disabled={busy}>
                    Enregistrer la décision
                  </button>
                </form>
              )}
            </article>
          ))}
          {write && (
            <form
              onSubmit={async (e) => {
                const b = form(e);
                setBusy(true);
                try {
                  await api(base + '/approvals', 'POST', b);
                  await load();
                  await onChanged();
                } catch (e) {
                  fail(e, onError);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field label="Validateur de la version courante">
                <select name="reviewer_id" required>
                  {members
                    .filter((m) => m.role !== 'reader')
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </Field>
              <button className="secondary" disabled={busy}>
                Demander une validation
              </button>
            </form>
          )}
        </>
      )}
      {(section === 'all' || section === 'comments') && (
        <>
          <h3>Commentaires du document</h3>
          <Comments
            items={data.comments}
            canWrite={user.role !== 'reader'}
            path={base + '/comments'}
            refresh={load}
            onError={onError}
          />
        </>
      )}
    </div>
  );
}
export function AccountRecovery({ onBack }: { onBack: () => void }) {
  const reset = new URLSearchParams(location.search).get('reset'),
    verify = new URLSearchParams(location.search).get('verify');
  const [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <div className="recovery-page panel">
      <h1>
        {reset ? 'Nouveau mot de passe' : verify ? 'Vérifier mon adresse' : 'Retrouver mon accès'}
      </h1>
      <p>Les liens de récupération sont temporaires et à usage unique.</p>
      <form
        onSubmit={async (e) => {
          const b = form(e);
          setBusy(true);
          setError('');
          try {
            const r = await api<{ message?: string }>(
              '/auth/' + (reset ? 'reset' : verify ? 'verify' : 'forgot'),
              'POST',
              { ...b, token: reset || verify },
            );
            setMessage(
              r.message ||
                (verify
                  ? 'Adresse e-mail vérifiée.'
                  : 'Mot de passe enregistré. Toutes les sessions précédentes sont révoquées.'),
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {!verify &&
          (reset ? (
            <Field label="Nouveau mot de passe">
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={256}
                required
                autoComplete="new-password"
              />
            </Field>
          ) : (
            <Field label="E-mail de votre compte">
              <input name="email" type="email" required autoComplete="email" />
            </Field>
          ))}
        {!message && (
          <button className="primary" disabled={busy}>
            {verify
              ? 'Vérifier mon adresse'
              : reset
                ? 'Changer mon mot de passe'
                : 'Demander un lien'}
          </button>
        )}
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      <p className="muted small-text">
        En développement, le transport local dépose les liens dans data/mail-outbox lorsqu’il est
        activé. Aucun e-mail externe n’est envoyé.
      </p>
      <button className="secondary" onClick={onBack}>
        Retour à la connexion
      </button>
    </div>
  );
}
export function AccountSettings({
  user,
  onError,
  section = 'all',
}: {
  user: User;
  onError: (s: string) => void;
  section?: 'all' | 'security' | 'organization';
}) {
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [orgs, setOrgs] = useState<{ id: string; name: string; role: string }[]>([]);
  useEffect(() => {
    api<typeof orgs>('/organizations')
      .then(setOrgs)
      .catch((e) => onError(e.message));
  }, []);
  return (
    <div className="account-settings">
      {(section === 'all' || section === 'security') && (
        <>
          <h3>Sécurité du compte</h3>
          <p className="muted">Adresse {user.email_verified ? 'vérifiée' : 'non vérifiée'}</p>
          {!user.email_verified && (
            <button
              className="secondary"
              onClick={async () => {
                try {
                  setMessage(
                    (await api<{ message: string }>('/me/verification', 'POST', {})).message,
                  );
                } catch (e) {
                  fail(e, onError);
                }
              }}
            >
              Demander un lien de vérification
            </button>
          )}
          <form
            onSubmit={async (e) => {
              const b = form(e),
                target = e.currentTarget;
              setBusy(true);
              try {
                await api('/me/password', 'POST', b);
                setMessage('Mot de passe changé. Vos autres sessions sont révoquées.');
                target.reset();
              } catch (e) {
                fail(e, onError);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Mot de passe actuel">
              <input
                name="current_password"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            <Field label="Nouveau mot de passe">
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={256}
                required
              />
            </Field>
            <button className="secondary" disabled={busy}>
              Changer le mot de passe
            </button>
          </form>
          {message && (
            <p className="success" role="status">
              {message}
            </p>
          )}
        </>
      )}
      {(section === 'all' || section === 'organization') && (
        <>
          <h3>Mes organisations</h3>
          <Field label="Organisation active">
            <select
              value={user.org_id}
              onChange={async (e) => {
                try {
                  await api('/organizations/switch', 'POST', { org_id: e.target.value });
                  location.reload();
                } catch (e) {
                  fail(e, onError);
                }
              }}
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} · {roleLabels[o.role]}
                </option>
              ))}
            </select>
          </Field>
          <form
            onSubmit={async (e) => {
              const b = form(e);
              try {
                let value = String(b.invitation);
                if (value.includes('://'))
                  value = new URL(value).searchParams.get('invitation') || '';
                await api('/invitations/accept-existing', 'POST', { token: value });
                location.reload();
              } catch (e) {
                fail(e, onError);
              }
            }}
          >
            <Field label="Lien ou jeton d’invitation à une autre entreprise">
              <input name="invitation" required />
            </Field>
            <button className="secondary">Accepter l’invitation</button>
          </form>
        </>
      )}
      {(section === 'all' || section === 'security') && (
        <>
          <hr />
          <h3>Mes données personnelles</h3>
          <a className="secondary" download="synko-mes-donnees.json" href="/api/me/export">
            Exporter mes données JSON
          </a>
        </>
      )}
    </div>
  );
}
