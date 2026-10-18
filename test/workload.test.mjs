import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weeklyWorkload } from '../server/workload.mjs';
test('Charge hebdomadaire : jours ouvrés, absences et avancement', () => {
  const tasks = [
      {
        assignee_id: 'u',
        start_date: '2026-10-19',
        end_date: '2026-10-23',
        effort_hours: 40,
        progress: 50,
        status: 'doing',
      },
    ],
    members = [{ id: 'u', name: 'Test', capacity_hours: 35 }];
  const result = weeklyWorkload(
    tasks,
    members,
    [{ user_id: 'u', start_date: '2026-10-19', end_date: '2026-10-23' }],
    '2026-10-19',
  )[0];
  assert.equal(result.weekly_hours, 20);
  assert.equal(result.available_hours, 0);
  assert.equal(result.overloaded, true);
  assert.equal(weeklyWorkload(tasks, members, [], '2026-10-19')[0].available_hours, 35);
});
