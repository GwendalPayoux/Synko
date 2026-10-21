import { CreateProject } from './create-project';
import { ProjectIcon } from './project-icons';
import { ActionTooltips } from './tooltips';
import { PlatformBackoffice } from './platform-admin';
import { SettingsPage } from './settings';
import React, { useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Layers,
  LayoutDashboard,
  FolderKanban,
  CalendarDays,
  Files,
  Settings,
  ShieldCheck,
  Plus,
  Search,
  ChevronRight,
  ArrowUpRight,
  ArrowLeft,
  Grid2X2,
  List,
  Star,
  Menu,
  X,
  Moon,
  Sun,
  Clock3,
  Flag,
  CircleCheck,
  ArrowRight,
  Users,
  ChartNoAxesCombined,
  GitBranch,
  Columns3,
  Bell,
  SlidersHorizontal,
} from 'lucide-react';
import {
  api,
  type User,
  type Project,
  type Task,
  type Member,
  type Activity,
  today,
  shiftDate,
  displayDate,
  roleLabels,
} from './domain';
import { Avatar, Badge, Empty, Field, Modal, Progress } from './components';
import { Auth } from './auth';
import { Calendar } from './calendar';
import { TaskEditor, TaskList, Kanban, Gantt, AddTaskButton } from './tasks';
import { Documents } from './documents';
import {
  ProjectSettings,
  Budget,
  NotificationCenter,
  TeamManagement,
  EventsPanel,
  Templates,
  type Notice,
} from './modules';
import './styles.css';
import './modules.css';
import './ux.css';
import { Portfolio } from './portfolio';
const navigation = [
  { id: 'dashboard', label: 'Mon espace', icon: LayoutDashboard },
  { id: 'projects', label: 'Projets', icon: FolderKanban },
  { id: 'calendar', label: 'Calendrier', icon: CalendarDays },
  { id: 'documents', label: 'Documents', icon: Files },
];
function App() {
  const [user, setUser] = useState<User | null>(null),
    [boot, setBoot] = useState(true),
    [page, setPage] = useState('dashboard'),
    [projects, setProjects] = useState<Project[]>([]),
    [personal, setPersonal] = useState<Task[]>([]),
    [projectId, setProjectId] = useState<string | null>(null),
    [tasks, setTasks] = useState<Task[]>([]),
    [members, setMembers] = useState<Member[]>([]),
    [orgMembers, setOrgMembers] = useState<Member[]>([]),
    [activity, setActivity] = useState<Activity[]>([]),
    [tab, setTab] = useState('gantt'),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [creating, setCreating] = useState(false),
    [editing, setEditing] = useState<{ project: Project; task?: Task } | null>(null),
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all'),
    [layout, setLayout] = useState('grid'),
    [sort, setSort] = useState('recent'),
    [mobile, setMobile] = useState(false),
    [theme, setTheme] = useState(localStorage.getItem('synko:theme') || 'light'),
    [favorites, setFavorites] = useState<string[]>([]),
    [newMember, setNewMember] = useState(''),
    [invite, setInvite] = useState(false),
    [inviteUrl, setInviteUrl] = useState(''),
    [saveState, setSaveState] = useState(''),
    [notifications, setNotifications] = useState(false),
    [taskFilter, setTaskFilter] = useState('all');
  const [documentTarget, setDocumentTarget] = useState<string | null>(null);
  const [notificationEvent, setNotificationEvent] = useState<import('./modules').EventItem | null>(
    null,
  );
  const [eventRequest, setEventRequest] = useState(0);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  async function refreshNotices() {
    setNotices(await api<Notice[]>('/notifications'));
  }
  const project = projects.find((p) => p.id === projectId);
  const canCreate = user?.permissions.includes('project:create');
  const full =
    !!user &&
    !!project &&
    (user.role === 'org_admin' ||
      (user.role === 'project_manager' && project.owner_id === user.id));
  const canTask = (t: Task) =>
    !!user &&
    (user.role === 'org_admin' ||
      (user.role === 'project_manager' &&
        projects.find((p) => p.id === t.project_id)?.owner_id === user.id) ||
      (user.role === 'contributor' && t.assignee_id === user.id));
  async function refresh() {
    const [p, t, m] = await Promise.all([
      api<Project[]>('/projects?archived=true'),
      api<Task[]>('/tasks'),
      api<Member[]>('/members'),
    ]);
    setProjects(p);
    setPersonal(t);
    setOrgMembers(m);
    await refreshNotices();
    return p;
  }
  async function refreshProject(id: string) {
    const [t, m, a] = await Promise.all([
      api<Task[]>(`/projects/${id}/tasks`),
      api<Member[]>(`/projects/${id}/members`),
      api<Activity[]>(`/projects/${id}/activity`),
    ]);
    setTasks(t);
    setMembers(m);
    setActivity(a);
  }
  async function login() {
    setBoot(true);
    try {
      const u = await api<User>('/me');
      setUser(u);
      setFavorites(JSON.parse(localStorage.getItem('synko:favorites:' + u.id) || '[]'));
      const ps = await refresh();
      const requested = sessionStorage.getItem('synko:open-project');
      if (requested) {
        sessionStorage.removeItem('synko:open-project');
        const p = ps.find((p) => p.id === requested);
        if (p) openProject(p);
      }
    } catch (e) {
      if ((e as Error).message !== 'Veuillez vous connecter.') setError((e as Error).message);
    } finally {
      setBoot(false);
    }
  }
  useEffect(() => {
    login();
  }, []);
  useEffect(() => {
    if (!user) return;
    try {
      const p = JSON.parse(localStorage.getItem('synko:preferences:' + user.id) || '{}');
      if (p.layout) setLayout(p.layout);
      if (p.sort) setSort(p.sort);
      if (p.filter) setFilter(p.filter);
      if (p.taskFilter) setTaskFilter(p.taskFilter);
    } catch {}
  }, [user?.id]);
  useEffect(() => {
    if (!user) return;
    try {
      localStorage.setItem(
        'synko:preferences:' + user.id,
        JSON.stringify({ layout, sort, filter, taskFilter }),
      );
    } catch {}
  }, [user?.id, layout, sort, filter, taskFilter]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('synko:theme', theme);
  }, [theme]);
  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    refreshProject(projectId)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [projectId]);
  function go(id: string) {
    setEventRequest(0);
    setPage(id);
    setProjectId(null);
    setMobile(false);
    setQuery('');
    setDocumentTarget(null);
  }
  function openProject(p: Project) {
    setTasks([]);
    setMembers([]);
    setActivity([]);
    setProjectId(p.id);
    setPage('projects');
    setTab('gantt');
    setQuery('');
    setDocumentTarget(null);
  }
  function favorite(id: string) {
    const next = favorites.includes(id) ? favorites.filter((i) => i !== id) : [...favorites, id];
    setFavorites(next);
    localStorage.setItem('synko:favorites:' + user!.id, JSON.stringify(next));
  }
  async function saved() {
    await refresh();
    if (projectId) await refreshProject(projectId);
    setSaveState('Modifications enregistrées');
  }
  async function patch(t: Task, changes: Partial<Task>) {
    setSaveState('Enregistrement…');
    try {
      await api(`/projects/${t.project_id}/tasks/${t.id}`, 'PATCH', {
        ...changes,
        revision: t.revision,
      });
      await saved();
    } catch (e) {
      setError((e as Error).message);
      setSaveState('Échec de l’enregistrement');
      await refresh();
      if (projectId) await refreshProject(projectId);
    }
  }
  async function openTask(t: Task) {
    const p = projects.find((p) => p.id === t.project_id);
    if (!p) return;
    try {
      const m = await api<Member[]>(`/projects/${p.id}/members`);
      setMembers(m);
      setEditing({ project: p, task: t });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function openNotification(n: Notice) {
    const target = await api<{ type: string; project_id: string; entity_id: string }>(
      '/notifications/' + n.id + '/target',
    );
    const ps = await api<Project[]>('/projects?archived=true');
    setProjects(ps);
    const p = ps.find((p) => p.id === target.project_id);
    if (!p) throw new Error('Le projet n’est plus accessible.');
    if (target.type === 'task') {
      const [d, m] = await Promise.all([
        api<{ task: Task }>(`/projects/${p.id}/tasks/${target.entity_id}/details`),
        api<Member[]>(`/projects/${p.id}/members`),
      ]);
      setMembers(m);
      setEditing({ project: p, task: d.task });
    } else if (target.type === 'document') {
      openProject(p);
      setTab('documents');
      setDocumentTarget(target.entity_id);
    } else if (target.type === 'event') {
      setNotificationEvent(
        await api<import('./modules').EventItem>(`/projects/${p.id}/events/${target.entity_id}`),
      );
    } else openProject(p);
    await api('/notifications/' + n.id, 'PATCH', { read: true });
    await refreshNotices();
    setNotifications(false);
  }
  async function logout(all = false) {
    try {
      await api(all ? '/auth/logout-all' : '/auth/logout', 'POST', {});
      setUser(null);
      setEditing(null);
      setNotificationEvent(null);
      setNotifications(false);
      setDocumentTarget(null);
      setProjects([]);
      setPersonal([]);
      setProjectId(null);
      setTasks([]);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function addMember() {
    try {
      await api(`/projects/${projectId}/members`, 'POST', { user_id: newMember });
      await saved();
      setNewMember('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function invitation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      const result = await api<{ url: string }>(
        '/invitations',
        'POST',
        Object.fromEntries(new FormData(e.currentTarget)),
      );
      setInviteUrl(result.url);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const overdue = personal.filter((t) => t.end_date < today() && t.status !== 'done');
  const upcoming = personal.filter(
    (t) => t.end_date >= today() && t.end_date <= shiftDate(today(), 7) && t.status !== 'done',
  );
  const active = projects.filter((p) => p.status === 'active' && !p.archived_at);
  if (boot)
    return (
      <div className="boot">
        <Layers size={32} />
        <strong>synko</strong>
        <span>Ouverture de votre espace…</span>
      </div>
    );
  if (!user)
    return (
      <>
        <Auth onLogin={login} />
        {error && (
          <div className="toast error" role="alert">
            {error}
            <button onClick={() => setError('')} aria-label="Fermer">
              <X size={16} />
            </button>
          </div>
        )}
      </>
    );
  const shownProjects = projects
    .filter(
      (p) =>
        (showArchived ? !!p.archived_at : !p.archived_at) &&
        p.name.toLowerCase().includes(query.toLowerCase()) &&
        (filter === 'all' ||
          (filter === 'favorites' && favorites.includes(p.id)) ||
          p.status === filter),
    )
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : sort === 'deadline'
          ? a.end_date.localeCompare(b.end_date)
          : 0,
    );
  const shownTasks = tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(query.toLowerCase()) &&
      (taskFilter === 'all' || t.status === taskFilter),
  );
  return (
    <div className="app">
      <ActionTooltips />
      <aside className={'sidebar ' + (mobile ? 'open' : '')}>
        <div className="brand">
          <span className="brand-mark">
            <Layers size={23} />
          </span>
          synko<span className="by">by Synapt</span>
          <button
            className="mobile-only icon-button"
            aria-label="Fermer le menu"
            onClick={() => setMobile(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace">
          <span className="org-icon">{user.org_name[0].toUpperCase()}</span>
          <div>
            <strong>{user.org_name}</strong>
            <small>Espace entreprise</small>
          </div>
          <span className="workspace-dot" />
        </div>
        <div className="nav-caption">ESPACE DE TRAVAIL</div>
        <nav>
          {navigation.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? 'active' : ''}
              onClick={() => go(item.id)}
            >
              <item.icon size={19} />
              {item.label}
              {item.id === 'projects' && <span className="nav-count">{projects.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-project-head">
          <span className="nav-caption">MES FAVORIS</span>
          {canCreate && (
            <button
              className="icon-button"
              aria-label="Créer un projet"
              onClick={() => setCreating(true)}
            >
              <Plus size={15} />
            </button>
          )}
        </div>
        <div className="favorite-projects">
          {projects
            .filter((p) => favorites.includes(p.id))
            .map((p) => (
              <button key={p.id} onClick={() => openProject(p)}>
                <i className={'project-dot ' + p.color} />
                <span>{p.name}</span>
              </button>
            ))}
          {!favorites.length && (
            <p>
              Retrouvez ici les projets
              <br />
              que vous marquez d’une étoile.
            </p>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="workspace-tip">
            <span className="tiny-eyebrow">PLUS CLAIR, ENSEMBLE.</span>
            <p>
              Un projet bien organisé,
              <br />
              c’est une équipe qui avance.
            </p>
            <GitBranch size={24} />
          </div>
          <button
            className={page === 'settings' ? 'active settings-link' : 'settings-link'}
            onClick={() => go('settings')}
          >
            <Settings size={18} />
            Paramètres
          </button>
          {user.platform_admin && (
            <button
              className={page === 'platform' ? 'active settings-link' : 'settings-link'}
              onClick={() => go('platform')}
            >
              <ShieldCheck size={18} />
              Administration Synko
            </button>
          )}
          <div className="profile sidebar-identity">
            <Avatar name={user.name} />
            <div>
              <strong>{user.name}</strong>
              <small>
                {user.platform_admin ? 'Administrateur plateforme' : roleLabels[user.role]}
              </small>
            </div>
            <ChevronRight size={15} />
          </div>
        </div>
      </aside>
      {mobile && <div className="mobile-overlay" onClick={() => setMobile(false)} />}
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="mobile-only icon-button"
              aria-label="Ouvrir le menu"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span>{user.org_name}</span>
            <ChevronRight size={14} />
            <strong>
              {project
                ? project.name
                : page === 'dashboard'
                  ? 'Mon espace'
                  : page === 'platform'
                    ? 'Administration Synko'
                    : page === 'settings'
                      ? 'Paramètres'
                      : navigation.find((n) => n.id === page)?.label}
            </strong>
          </div>
          <div className="topbar-actions">
            <span className="save-state" role="status">
              {saveState}
            </span>
            <button
              className="icon-button"
              aria-label={theme === 'light' ? 'Activer le mode sombre' : 'Activer le mode clair'}
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button
              className="icon-button notification-button"
              aria-label="Échéances à surveiller"
              onClick={() => {
                setNotifications(!notifications);
                refreshNotices().catch((e) => setError(e.message));
              }}
            >
              <Bell size={18} />
              {notices.some((n) => !n.read_at) && <i />}
            </button>
            <Avatar name={user.name} small />
          </div>
        </header>
        {notifications && (
          <NotificationCenter
            items={notices}
            onRefresh={refreshNotices}
            onError={setError}
            onOpen={openNotification}
          />
        )}
        <main>
          {page === 'dashboard' && !project && (
            <>
              <div className="page-title">
                <div>
                  <div className="eyebrow">VOTRE JOURNÉE, EN UN REGARD</div>
                  <h1>
                    Bonjour, {user.name.split(' ')[0]}
                    <span className="greeting-dot">.</span>
                  </h1>
                  <p>Gardez le cap sur ce qui compte aujourd’hui.</p>
                </div>
                <span className="date-pill">
                  <CalendarDays size={16} />
                  {new Date().toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </span>
              </div>
              <div className="dashboard-layout">
                <Calendar tasks={personal} onTask={openTask} />
                <aside className="dashboard-aside">
                  <section className="focus-card">
                    <span className="eyebrow">VOTRE CAP CETTE SEMAINE</span>
                    <h2>
                      Chaque avancée
                      <br />
                      compte.
                    </h2>
                    <p>
                      {personal.length
                        ? 'Retrouvez vos prochaines échéances et faites avancer vos projets.'
                        : 'Créez votre premier projet et donnez une direction à votre équipe.'}
                    </p>
                    <button onClick={() => (canCreate ? setCreating(true) : go('projects'))}>
                      {canCreate ? 'Créer un projet' : 'Voir mes projets'}
                      <ArrowUpRight size={18} />
                    </button>
                    <div className="focus-decoration">
                      <span />
                      <span />
                      <span />
                    </div>
                  </section>
                  <section className="panel compact-stats">
                    <div>
                      <span className="stat-icon clay">
                        <Clock3 size={18} />
                      </span>
                      <span>En retard</span>
                      <strong>{overdue.length}</strong>
                    </div>
                    <div>
                      <span className="stat-icon sage">
                        <Flag size={18} />
                      </span>
                      <span>Cette semaine</span>
                      <strong>{upcoming.length}</strong>
                    </div>
                    <div>
                      <span className="stat-icon blue">
                        <FolderKanban size={18} />
                      </span>
                      <span>Projets actifs</span>
                      <strong>{active.length}</strong>
                    </div>
                    <div>
                      <span className="stat-icon violet">
                        <CircleCheck size={18} />
                      </span>
                      <span>Tâches terminées</span>
                      <strong>{personal.filter((t) => t.status === 'done').length}</strong>
                    </div>
                  </section>
                  <section className="mini-note">
                    <span className="status-indicator" />
                    <span>
                      Votre espace est à jour.
                      <br />
                      <small>Des données réelles, partagées entre les vues.</small>
                    </span>
                  </section>
                </aside>
              </div>
              <section className="panel personal-tasks">
                <div className="panel-head">
                  <div>
                    <h3>Mes tâches</h3>
                    <span className="muted">L’essentiel pour avancer</span>
                  </div>
                  <span className="count">{personal.length}</span>
                </div>
                {personal.length ? (
                  <TaskList
                    tasks={personal}
                    onTask={openTask}
                    onStatus={(t, s) =>
                      patch(t, {
                        status: s,
                        progress: s === 'done' ? 100 : t.progress === 100 ? 0 : t.progress,
                      })
                    }
                    canEdit={canTask}
                    showProject
                  />
                ) : (
                  <Empty
                    title="Vous avez le champ libre"
                    description="Les tâches qui vous sont affectées apparaîtront ici, avec leurs échéances et leur avancement."
                  />
                )}
              </section>
              <div className="section-heading">
                <h2>Vos projets en cours</h2>
                <button className="link" onClick={() => go('projects')}>
                  Tous les projets
                  <ArrowRight size={16} />
                </button>
              </div>
              <div className="project-grid">
                {active.slice(0, 3).map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    favorite={favorites.includes(p.id)}
                    onFavorite={() => favorite(p.id)}
                    onOpen={() => openProject(p)}
                  />
                ))}
                {!active.length && (
                  <div className="panel full-span">
                    <Empty
                      title="Votre prochain projet vous attend"
                      description="Un objectif, une équipe, un planning : commencez simplement."
                      action={canCreate ? () => setCreating(true) : undefined}
                      label="Créer mon premier projet"
                    />
                  </div>
                )}
              </div>
            </>
          )}
          {page === 'projects' && !project && (
            <>
              <div className="page-title">
                <div>
                  <div className="eyebrow">UNE VISION COMMUNE</div>
                  <h1>
                    Les projets<span className="greeting-dot">.</span>
                  </h1>
                  <p>De l’idée au résultat, gardez une longueur d’avance.</p>
                </div>
                {canCreate && (
                  <button className="primary" onClick={() => setCreating(true)}>
                    <Plus size={18} />
                    Nouveau projet
                  </button>
                )}
              </div>
              {['org_admin', 'pmo'].includes(user.role) && (
                <Portfolio
                  onError={setError}
                  onOpen={(id) => {
                    const p = projects.find((p) => p.id === id);
                    if (p) openProject(p);
                  }}
                />
              )}
              <div className="portfolio-summary">
                <span>
                  <strong>{projects.length}</strong>projets au total
                </span>
                <span>
                  <i className="project-dot sage" />
                  <strong>{active.length}</strong>en cours
                </span>
                <span>
                  <i className="project-dot blue" />
                  <strong>{projects.filter((p) => p.status === 'completed').length}</strong>clôturés
                </span>
              </div>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                />
                Voir les projets archivés
              </label>
              {canCreate && (
                <Templates
                  onError={setError}
                  onSaved={saved}
                  onCreated={(id) => {
                    setProjectId(id);
                    setTab('gantt');
                  }}
                />
              )}
              <div className="toolbar">
                <div className="search-input">
                  <Search size={17} />
                  <input
                    aria-label="Rechercher un projet"
                    placeholder="Rechercher un projet…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div className="filter-tabs">
                  {[
                    ['all', 'Tous les projets'],
                    ['active', 'En cours'],
                    ['favorites', 'Favoris'],
                  ].map(([id, label]) => (
                    <button
                      className={filter === id ? 'selected' : ''}
                      key={id}
                      onClick={() => setFilter(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="spacer" />
                <select
                  aria-label="Trier les projets"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="recent">Plus récents</option>
                  <option value="name">Nom</option>
                  <option value="deadline">Échéance</option>
                </select>
                <div className="segmented">
                  <button
                    className={layout === 'grid' ? 'selected' : ''}
                    aria-label="Vue cartes"
                    onClick={() => setLayout('grid')}
                  >
                    <Grid2X2 size={16} />
                  </button>
                  <button
                    className={layout === 'list' ? 'selected' : ''}
                    aria-label="Vue liste"
                    onClick={() => setLayout('list')}
                  >
                    <List size={16} />
                  </button>
                </div>
              </div>
              <div className={'project-grid ' + (layout === 'list' ? 'project-list' : '')}>
                {shownProjects.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    favorite={favorites.includes(p.id)}
                    onFavorite={() => favorite(p.id)}
                    onOpen={() => openProject(p)}
                  />
                ))}
                {canCreate && (
                  <button className="create-project-card" onClick={() => setCreating(true)}>
                    <span>
                      <Plus size={24} />
                    </span>
                    <strong>Une nouvelle ambition ?</strong>
                    <p>Créez un projet et donnez-lui vie.</p>
                    <span className="link">
                      Nouveau projet
                      <ArrowRight size={15} />
                    </span>
                  </button>
                )}
              </div>
              {!shownProjects.length && projects.length > 0 && (
                <Empty
                  title="Aucun projet trouvé"
                  description="Essayez un autre mot-clé ou modifiez vos filtres."
                />
              )}
            </>
          )}
          {project && (
            <>
              <button className="back-link" onClick={() => go('projects')}>
                <ArrowLeft size={15} />
                Tous les projets
              </button>
              <div className="page-title project-heading">
                <div className={'project-emblem ' + project.color}>
                  <ProjectIcon name={project.icon} size={28} />
                </div>
                <div>
                  <div className="project-heading-meta">
                    <span className="eyebrow">ESPACE PROJET</span>
                    <Badge status={project.status} />
                  </div>
                  <h1>{project.name}</h1>
                  <p>{project.description || 'Un objectif commun. Une équipe pour le réaliser.'}</p>
                </div>
                <div className="spacer" />
                {full && <AddTaskButton onClick={() => setEditing({ project })} />}
              </div>
              <div className="project-meta">
                <span>
                  <CalendarDays size={15} />
                  {displayDate(project.start_date)} — {displayDate(project.end_date)}
                </span>
                <span>
                  <Users size={15} />
                  {members.length} membre{members.length > 1 ? 's' : ''}
                </span>
                <span className="project-progress">
                  <Progress value={project.progress} />
                  {project.progress}%
                </span>
              </div>
              <div className="project-tabs">
                {[
                  { id: 'gantt', label: 'Planning', icon: GitBranch },
                  { id: 'kanban', label: 'Kanban', icon: Columns3 },
                  { id: 'list', label: 'Liste', icon: List },
                  { id: 'documents', label: 'Documents', icon: Files },
                  { id: 'team', label: 'Équipe', icon: Users },
                  ...(user.role !== 'reader'
                    ? [{ id: 'budget', label: 'Budget', icon: ChartNoAxesCombined }]
                    : []),
                  { id: 'overview', label: 'Vue d’ensemble', icon: ChartNoAxesCombined },
                  { id: 'settings', label: 'Paramètres', icon: Settings },
                ].map((t) => (
                  <button
                    key={t.id}
                    className={tab === t.id ? 'active' : ''}
                    onClick={() => {
                      setTab(t.id);
                      setQuery('');
                    }}
                  >
                    <t.icon size={17} />
                    {t.label}
                  </button>
                ))}
              </div>
              {loading ? (
                <div className="loading" role="status">
                  Chargement du projet…
                </div>
              ) : (
                <>
                  {['gantt', 'kanban', 'list'].includes(tab) && (
                    <div className="toolbar task-toolbar">
                      <div className="search-input">
                        <Search size={17} />
                        <input
                          aria-label="Rechercher une tâche"
                          placeholder="Rechercher une tâche…"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </div>
                      <span className="muted">{tasks.length} tâches et jalons</span>
                      <div className="spacer" />
                      <SlidersHorizontal size={16} />
                      <select
                        aria-label="Filtrer les tâches par statut"
                        value={taskFilter}
                        onChange={(e) => setTaskFilter(e.target.value)}
                      >
                        <option value="all">Tous les statuts</option>
                        <option value="todo">À faire</option>
                        <option value="doing">En cours</option>
                        <option value="review">À valider</option>
                        <option value="done">Terminées</option>
                      </select>
                    </div>
                  )}
                  {tab === 'gantt' && (
                    <Gantt
                      tasks={shownTasks}
                      project={project}
                      onTask={openTask}
                      canEdit={() => full}
                      onDates={(t, start, end) => patch(t, { start_date: start, end_date: end })}
                    />
                  )}
                  {tab === 'kanban' && (
                    <Kanban
                      tasks={shownTasks}
                      onTask={openTask}
                      canEdit={canTask}
                      onStatus={(t, s) =>
                        patch(t, {
                          status: s,
                          progress: s === 'done' ? 100 : t.progress === 100 ? 0 : t.progress,
                        })
                      }
                    />
                  )}
                  {tab === 'list' && (
                    <section className="panel">
                      {shownTasks.length ? (
                        <TaskList
                          tasks={shownTasks}
                          onTask={openTask}
                          canEdit={canTask}
                          onStatus={(t, s) =>
                            patch(t, {
                              status: s,
                              progress: s === 'done' ? 100 : t.progress === 100 ? 0 : t.progress,
                            })
                          }
                        />
                      ) : (
                        <Empty
                          title="Rien à afficher pour le moment"
                          description="Ajoutez une tâche ou ajustez vos filtres."
                        />
                      )}
                    </section>
                  )}
                  {tab === 'documents' && (
                    <Documents
                      user={user}
                      project={project}
                      canWrite={user.permissions.includes('document:write')}
                      onError={setError}
                      initialDocumentId={documentTarget}
                      onTargetConsumed={() => setDocumentTarget(null)}
                    />
                  )}
                  {tab === 'team' && (
                    <>
                      {user.role !== 'reader' && (
                        <TeamManagement
                          project={project}
                          user={user}
                          members={members}
                          onError={setError}
                          onSaved={saved}
                        />
                      )}
                      <section className="panel">
                        <div className="panel-head">
                          <div>
                            <h3>Une équipe, un objectif</h3>
                            <span className="muted">
                              Les membres qui peuvent accéder à ce projet
                            </span>
                          </div>
                        </div>
                        <div className="member-grid">
                          {members.map((m) => (
                            <article key={m.id}>
                              <Avatar name={m.name} />
                              <strong>{m.name}</strong>
                              <span>{roleLabels[m.role]}</span>
                              <small>{m.email}</small>
                            </article>
                          ))}
                        </div>
                        {full && (
                          <div className="add-member">
                            <select
                              aria-label="Membre à ajouter"
                              value={newMember}
                              onChange={(e) => setNewMember(e.target.value)}
                            >
                              <option value="">Choisir un membre de l’entreprise</option>
                              {orgMembers
                                .filter((m) => !members.some((pm) => pm.id === m.id))
                                .map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name}
                                  </option>
                                ))}
                            </select>
                            <button className="secondary" disabled={!newMember} onClick={addMember}>
                              <Plus size={16} />
                              Ajouter au projet
                            </button>
                          </div>
                        )}
                      </section>
                    </>
                  )}
                  {tab === 'overview' && (
                    <div className="overview-grid">
                      <section className="panel">
                        <div className="panel-head">
                          <h3>Avancement</h3>
                        </div>
                        <div className="overview-progress">
                          <strong>
                            {project.progress}
                            <small>%</small>
                          </strong>
                          <Progress value={project.progress} />
                          <p>
                            {tasks.filter((t) => t.status === 'done').length} tâches terminées sur{' '}
                            {tasks.length}
                          </p>
                        </div>
                        {user.role !== 'reader' && (
                          <div className="budget-note">
                            <h4>Budget initial</h4>
                            <strong>
                              {new Intl.NumberFormat('fr-FR', {
                                style: 'currency',
                                currency: 'EUR',
                              }).format(project.budget_cents / 100)}
                            </strong>
                            <p className="muted">
                              Retrouvez les dépenses, engagements et révisions dans l’onglet Budget.
                            </p>
                          </div>
                        )}
                      </section>
                      <section className="panel">
                        <div className="panel-head">
                          <h3>Activité du projet</h3>
                        </div>
                        <div className="activity-list">
                          {activity.map((a) => (
                            <article key={a.id}>
                              <span className="activity-dot" />
                              <div>
                                <strong>{a.action}</strong>
                                <p>
                                  {a.actor_name} · {new Date(a.created_at).toLocaleString('fr-FR')}
                                </p>
                              </div>
                            </article>
                          ))}
                        </div>
                      </section>
                    </div>
                  )}
                  {tab === 'settings' && (
                    <>
                      <ProjectSettings
                        project={project}
                        user={user}
                        members={orgMembers}
                        onError={setError}
                        onSaved={saved}
                      />
                      {full && (
                        <Templates
                          project={project}
                          onError={setError}
                          onSaved={saved}
                          onCreated={() => {}}
                        />
                      )}
                    </>
                  )}
                  {tab === 'budget' && user.role !== 'reader' && (
                    <Budget project={project} user={user} onError={setError} onSaved={saved} />
                  )}
                </>
              )}
            </>
          )}
          {page === 'calendar' && !project && (
            <>
              <div className="page-title">
                <div>
                  <div className="eyebrow">GARDEZ LE RYTHME</div>
                  <h1>
                    Votre calendrier<span className="greeting-dot">.</span>
                  </h1>
                  <p>Toutes vos échéances affectées, à travers vos projets.</p>
                </div>
                {projects.some(
                  (p) =>
                    !p.archived_at &&
                    (user.role === 'org_admin' ||
                      (user.role === 'project_manager' && p.owner_id === user.id)),
                ) && (
                  <button className="primary" onClick={() => setEventRequest((n) => n + 1)}>
                    <Plus size={17} />
                    Nouvel événement
                  </button>
                )}
              </div>
              <Calendar tasks={personal} onTask={openTask} large />
              <EventsPanel
                projects={projects.filter((p) => !p.archived_at)}
                user={user}
                onError={setError}
                onSaved={saved}
                headerAction
                openRequest={eventRequest}
              />
            </>
          )}
          {page === 'documents' && !project && (
            <>
              <div className="page-title">
                <div>
                  <div className="eyebrow">L’ESSENTIEL, CENTRALISÉ</div>
                  <h1>
                    Les documents<span className="greeting-dot">.</span>
                  </h1>
                  <p>Ouvrez un projet pour accéder à ses fichiers et à leurs versions.</p>
                </div>
              </div>
              <div className="document-projects">
                {projects.map((p) => (
                  <button
                    className="panel"
                    key={p.id}
                    onClick={() => {
                      openProject(p);
                      setTab('documents');
                    }}
                  >
                    <span className={'project-emblem ' + p.color}>
                      <ProjectIcon name={p.icon} size={23} />
                    </span>
                    <div>
                      <strong>{p.name}</strong>
                      <p>Consulter les documents</p>
                    </div>
                    <ArrowUpRight size={19} />
                  </button>
                ))}
              </div>
              {!projects.length && (
                <Empty
                  title="Vos documents suivent vos projets"
                  description="Créez un projet pour commencer à centraliser vos fichiers."
                />
              )}
            </>
          )}
          {page === 'settings' && !project && (
            <SettingsPage
              user={user}
              members={orgMembers}
              onError={setError}
              onLogout={logout}
              onInvite={() => {
                setInvite(true);
                setInviteUrl('');
              }}
              onSaved={async () => {
                setUser(await api<User>('/me'));
                await saved();
              }}
            />
          )}
          {page === 'platform' && !project && user.platform_admin && (
            <PlatformBackoffice user={user} onError={setError} />
          )}
          <footer className="app-footer">
            <span>
              synko <small>by Synapt</small>
            </span>
            <span>Un espace commun. Des projets qui avancent.</span>
          </footer>
        </main>
      </div>
      {error && (
        <div className="toast error" role="alert">
          <span>{error}</span>
          <button onClick={() => setError('')} aria-label="Fermer le message">
            <X size={18} />
          </button>
        </div>
      )}
      {creating && (
        <CreateProject
          user={user}
          onClose={() => setCreating(false)}
          onError={setError}
          onCreated={async (id) => {
            await refresh();
            setProjectId(id);
            setPage('projects');
            setTab('gantt');
          }}
        />
      )}
      {notificationEvent && (
        <Modal title={notificationEvent.title} onClose={() => setNotificationEvent(null)}>
          <p className="muted">
            {notificationEvent.project_name} · {displayDate(notificationEvent.start_date)} —{' '}
            {displayDate(notificationEvent.end_date)}
          </p>
          <p>{notificationEvent.description}</p>
          <button
            className="secondary"
            onClick={() => {
              setNotificationEvent(null);
              go('calendar');
            }}
          >
            Ouvrir le calendrier
          </button>
        </Modal>
      )}
      {editing && (
        <TaskEditor
          task={editing.task}
          project={editing.project}
          members={members}
          user={user}
          onClose={() => setEditing(null)}
          onSaved={saved}
          onError={setError}
        />
      )}
      {invite && (
        <Modal title="Inviter un collaborateur" onClose={() => setInvite(false)}>
          {inviteUrl ? (
            <div className="invite-result">
              <h3>Votre lien d’invitation est prêt</h3>
              <p>
                Transmettez ce lien à la personne invitée. Il est valable 72 heures, pour l’adresse
                indiquée.
              </p>
              <textarea readOnly value={inviteUrl} aria-label="Lien d’invitation" rows={4} />
              <p className="muted">Aucun e-mail automatique n’a été envoyé.</p>
            </div>
          ) : (
            <form onSubmit={invitation}>
              <Field label="Adresse e-mail">
                <input name="email" type="email" required />
              </Field>
              <Field label="Rôle dans l’entreprise">
                <select name="role">
                  <option value="contributor">Contributeur</option>
                  <option value="project_manager">Chef de projet</option>
                  <option value="pmo">PMO</option>
                  <option value="reader">Lecteur / Client</option>
                </select>
              </Field>
              <p className="muted">
                Après son inscription, ajoutez cette personne aux projets autorisés.
              </p>
              <div className="modal-footer">
                <button className="primary">Créer le lien d’invitation</button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
function ProjectCard({
  project: p,
  favorite,
  onFavorite,
  onOpen,
}: {
  project: Project;
  favorite: boolean;
  onFavorite: () => void;
  onOpen: () => void;
}) {
  return (
    <article className="project-card">
      <div className="project-card-head">
        <span className={'project-emblem ' + p.color}>
          <ProjectIcon name={p.icon} size={24} />
        </span>
        <button
          className={'icon-button favorite ' + (favorite ? 'is-favorite' : '')}
          aria-label={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          onClick={onFavorite}
        >
          <Star size={17} fill={favorite ? 'currentColor' : 'none'} />
        </button>
      </div>
      <button className="project-card-title" onClick={onOpen}>
        <h3>{p.name}</h3>
        <ArrowUpRight size={17} />
      </button>
      <p className="project-description">
        {p.description || 'Un nouvel objectif à construire ensemble.'}
      </p>
      <div className="project-card-status">
        <Badge status={p.status} />
        <span>{p.task_count} tâches</span>
      </div>
      <div className="project-card-progress">
        <span>
          Avancement<strong>{p.progress}%</strong>
        </span>
        <Progress value={p.progress} />
      </div>
      <footer>
        <span>
          <Avatar name={p.owner_name} small />
          {p.owner_name.split(' ')[0]}
        </span>
        <span>
          <CalendarDays size={14} />
          {displayDate(p.end_date)}
        </span>
      </footer>
    </article>
  );
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
