import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { api, today, shiftDate, type User } from './domain';
import { Modal, Field, Avatar } from './components';
import { ProjectIconPicker } from './project-icons';
type Template = {
  id: string;
  name: string;
  description: string;
  duration_days: number;
  icon: string;
};
export function CreateProject({
  user,
  onClose,
  onCreated,
  onError,
}: {
  user: User;
  onClose: () => void;
  onCreated: (id: string) => Promise<void>;
  onError: (s: string) => void;
}) {
  const [models, setModels] = useState<Template[]>([]),
    [model, setModel] = useState(''),
    [start, setStart] = useState(today()),
    [end, setEnd] = useState(shiftDate(today(), 30)),
    [description, setDescription] = useState(''),
    [icon, setIcon] = useState('folder'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    api<Template[]>('/templates')
      .then(setModels)
      .catch((e) => {
        setError('Les modèles ne peuvent pas être chargés. Réessayez en rouvrant ce formulaire.');
        onError(e.message);
      });
  }, []);
  const selected = models.find((m) => m.id === model);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError('');
    try {
      const p = await api<{ id: string }>('/projects', 'POST', {
        ...b,
        template_id: model || undefined,
        icon,
        start_date: start,
        end_date: end,
        description,
        budget_cents: Math.round(Number(b.budget || 0) * 100),
      });
      await onCreated(p.id);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Un nouveau projet" onClose={onClose} wide>
      <p className="modal-intro">Choisissez un point de départ, puis adaptez-le à votre équipe.</p>
      <form onSubmit={save} className="create-project-form">
        <Field label="Modèle de projet">
          <select
            value={model}
            onChange={(e) => {
              const next = models.find((m) => m.id === e.target.value);
              setModel(e.target.value);
              setEnd(shiftDate(start, next?.duration_days ?? 30));
              if (!description || description === selected?.description)
                setDescription(next?.description || '');
              setIcon(next?.icon || 'folder');
            }}
          >
            <option value="">Projet vierge (par défaut)</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        {selected && (
          <p className="template-description">
            {selected.description} · Planning de {selected.duration_days + 1} jours, avec tâches,
            jalons, dépendances et dossiers.
          </p>
        )}
        <Field label="Nom du projet">
          <input
            name="name"
            placeholder="Ex. Journée partenaires Synapt"
            required
            maxLength={160}
            autoFocus
          />
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={2000}
          />
        </Field>
        <div className="form-row">
          <Field label="Date de début">
            <input
              type="date"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                if (e.target.value)
                  setEnd(shiftDate(e.target.value, selected?.duration_days ?? 30));
              }}
              required
            />
          </Field>
          <Field label="Échéance prévisionnelle">
            <input
              type="date"
              value={end}
              min={start}
              onChange={(e) => setEnd(e.target.value)}
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
              defaultValue="0"
            />
          </Field>
          <Field label="Couleur du projet">
            <select name="color">
              <option value="sage">Sauge</option>
              <option value="blue">Ardoise</option>
              <option value="clay">Terracotta</option>
              <option value="violet">Lavande</option>
            </select>
          </Field>
        </div>
        <ProjectIconPicker value={icon} onChange={setIcon} />
        <div className="creation-note">
          <Avatar name={user.name} small />
          <span>
            Responsable : {user.name}
            <br />
            <small>{user.org_name}</small>
          </span>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" className="secondary" disabled={busy} onClick={onClose}>
            Annuler
          </button>
          <button className="primary" type="submit" disabled={busy}>
            {busy ? 'Création…' : 'Créer le projet'}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
