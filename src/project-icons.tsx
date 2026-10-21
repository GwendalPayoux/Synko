import {
  FolderKanban,
  Rocket,
  BriefcaseBusiness,
  Code2,
  CalendarDays,
  Megaphone,
  Building2,
  Settings,
  Leaf,
  Flag,
  Lightbulb,
  Users,
} from 'lucide-react';
const choices = [
  ['folder', 'Dossier', FolderKanban],
  ['rocket', 'Lancement', Rocket],
  ['briefcase', 'Activité', BriefcaseBusiness],
  ['code', 'Informatique', Code2],
  ['calendar', 'Événement', CalendarDays],
  ['megaphone', 'Communication', Megaphone],
  ['building', 'Entreprise', Building2],
  ['settings', 'Technique', Settings],
  ['leaf', 'Environnement', Leaf],
  ['flag', 'Objectif', Flag],
  ['lightbulb', 'Innovation', Lightbulb],
  ['users', 'Équipe', Users],
] as const;
export function ProjectIcon({ name = 'folder', size = 24 }: { name?: string; size?: number }) {
  const Icon = choices.find((c) => c[0] === name)?.[2] || FolderKanban;
  return <Icon size={size} aria-hidden="true" />;
}
export function ProjectIconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <fieldset className="project-icon-picker">
      <legend>Icône du projet</legend>
      <div>
        {choices.map(([id, label, Icon]) => (
          <label key={id} className={value === id ? 'selected' : ''} title={label}>
            <input
              type="radio"
              name="icon"
              value={id}
              checked={value === id}
              onChange={() => onChange(id)}
              aria-label={label}
            />
            <Icon size={20} />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
