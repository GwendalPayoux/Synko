import { useEffect, useState, type FormEvent } from 'react';
import {
  Building2,
  Users,
  FolderKanban,
  ScrollText,
  Plus,
  Search,
  Pencil,
  ArrowUpRight,
  Archive,
  KeyRound,
  LogOut,
  Pause,
  Play,
} from 'lucide-react';
import {
  api,
  type User,
  type Member,
  type Project,
  roleLabels,
  displayDate,
  today,
  shiftDate,
} from './domain';
import { Modal, Field, Badge } from './components';
import { ProjectIcon, ProjectIconPicker } from './project-icons';
type Organization = {
  id: string;
  name: string;
  suspended_at: string | null;
  member_count: number;
  project_count: number;
};
type Account = {
  id: string;
  name: string;
  email: string;
  disabled_at: string | null;
  platform_admin: number;
  memberships: { org_id: string; org_name: string; role: string }[];
};
type AdminProject = Project & { org_id: string; org_name: string };
type Audit = {
  id: string;
  action: string;
  actor_name: string;
  org_name: string;
  created_at: string;
};
type Action = {
  kind:
    | 'organization'
    | 'organizationStatus'
    | 'project'
    | 'projectStatus'
    | 'user'
    | 'userStatus'
    | 'password'
    | 'sessions'
    | 'access';
  organization?: Organization;
  project?: AdminProject;
  account?: Account;
};
export function PlatformBackoffice({
  user,
  onError,
}: {
  user: User;
  onError: (s: string) => void;
}) {
  const [section, setSection] = useState('projects'),
    [organizations, setOrganizations] = useState<Organization[]>([]),
    [projects, setProjects] = useState<AdminProject[]>([]),
    [accounts, setAccounts] = useState<Account[]>([]),
    [audit, setAudit] = useState<Audit[]>([]),
    [org, setOrg] = useState(''),
    [query, setQuery] = useState(''),
    [sort, setSort] = useState('organization'),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(true),
    [action, setAction] = useState<Action | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [formOrg, setFormOrg] = useState(''),
    [formRole, setFormRole] = useState('contributor'),
    [members, setMembers] = useState<Member[]>([]),
    [icon, setIcon] = useState('folder');
  async function load() {
    setLoading(true);
    try {
      setOrganizations(await api<Organization[]>('/platform/organizations'));
      const filters = `?org_id=${encodeURIComponent(org)}&q=${encodeURIComponent(query)}&sort=${encodeURIComponent(section === 'users' && sort === 'organization' ? 'name' : sort)}&page=${page}`;
      if (section === 'projects') {
        const d = await api<{ items: AdminProject[]; total: number }>(
          '/platform/projects' + filters,
        );
        setProjects(d.items);
        setTotal(d.total);
      } else if (section === 'users') {
        const d = await api<{ items: Account[]; total: number }>('/platform/users' + filters);
        setAccounts(d.items);
        setTotal(d.total);
      } else if (section === 'audit') setAudit(await api<Audit[]>('/platform/audit'));
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const handle = setTimeout(() => {
      load();
    }, 180);
    return () => clearTimeout(handle);
  }, [section, org, query, sort, page]);
  useEffect(() => {
    let live = true;
    setMembers([]);
    if (action?.kind === 'project' && formOrg)
      api<Member[]>(`/platform/organizations/${formOrg}/members`)
        .then((m) => {
          if (live) setMembers(m);
        })
        .catch((e) => onError(e.message));
    return () => {
      live = false;
    };
  }, [formOrg, action?.kind]);
  function open(next: Action) {
    setError('');
    setAction(next);
    const organization =
      next.project?.org_id ||
      next.organization?.id ||
      next.account?.memberships.find((m) => m.org_id === org)?.org_id ||
      next.account?.memberships[0]?.org_id ||
      org ||
      organizations[0]?.id ||
      '';
    setFormOrg(organization);
    setFormRole(
      next.account?.memberships.find((m) => m.org_id === organization)?.role || 'contributor',
    );
    setIcon(next.project?.icon || 'folder');
  }
  function changeSection(id: string) {
    setSection(id);
    setPage(1);
    setSort(id === 'projects' ? 'organization' : 'name');
    setQuery('');
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!action || busy) return;
    const b = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError('');
    try {
      const a = action;
      if (a.kind === 'organization') {
        await api(
          '/platform/organizations' + (a.organization ? '/' + a.organization.id : ''),
          a.organization ? 'PATCH' : 'POST',
          { name: b.name },
        );
      }
      if (a.kind === 'organizationStatus')
        await api('/platform/organizations/' + a.organization!.id, 'PATCH', {
          suspended: !a.organization!.suspended_at,
        });
      if (a.kind === 'project') {
        await api(
          '/platform/projects' + (a.project ? '/' + a.project.id : ''),
          a.project ? 'PATCH' : 'POST',
          { ...b, org_id: formOrg, icon, budget_cents: Math.round(Number(b.budget) * 100) },
        );
      }
      if (a.kind === 'projectStatus')
        await api('/platform/projects/' + a.project!.id, 'PATCH', {
          archived: !a.project!.archived_at,
        });
      if (a.kind === 'user') {
        await api(
          '/platform/users' + (a.account ? '/' + a.account.id : ''),
          a.account ? 'PATCH' : 'POST',
          {
            ...b,
            org_id: formOrg,
            role: formRole,
            ...(a.account
              ? { disabled: b.disabled === 'on', platform_admin: b.platform_admin === 'on' }
              : {}),
          },
        );
        if (a.account?.id === user.id) {
          location.reload();
          return;
        }
      }
      if (a.kind === 'userStatus') {
        await api('/platform/users/' + a.account!.id, 'PATCH', {
          disabled: !a.account!.disabled_at,
        });
        if (a.account!.id === user.id) {
          location.reload();
          return;
        }
      }
      if (a.kind === 'password') {
        await api('/platform/users/' + a.account!.id + '/password', 'POST', {
          password: b.password,
        });
        if (a.account!.id === user.id) {
          location.reload();
          return;
        }
      }
      if (a.kind === 'sessions') {
        await api('/platform/users/' + a.account!.id + '/sessions', 'DELETE');
        if (a.account!.id === user.id) {
          location.reload();
          return;
        }
      }
      if (a.kind === 'access') {
        const id = a.project?.org_id || a.organization!.id;
        await api('/platform/organizations/' + id + '/access', 'POST', {});
        if (a.project) sessionStorage.setItem('synko:open-project', a.project.id);
        location.reload();
        return;
      }
      setAction(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const titles = {
    organization: action?.organization ? 'Modifier l’entreprise' : 'Créer une entreprise',
    organizationStatus: action?.organization?.suspended_at
      ? 'Réactiver cette entreprise ?'
      : 'Suspendre cette entreprise ?',
    project: action?.project ? 'Modifier le projet' : 'Créer un projet',
    projectStatus: action?.project?.archived_at ? 'Restaurer ce projet ?' : 'Archiver ce projet ?',
    user: action?.account ? 'Modifier l’utilisateur et ses droits' : 'Créer un utilisateur',
    userStatus: action?.account?.disabled_at ? 'Réactiver ce compte ?' : 'Désactiver ce compte ?',
    password: 'Définir un nouveau mot de passe',
    sessions: 'Révoquer toutes les sessions ?',
    access: 'Ouvrir cet espace en administration ?',
  };
  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">ADMINISTRATION SYNKO</div>
          <h1>
            Pilotage plateforme<span className="greeting-dot">.</span>
          </h1>
          <p>Entreprises, projets et utilisateurs · accès réservé aux administrateurs Synko</p>
        </div>
        <span className="admin-access-label">
          <Building2 size={16} />
          {organizations.length} entreprise{organizations.length > 1 ? 's' : ''}
        </span>
      </div>
      <nav className="platform-tabs" aria-label="Navigation de l’administration">
        {[
          { id: 'projects', label: 'Projets', icon: FolderKanban },
          { id: 'users', label: 'Utilisateurs', icon: Users },
          { id: 'organizations', label: 'Entreprises', icon: Building2 },
          { id: 'audit', label: 'Journal', icon: ScrollText },
        ].map((item) => (
          <button
            key={item.id}
            className={section === item.id ? 'active' : ''}
            aria-current={section === item.id ? 'page' : undefined}
            onClick={() => changeSection(item.id)}
          >
            <item.icon size={17} />
            {item.label}
          </button>
        ))}
      </nav>
      {section !== 'audit' && (
        <div className="toolbar admin-toolbar">
          <div className="search-input">
            <Search size={16} />
            <input
              aria-label="Rechercher en administration"
              placeholder="Rechercher…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
          {section !== 'organizations' && (
            <>
              <select
                aria-label="Filtrer par entreprise"
                value={org}
                onChange={(e) => {
                  setOrg(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Toutes les entreprises</option>
                {organizations.map((o) => (
                  <option value={o.id} key={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Trier la liste d’administration"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                {section === 'projects' ? (
                  <>
                    <option value="organization">Entreprise</option>
                    <option value="name">Nom du projet</option>
                    <option value="end_date">Échéance</option>
                    <option value="created_at">Plus récents</option>
                    <option value="status">Statut</option>
                  </>
                ) : (
                  <>
                    <option value="name">Nom</option>
                    <option value="email">E-mail</option>
                    <option value="created_at">Date de création</option>
                  </>
                )}
              </select>
            </>
          )}
          <div className="spacer" />
          <button
            className="primary"
            onClick={() =>
              open({
                kind:
                  section === 'projects'
                    ? 'project'
                    : section === 'users'
                      ? 'user'
                      : 'organization',
              })
            }
          >
            <Plus size={16} />
            {section === 'projects'
              ? 'Créer un projet'
              : section === 'users'
                ? 'Créer un utilisateur'
                : 'Créer une entreprise'}
          </button>
        </div>
      )}
      <section className="panel platform-table">
        {loading ? (
          <p className="loading" role="status">
            Chargement de l’administration…
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              {section === 'projects' ? (
                <>
                  <thead>
                    <tr>
                      <th>Projet</th>
                      <th>Entreprise</th>
                      <th>Responsable</th>
                      <th>Échéance</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <span className="admin-project-name">
                            <span className={'project-emblem ' + p.color}>
                              <ProjectIcon name={p.icon} size={19} />
                            </span>
                            <strong>{p.name}</strong>
                          </span>
                        </td>
                        <td>{p.org_name}</td>
                        <td>{p.owner_name}</td>
                        <td>{displayDate(p.end_date)}</td>
                        <td>
                          {p.archived_at ? (
                            <span className="version-badge">Archivé</span>
                          ) : (
                            <Badge status={p.status} />
                          )}
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="icon-button"
                              aria-label={'Modifier le projet ' + p.name}
                              onClick={() => open({ kind: 'project', project: p })}
                            >
                              <Pencil size={17} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label={'Ouvrir le projet ' + p.name}
                              onClick={() => open({ kind: 'access', project: p })}
                            >
                              <ArrowUpRight size={17} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label={
                                (p.archived_at ? 'Restaurer' : 'Archiver') + ' le projet ' + p.name
                              }
                              onClick={() => open({ kind: 'projectStatus', project: p })}
                            >
                              <Archive size={17} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              ) : section === 'users' ? (
                <>
                  <thead>
                    <tr>
                      <th>Utilisateur</th>
                      <th>Entreprises et rôles</th>
                      <th>État</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <strong>{a.name}</strong>
                          <small>{a.email}</small>
                          {!!a.platform_admin && (
                            <span className="version-badge">Administrateur Synko</span>
                          )}
                        </td>
                        <td>
                          {a.memberships.map((m) => (
                            <small key={m.org_id}>
                              {m.org_name} · {roleLabels[m.role]}
                            </small>
                          ))}
                        </td>
                        <td>{a.disabled_at ? 'Désactivé' : 'Actif'}</td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="icon-button"
                              aria-label={'Modifier l’utilisateur ' + a.name}
                              onClick={() => open({ kind: 'user', account: a })}
                            >
                              <Pencil size={17} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label={'Réinitialiser le mot de passe de ' + a.name}
                              onClick={() => open({ kind: 'password', account: a })}
                            >
                              <KeyRound size={17} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label={'Révoquer les sessions de ' + a.name}
                              onClick={() => open({ kind: 'sessions', account: a })}
                            >
                              <LogOut size={17} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label={
                                (a.disabled_at ? 'Réactiver' : 'Désactiver') +
                                ' le compte ' +
                                a.name
                              }
                              onClick={() => open({ kind: 'userStatus', account: a })}
                            >
                              {a.disabled_at ? <Play size={17} /> : <Pause size={17} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              ) : section === 'organizations' ? (
                <>
                  <thead>
                    <tr>
                      <th>Entreprise</th>
                      <th>Membres</th>
                      <th>Projets</th>
                      <th>État</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {organizations
                      .filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))
                      .map((o) => (
                        <tr key={o.id}>
                          <td>
                            <strong>{o.name}</strong>
                          </td>
                          <td>{o.member_count}</td>
                          <td>{o.project_count}</td>
                          <td>{o.suspended_at ? 'Suspendue' : 'Active'}</td>
                          <td>
                            <div className="row-actions">
                              <button
                                className="icon-button"
                                aria-label={'Modifier l’entreprise ' + o.name}
                                onClick={() => open({ kind: 'organization', organization: o })}
                              >
                                <Pencil size={17} />
                              </button>
                              <button
                                className="icon-button"
                                aria-label={'Ouvrir l’espace ' + o.name}
                                onClick={() => open({ kind: 'access', organization: o })}
                              >
                                <ArrowUpRight size={17} />
                              </button>
                              <button
                                className="icon-button"
                                aria-label={
                                  (o.suspended_at ? 'Réactiver' : 'Suspendre') +
                                  ' l’entreprise ' +
                                  o.name
                                }
                                onClick={() =>
                                  open({ kind: 'organizationStatus', organization: o })
                                }
                              >
                                {o.suspended_at ? <Play size={17} /> : <Pause size={17} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </>
              ) : (
                <>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Administrateur</th>
                      <th>Entreprise</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map((a) => (
                      <tr key={a.id}>
                        <td>{new Date(a.created_at).toLocaleString('fr-FR')}</td>
                        <td>{a.actor_name}</td>
                        <td>{a.org_name}</td>
                        <td>{a.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
            </table>
            {((section === 'projects' && !projects.length) ||
              (section === 'users' && !accounts.length) ||
              (section === 'organizations' &&
                !organizations.some((o) => o.name.toLowerCase().includes(query.toLowerCase()))) ||
              (section === 'audit' && !audit.length)) && (
              <p className="empty">Aucun résultat dans cette vue.</p>
            )}
          </div>
        )}
      </section>
      {['projects', 'users'].includes(section) && (
        <div className="admin-pagination">
          <span>
            {total} résultat{total > 1 ? 's' : ''}
          </span>
          <button className="secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Précédent
          </button>
          <span>Page {page}</span>
          <button
            className="secondary"
            disabled={page * 50 >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant
          </button>
        </div>
      )}
      {action && (
        <Modal
          title={titles[action.kind]}
          onClose={() => setAction(null)}
          wide={action.kind === 'project'}
        >
          <form onSubmit={submit}>
            {action.kind === 'organization' && (
              <>
                <Field label="Nom de l’entreprise">
                  <input
                    name="name"
                    defaultValue={action.organization?.name || ''}
                    required
                    maxLength={120}
                    autoFocus
                  />
                </Field>
                {!action.organization && (
                  <p className="muted small-text">
                    Votre compte sera l’administrateur initial. Vous pourrez ensuite ajouter les
                    responsables depuis la liste des utilisateurs.
                  </p>
                )}
              </>
            )}
            {action.kind === 'user' && (
              <>
                <div className="form-row">
                  <Field label="Nom complet">
                    <input
                      name="name"
                      defaultValue={action.account?.name || ''}
                      required
                      maxLength={100}
                    />
                  </Field>
                  <Field label="Adresse e-mail">
                    <input
                      name="email"
                      type="email"
                      defaultValue={action.account?.email || ''}
                      required
                    />
                  </Field>
                </div>
                {!action.account && (
                  <Field label="Mot de passe initial">
                    <input
                      name="password"
                      type="password"
                      minLength={12}
                      maxLength={256}
                      autoComplete="new-password"
                      required
                    />
                  </Field>
                )}
                <Field label="Entreprise de l’utilisateur">
                  <select
                    value={formOrg}
                    onChange={(e) => {
                      setFormOrg(e.target.value);
                      setFormRole(
                        action.account?.memberships.find((m) => m.org_id === e.target.value)
                          ?.role || 'contributor',
                      );
                    }}
                    required
                  >
                    <option value="">Choisir une entreprise</option>
                    {organizations.map((o) => (
                      <option value={o.id} key={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Rôle dans cette entreprise">
                  <select value={formRole} onChange={(e) => setFormRole(e.target.value)}>
                    {Object.entries(roleLabels).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                {action.account && (
                  <>
                    <p className="muted small-text">
                      Seule l’appartenance à l’entreprise sélectionnée est modifiée. Les autres
                      appartenances sont conservées.
                    </p>
                    <label className="check-field">
                      <input
                        name="disabled"
                        type="checkbox"
                        defaultChecked={!!action.account.disabled_at}
                      />
                      Compte désactivé
                    </label>
                    <label className="check-field">
                      <input
                        name="platform_admin"
                        type="checkbox"
                        defaultChecked={!!action.account.platform_admin}
                      />
                      Administrateur Synko · accès à toutes les entreprises
                    </label>
                  </>
                )}
                <p className="muted small-text">
                  Aucun e-mail automatique n’est envoyé. Les modifications de sécurité révoquent les
                  sessions existantes.
                </p>
              </>
            )}
            {action.kind === 'project' && (
              <>
                <Field label="Entreprise du projet">
                  <select
                    value={formOrg}
                    onChange={(e) => setFormOrg(e.target.value)}
                    disabled={!!action.project}
                    required
                  >
                    <option value="">Choisir une entreprise</option>
                    {organizations.map((o) => (
                      <option value={o.id} key={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Nom du projet">
                  <input
                    name="name"
                    defaultValue={action.project?.name || ''}
                    maxLength={160}
                    required
                  />
                </Field>
                <Field label="Description">
                  <textarea
                    name="description"
                    defaultValue={action.project?.description || ''}
                    maxLength={2000}
                    rows={2}
                  />
                </Field>
                <Field label="Responsable du projet">
                  <select
                    key={formOrg + members.length}
                    name="owner_id"
                    defaultValue={action.project?.owner_id || ''}
                    required
                  >
                    <option value="">Choisir un responsable actif</option>
                    {members
                      .filter(
                        (m) =>
                          !(m as Member & { disabled_at?: string }).disabled_at &&
                          ['org_admin', 'project_manager'].includes(m.role),
                      )
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <div className="form-row">
                  <Field label="Début du projet">
                    <input
                      name="start_date"
                      type="date"
                      defaultValue={action.project?.start_date || today()}
                      required
                    />
                  </Field>
                  <Field label="Fin du projet">
                    <input
                      name="end_date"
                      type="date"
                      defaultValue={action.project?.end_date || shiftDate(today(), 30)}
                      required
                    />
                  </Field>
                </div>
                <div className="form-row">
                  <Field label="Budget initial (€)">
                    <input
                      name="budget"
                      type="number"
                      min="0"
                      max="1000000000"
                      step="0.01"
                      defaultValue={(action.project?.budget_cents || 0) / 100}
                      required
                    />
                  </Field>
                  <Field label="Statut du projet">
                    <select name="status" defaultValue={action.project?.status || 'active'}>
                      <option value="active">En cours</option>
                      <option value="paused">En pause</option>
                      <option value="completed">Clôturé</option>
                    </select>
                  </Field>
                </div>
                <Field label="Couleur du projet">
                  <select name="color" defaultValue={action.project?.color || 'sage'}>
                    <option value="sage">Sauge</option>
                    <option value="blue">Ardoise</option>
                    <option value="clay">Terracotta</option>
                    <option value="violet">Lavande</option>
                  </select>
                </Field>
                <ProjectIconPicker value={icon} onChange={setIcon} />
              </>
            )}
            {action.kind === 'password' && (
              <>
                <p className="muted">
                  Compte : {action.account?.email}. Toutes ses sessions seront révoquées.
                </p>
                <Field label="Nouveau mot de passe">
                  <input
                    type="password"
                    name="password"
                    minLength={12}
                    maxLength={256}
                    autoComplete="new-password"
                    required
                  />
                </Field>
              </>
            )}
            {action.kind === 'access' && (
              <>
                <p>
                  Entreprise :{' '}
                  <strong>{action.project?.org_name || action.organization?.name}</strong>
                </p>
                <p className="muted">
                  Cet accès ajoute votre compte aux administrateurs de cette entreprise et
                  enregistre l’opération dans le journal Synko. Vous pourrez gérer tous ses projets,
                  membres et documents.
                </p>
              </>
            )}
            {action.kind === 'organizationStatus' && (
              <p>
                {action.organization?.suspended_at
                  ? 'L’accès des collaborateurs sera rétabli.'
                  : 'Les sessions des collaborateurs seront fermées et l’accès à cette entreprise sera suspendu. Les données seront conservées.'}
              </p>
            )}
            {action.kind === 'userStatus' && (
              <p>
                {action.account?.disabled_at
                  ? 'Le compte pourra de nouveau se connecter.'
                  : 'Toutes les sessions seront fermées et ce compte ne pourra plus se connecter. Les projets et l’historique seront conservés.'}
              </p>
            )}
            {action.kind === 'projectStatus' && (
              <p>
                Le projet {action.project?.name}{' '}
                {action.project?.archived_at
                  ? 'reviendra dans le portefeuille actif.'
                  : 'sera masqué du portefeuille actif. Les données resteront disponibles en administration.'}
              </p>
            )}
            {action.kind === 'sessions' && (
              <p>Fermer toutes les sessions de {action.account?.name} ?</p>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-footer">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setAction(null)}
              >
                Annuler
              </button>
              <button className="primary" disabled={busy}>
                {busy
                  ? 'Enregistrement…'
                  : action.kind === 'access'
                    ? 'Confirmer l’accès'
                    : action.kind === 'password'
                      ? 'Réinitialiser le mot de passe'
                      : action.kind === 'user' && !action.account
                        ? 'Créer l’utilisateur'
                        : action.kind === 'project' && !action.project
                          ? 'Créer le projet'
                          : action.kind === 'organization' && !action.organization
                            ? 'Créer l’entreprise'
                            : 'Confirmer les modifications'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
