import { useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { type Task, today, shiftDate, displayDate, dayDiff } from './domain';
export function Calendar({
  tasks,
  onTask,
  large = false,
}: {
  tasks: Task[];
  onTask: (t: Task) => void;
  large?: boolean;
}) {
  const [anchor, setAnchor] = useState(today()),
    [view, setView] = useState('month');
  const start = anchor.slice(0, 7) + '-01';
  const weekday = (new Date(start + 'T12:00:00').getDay() + 6) % 7;
  const weekStart = shiftDate(anchor, -((new Date(anchor + 'T12:00:00').getDay() + 6) % 7));
  const first = view === 'week' ? weekStart : shiftDate(start, -weekday);
  const days = Array.from({ length: view === 'week' ? 7 : 42 }, (_, i) => shiftDate(first, i));
  function move(direction: number) {
    if (view === 'week') setAnchor(shiftDate(anchor, direction * 7));
    else {
      const d = new Date(start + 'T12:00:00');
      d.setMonth(d.getMonth() + direction);
      setAnchor(d.toLocaleDateString('en-CA'));
    }
  }
  return (
    <section className={'panel calendar ' + (large ? 'large-calendar' : '')}>
      <div className="panel-head">
        <div>
          <h3>
            <CalendarDays size={18} />
            Mon calendrier
          </h3>
          <span className="muted">Vos échéances, au même endroit</span>
        </div>
        <div className="calendar-controls">
          <div className="segmented">
            {[
              ['month', 'Mois'],
              ['week', 'Semaine'],
              ['agenda', 'Agenda'],
            ].map(([id, label]) => (
              <button
                key={id}
                className={view === id ? 'selected' : ''}
                onClick={() => setView(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="month-head">
        <strong>
          {new Date(anchor + 'T12:00:00').toLocaleDateString('fr-FR', {
            month: 'long',
            year: 'numeric',
          })}
        </strong>
        <div>
          <button className="subtle" onClick={() => setAnchor(today())}>
            Aujourd’hui
          </button>
          <button className="icon-button" aria-label="Période précédente" onClick={() => move(-1)}>
            <ChevronLeft size={17} />
          </button>
          <button className="icon-button" aria-label="Période suivante" onClick={() => move(1)}>
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      {view === 'agenda' ? (
        <div className="agenda">
          {tasks
            .filter((t) => t.end_date >= anchor && dayDiff(anchor, t.end_date) < 31)
            .sort((a, b) => a.end_date.localeCompare(b.end_date))
            .map((t) => (
              <button key={t.id} onClick={() => onTask(t)}>
                <span>{displayDate(t.end_date)}</span>
                <strong>{t.title}</strong>
                <span className="muted">{t.project_name}</span>
              </button>
            ))}
          {!tasks.some((t) => t.end_date >= anchor && dayDiff(anchor, t.end_date) < 31) && (
            <p className="muted">Aucune échéance dans les 30 prochains jours.</p>
          )}
        </div>
      ) : (
        <>
          <div className="calendar-weekdays">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {days.map((d) => (
              <div
                key={d}
                className={
                  'calendar-day ' +
                  (d === today() ? 'is-today ' : '') +
                  (d.slice(0, 7) !== anchor.slice(0, 7) && view === 'month' ? 'outside' : '')
                }
              >
                <span className="day-number">{Number(d.slice(-2))}</span>
                {tasks
                  .filter((t) => t.end_date === d)
                  .slice(0, large ? 4 : 2)
                  .map((t) => (
                    <button
                      key={t.id}
                      className={'calendar-event ' + (t.milestone ? 'milestone' : '')}
                      onClick={() => onTask(t)}
                      title={t.title}
                    >
                      {t.milestone ? '◆ ' : ''}
                      {t.title}
                    </button>
                  ))}
                {tasks.filter((t) => t.end_date === d).length > (large ? 4 : 2) && (
                  <small>
                    + {tasks.filter((t) => t.end_date === d).length - (large ? 4 : 2)} autres
                  </small>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
