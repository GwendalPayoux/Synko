import { useState } from 'react';
import { LogOut, UserRound, ShieldCheck, Building2, CalendarClock, Plug } from 'lucide-react';
import { api, type User, type Member, roleLabels } from './domain';
import { Field } from './components';
import { AccountSettings, OrganizationRoles, Sessions } from './modules';
import { Availability } from './portfolio';
export function SettingsPage({
  user,
  members,
  onError,
  onSaved,
  onLogout,
  onInvite,
}: {
  user: User;
  members: Member[];
  onError: (s: string) => void;
  onSaved: () => Promise<void>;
  onLogout: (all?: boolean) => Promise<void>;
  onInvite: () => void;
}) {
  const [section, setSection] = useState('personal'),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const sections = [
    { id: 'personal', label: 'Informations personnelles', icon: UserRound },
    { id: 'security', label: 'Sécurité et sessions', icon: ShieldCheck },
    { id: 'organization', label: 'Entreprise et accès', icon: Building2 },
    ...(user.role !== 'reader'
      ? [{ id: 'availability', label: 'Disponibilités', icon: CalendarClock }]
      : []),
    { id: 'services', label: 'Services connectés', icon: Plug },
  ];
  return (
    <>
      <div className="page-title settings-title">
        <div>
          <div className="eyebrow">VOTRE ESPACE, VOS REPÈRES</div>
          <h1>
            Paramètres<span className="greeting-dot">.</span>
          </h1>
          <p>
            {user.org_name} ·{' '}
            {user.platform_admin ? 'Administrateur plateforme' : roleLabels[user.role]}
          </p>
        </div>
        <button className="secondary signout-button" onClick={() => onLogout()}>
          <LogOut size={16} />
          Se déconnecter
        </button>
      </div>
      <div className="settings-layout">
        <nav className="settings-nav panel" aria-label="Sections des paramètres">
          {sections.map((s) => (
            <button
              key={s.id}
              className={section === s.id ? 'active' : ''}
              onClick={() => {
                setSection(s.id);
                setMessage('');
              }}
              aria-current={section === s.id ? 'page' : undefined}
            >
              <s.icon size={17} />
              {s.label}
            </button>
          ))}
        </nav>
        <section
          className="panel settings-content"
          aria-label={sections.find((s) => s.id === section)?.label}
        >
          {section === 'personal' && (
            <>
              <header>
                <h2>Informations personnelles</h2>
                <p>Votre identité dans l’espace de travail.</p>
              </header>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const b = Object.fromEntries(new FormData(e.currentTarget));
                  setBusy(true);
                  try {
                    await api('/me', 'PATCH', b);
                    await onSaved();
                    setMessage('Vos informations ont été enregistrées.');
                  } catch (e) {
                    onError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Field label="Nom complet">
                  <input name="name" defaultValue={user.name} required maxLength={100} />
                </Field>
                <Field label="Adresse e-mail">
                  <input value={user.email} disabled />
                </Field>
                <button className="primary" disabled={busy}>
                  Enregistrer
                </button>
              </form>
            </>
          )}
          {section === 'security' && (
            <>
              <header>
                <h2>Sécurité et sessions</h2>
                <p>Gardez le contrôle de votre compte et de vos connexions.</p>
              </header>
              <AccountSettings user={user} onError={onError} section="security" />
              <div className="settings-subsection">
                <h3>Sessions actives</h3>
                <p className="muted">Expiration automatique après 7 jours.</p>
                <Sessions onError={onError} />
                <button className="secondary danger" onClick={() => onLogout(true)}>
                  Fermer toutes mes sessions
                </button>
              </div>
            </>
          )}
          {section === 'organization' && (
            <>
              <header>
                <h2>Entreprise et accès</h2>
                <p>Membres, droits et organisations de travail.</p>
              </header>
              <div className="settings-section-toolbar">
                <h3>Collaborateurs</h3>
                {user.role === 'org_admin' && (
                  <button className="secondary" onClick={onInvite}>
                    Inviter un collaborateur
                  </button>
                )}
              </div>
              <OrganizationRoles
                members={members}
                user={user}
                onError={onError}
                onSaved={onSaved}
              />
              <AccountSettings user={user} onError={onError} section="organization" />
            </>
          )}
          {section === 'availability' && (
            <>
              <header>
                <h2>Disponibilités</h2>
                <p>Votre capacité hebdomadaire et vos indisponibilités.</p>
              </header>
              <Availability user={user} onError={onError} />
            </>
          )}
          {section === 'services' && (
            <>
              <header>
                <h2>Services connectés</h2>
                <p>Les intégrations disponibles pour votre entreprise.</p>
              </header>
              <div className="service-list">
                {[
                  'Assistant IA',
                  'Google Calendar',
                  'Microsoft Outlook',
                  'E-mail transactionnel',
                ].map((label) => (
                  <article key={label}>
                    <strong>{label}</strong>
                    <span>Non connecté</span>
                  </article>
                ))}
              </div>
              <p className="muted small-text">Aucune donnée n’est envoyée à ces services.</p>
            </>
          )}
          {message && (
            <p className="success" role="status">
              {message}
            </p>
          )}
        </section>
      </div>
    </>
  );
}
