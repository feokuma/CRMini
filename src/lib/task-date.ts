export interface DayRange {
  start: string;
  end: string;
}

export function saoPauloDayRange(day: string): DayRange {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const isValidDateFormat = datePattern
    .test(day);
  const normalizedDate = isValidDateFormat
    ? new Date(`${day}T00:00:00Z`)
        .toISOString()
        .slice(0, 10)
    : null;
  const isValidCalendarDate = normalizedDate === day;

  if (!isValidDateFormat || !isValidCalendarDate) {
    throw new Error("Data inválida.");
  }

  const dateParts = day
    .split("-");
  const [year, month, date] = dateParts
    .map(Number);
  const localMidnightUtc = Date.UTC(year, month - 1, date) + 3 * 60 * 60 * 1000;
  const next = new Date(localMidnightUtc + 86400000);

  const start = new Date(localMidnightUtc);

  return {
    start: start
      .toISOString(),
    end: next.toISOString(),
  };
}
