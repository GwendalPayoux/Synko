export const baseTemplates = [
  {
    key: 'event',
    name: 'Organisation d’un événement',
    description:
      'Définir le format, préparer la logistique et la communication, accueillir les participants puis dresser le bilan.',
    steps: [
      ['Cadrage, public et budget', 0, 4],
      ['Lieu et prestataires', 5, 11],
      ['Programme et intervenants', 12, 18],
      ['Communication et inscriptions', 19, 32],
      ['Préparation logistique', 33, 39],
      ['Jour de l’événement', 40, 40],
      ['Bilan et remerciements', 41, 45],
    ],
    folders: [
      'Cadrage et budget',
      'Prestataires',
      'Programme',
      'Communication',
      'Logistique',
      'Bilan',
    ],
    icon: 'calendar',
  },
  {
    key: 'it',
    name: 'Projet informatique',
    description: 'Cadrage, conception, développement, recette et mise en service.',
    steps: [
      ['Cadrage et besoins', 0, 4],
      ['Conception de la solution', 5, 9],
      ['Développement', 10, 24],
      ['Recette utilisateur', 25, 29],
      ['Mise en service', 30, 30],
    ],
    folders: ['Cadrage', 'Conception', 'Recette', 'Livrables'],
  },
  {
    key: 'organization',
    name: 'Transformation organisationnelle',
    description: 'Diagnostic, plan d’action, accompagnement et bilan.',
    steps: [
      ['Diagnostic partagé', 0, 6],
      ['Plan d’action', 7, 13],
      ['Mise en œuvre et accompagnement', 14, 34],
      ['Bilan et passage de relais', 35, 35],
    ],
    folders: ['Diagnostic', 'Plan d’action', 'Communication', 'Bilan'],
  },
  {
    key: 'technical',
    name: 'Projet technique',
    description: 'Études, préparation, réalisation, contrôle et réception.',
    steps: [
      ['Études et contraintes', 0, 6],
      ['Préparation des travaux', 7, 13],
      ['Réalisation', 14, 27],
      ['Contrôle et réception', 28, 28],
    ],
    folders: ['Études', 'Préparation', 'Exécution', 'Réception'],
  },
];
export function seedTemplates(run, orgId, userId) {
  for (const preset of baseTemplates) {
    const tasks = preset.steps.map(([title, start, end], i) => ({
      id: 'step-' + i,
      title,
      description: '',
      priority: 'normal',
      milestone: start === end ? 1 : 0,
      effort_hours: start === end ? 0 : 8,
      parent_id: null,
      start,
      end,
    }));
    const structure = {
      icon: preset.icon || 'folder',
      duration: preset.steps.at(-1)[2],
      tasks,
      dependencies: tasks.slice(1).map((t, i) => ({ task_id: t.id, predecessor_id: tasks[i].id })),
      folders: preset.folders.map((name, i) => ({ id: 'folder-' + i, name, parent_id: null })),
    };
    run(
      'INSERT OR IGNORE INTO templates VALUES (?,?,?,?,?,?,?)',
      `builtin-${preset.key}-${orgId}`,
      orgId,
      preset.name,
      preset.description,
      JSON.stringify(structure),
      userId,
      new Date().toISOString(),
    );
  }
}
