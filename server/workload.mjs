export function weeklyWorkload(tasks, members, absences, day) {
  const offset = (n) => new Date(Date.parse(day) + n * 86400000).toISOString().slice(0, 10),
    last = offset(6);
  const duration = (a, b) =>
    Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1);
  return members.map((m) => {
    const assigned = tasks.filter((t) => t.assignee_id === m.id && t.status !== 'done');
    let hours = 0;
    for (const t of assigned) {
      const start = t.start_date > day ? t.start_date : day,
        end = t.end_date < start ? start : t.end_date;
      const overlapStart = start > day ? start : day,
        overlapEnd = end < last ? end : last;
      if (overlapEnd >= overlapStart)
        hours +=
          (((t.effort_hours * (100 - t.progress)) / 100) * duration(overlapStart, overlapEnd)) /
          duration(start, end);
    }
    let days = 0;
    for (let n = 0; n < 7; n++) {
      const d = offset(n),
        weekday = new Date(d).getUTCDay();
      if (
        weekday !== 0 &&
        weekday !== 6 &&
        !absences.some((a) => a.user_id === m.id && a.start_date <= d && a.end_date >= d)
      )
        days++;
    }
    const available = (m.capacity_hours * days) / 5;
    return {
      ...m,
      weekly_hours: Math.round(hours * 10) / 10,
      available_hours: Math.round(available * 10) / 10,
      overloaded: hours > available,
      task_count: tasks.filter((t) => t.assignee_id === m.id).length,
      remaining_hours:
        Math.round(
          assigned.reduce((s, t) => s + (t.effort_hours * (100 - t.progress)) / 100, 0) * 10,
        ) / 10,
    };
  });
}
