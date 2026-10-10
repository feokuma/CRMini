export function saoPauloDayRange(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) throw new Error("Data inválida.");
  const [year, month, date] = day.split("-").map(Number);
  const localMidnightUtc = Date.UTC(year, month - 1, date) + 3 * 60 * 60 * 1000;
  const next = new Date(localMidnightUtc + 86400000);
  return { start: new Date(localMidnightUtc).toISOString(), end: next.toISOString() };
}
