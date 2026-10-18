import { HttpError } from './security.mjs';
export function assertAcyclic(edges) {
  const graph = new Map();
  for (const [a, b] of edges) {
    if (!graph.has(a)) graph.set(a, []);
    graph.get(a).push(b);
  }
  const visiting = new Set(),
    done = new Set();
  function visit(id) {
    if (visiting.has(id)) throw new HttpError(422, 'Cette relation crée un cycle.');
    if (done.has(id)) return;
    visiting.add(id);
    for (const next of graph.get(id) || []) visit(next);
    visiting.delete(id);
    done.add(id);
  }
  for (const id of graph.keys()) visit(id);
}
export function planningSummary(tasks, dependencies) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return dependencies.map((d) => ({
    ...d,
    conflict: byId.get(d.task_id)?.start_date <= byId.get(d.predecessor_id)?.end_date,
  }));
}
export function budgetSummary(project, entries, revisions) {
  const total = (kind) =>
    entries.filter((e) => e.kind === kind).reduce((s, e) => s + e.amount_cents, 0);
  const revised = revisions[0]?.amount_cents ?? project.budget_cents;
  const actual = total('actual'),
    commitment = total('commitment'),
    forecast = total('forecast');
  return {
    initial_cents: project.budget_cents,
    revised_cents: revised,
    actual_cents: actual,
    commitment_cents: commitment,
    forecast_cents: forecast,
    projected_cents: actual + commitment + forecast,
    variance_cents: revised - actual - commitment - forecast,
  };
}
