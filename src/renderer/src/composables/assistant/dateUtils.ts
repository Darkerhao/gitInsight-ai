export function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function shiftLocalDate(date: string, deltaDays: number) {
  const [year, month, day] = date.split('-').map(Number);
  return formatLocalDate(new Date(year, month - 1, day + deltaDays));
}

export function buildDateTime(date: string, time: string) {
  return `${date}T${time}:00`;
}
