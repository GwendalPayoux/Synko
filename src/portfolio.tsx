import { useState, useEffect, type FormEvent } from 'react';
import { api, type User, displayDate, today } from './domain';
import { Field, Progress } from './components';
export function Portfolio({
  onOpen,
  onError,
}: {
  onOpen: (id: string) => void;
  onError: (s: string) => void;
}) {
  const [items, setItems] = useState<
    {
      id: string;
      name: string;
      end_date: string;
      progress: number;
      overdue: number;
      budget: { variance_cents: number; projected_cents: number };
    }[]
  >([]);
  useEffect(() => {
    api<typeof items>('/portfolio')
      .then(setItems)
      .catch((e) => onError(e.message));
  }, []);
  const money = (n: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(n / 100);
  return (
    <section className="panel portfolio-panel">
      <div className="panel-head">
        <div>
          <h3>Portefeuille de l’entreprise</h3>
          <p className="muted">Vue transversale PMO · projets actifs et alertes calculées</p>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Projet</th>
              <th>Avancement</th>
              <th>Échéance</th>
              <th>Tâches en retard</th>
              <th>Coût prévisionnel</th>
              <th>Marge budgétaire</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td>
                  <button className="link" onClick={() => onOpen(p.id)}>
                    {p.name}
                  </button>
                </td>
                <td>
                  <Progress value={p.progress} />
                  {p.progress}%
                </td>
                <td>{displayDate(p.end_date)}</td>
                <td className={p.overdue ? 'overdue' : ''}>{p.overdue}</td>
                <td>{money(p.budget.projected_cents)}</td>
                <td className={p.budget.variance_cents < 0 ? 'overdue' : ''}>
                  {money(p.budget.variance_cents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
export function Availability({ user, onError }: { user: User; onError: (s: string) => void }) {
  type Data = {
    members: { id: string; name: string; capacity_hours: number }[];
    absences: {
      id: string;
      user_id: string;
      user_name: string;
      start_date: string;
      end_date: string;
      reason: string;
    }[];
  };
  const [data, setData] = useState<Data | null>(null),
    [selected, setSelected] = useState(user.id),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  async function load() {
    setData(await api<Data>('/availability'));
  }
  useEffect(() => {
    load().catch((e) => onError(e.message));
  }, []);
  async function absent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    try {
      await api('/availability', 'POST', { ...b, user_id: selected });
      await load();
      setMessage('Indisponibilité enregistrée.');
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!data || user.role === 'reader') return null;
  return (
    <div className="availability">
      <hr />
      <h3>Capacité et disponibilités</h3>
      <Field label="Collaborateur">
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {data.members
            .filter((m) => user.role === 'org_admin' || m.id === user.id)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </select>
      </Field>
      <form
        key={selected}
        onSubmit={async (e) => {
          e.preventDefault();
          const b = Object.fromEntries(new FormData(e.currentTarget));
          try {
            await api('/capacity', 'PATCH', {
              user_id: selected,
              capacity_hours: Number(b.capacity_hours),
            });
            await load();
            setMessage('Capacité enregistrée.');
          } catch (e) {
            onError((e as Error).message);
          }
        }}
      >
        <Field label="Capacité hebdomadaire (heures)">
          <input
            name="capacity_hours"
            type="number"
            min="0"
            max="168"
            defaultValue={data.members.find((m) => m.id === selected)?.capacity_hours ?? 35}
            required
          />
        </Field>
        <button className="secondary">Enregistrer la capacité</button>
      </form>
      <form onSubmit={absent}>
        <div className="form-row">
          <Field label="Début de l’indisponibilité">
            <input name="start_date" type="date" defaultValue={today()} required />
          </Field>
          <Field label="Fin de l’indisponibilité">
            <input name="end_date" type="date" defaultValue={today()} required />
          </Field>
        </div>
        <Field label="Motif de l’indisponibilité">
          <input name="reason" maxLength={200} required placeholder="Ex. Congé, formation" />
        </Field>
        <button className="secondary" disabled={busy}>
          Ajouter l’indisponibilité
        </button>
      </form>
      {data.absences
        .filter((a) => a.user_id === selected)
        .map((a) => (
          <article key={a.id}>
            <p>
              {displayDate(a.start_date)} — {displayDate(a.end_date)} · {a.reason}
            </p>
            <button
              className="link"
              onClick={async () => {
                try {
                  await api('/availability/' + a.id, 'DELETE');
                  await load();
                } catch (e) {
                  onError((e as Error).message);
                }
              }}
            >
              Annuler cette indisponibilité
            </button>
          </article>
        ))}
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
