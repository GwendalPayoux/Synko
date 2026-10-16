import { useState, type FormEvent } from 'react';
import { ArrowRight, Layers, ShieldCheck, CalendarDays, FolderKanban } from 'lucide-react';
import { api } from './domain';
import { Field } from './components';
export function Auth({ onLogin }: { onLogin: () => void }) {
  const invite = new URLSearchParams(location.search).get('invitation');
  const [mode, setMode] = useState(invite ? 'accept' : 'login'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api('/auth/' + mode, 'POST', { ...data, token: invite });
      history.replaceState(null, '', location.pathname);
      onLogin();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth">
      <section className="auth-story">
        <a className="brand" href="/">
          <span className="brand-mark">
            <Layers size={25} />
          </span>
          synko<span className="by">by Synapt</span>
        </a>
        <div>
          <div className="eyebrow">DE L’IDÉE À L’IMPACT</div>
          <h1>
            Vos projets.
            <br />
            Une vision claire.
          </h1>
          <p>
            Un espace commun pour organiser le travail,
            <br />
            aligner les équipes et avancer ensemble.
          </p>
          <div className="story-grid">
            <span>
              <CalendarDays />
              Planifier avec clarté
            </span>
            <span>
              <FolderKanban />
              Centraliser l’essentiel
            </span>
            <span>
              <ShieldCheck />
              Travailler en confiance
            </span>
          </div>
        </div>
        <footer>Synko · L’espace de travail de vos projets</footer>
      </section>
      <section className="auth-form">
        <div className="auth-inner">
          <span className="eyebrow">BIENVENUE SUR SYNKO</span>
          <h2>
            {mode === 'login'
              ? 'Heureux de vous retrouver.'
              : mode === 'accept'
                ? 'Rejoignez votre équipe.'
                : 'Votre prochain projet commence ici.'}
          </h2>
          <p>
            {mode === 'login'
              ? 'Connectez-vous à votre espace de travail.'
              : 'Créez votre compte pour commencer à collaborer.'}
          </p>
          <form onSubmit={submit}>
            {mode !== 'login' && (
              <Field label="Nom complet">
                <input name="name" autoComplete="name" required maxLength={100} />
              </Field>
            )}
            {mode === 'register' && (
              <Field label="Entreprise">
                <input name="organization" autoComplete="organization" required maxLength={120} />
              </Field>
            )}
            <Field label="Adresse e-mail professionnelle">
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="vous@entreprise.fr"
                required
              />
            </Field>
            <Field label="Mot de passe">
              <input
                name="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={12}
                maxLength={256}
                required
                placeholder="12 caractères minimum"
              />
            </Field>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="primary full" disabled={busy}>
              {busy
                ? 'Veuillez patienter…'
                : mode === 'login'
                  ? 'Se connecter'
                  : 'Créer mon compte'}
              <ArrowRight size={18} />
            </button>
          </form>
          {!invite && (
            <p className="auth-switch">
              {mode === 'login' ? 'Vous découvrez Synko ?' : 'Déjà un compte ?'}{' '}
              <button
                className="link"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setError('');
                }}
              >
                {mode === 'login' ? 'Créer un espace' : 'Se connecter'}
              </button>
            </p>
          )}
          <div className="auth-note">
            <ShieldCheck size={16} />
            Vos données restent dans votre espace entreprise.
          </div>
          <p className="muted small-text">
            Réinitialisation du mot de passe : non disponible dans cette première version.
          </p>
        </div>
      </section>
    </div>
  );
}
