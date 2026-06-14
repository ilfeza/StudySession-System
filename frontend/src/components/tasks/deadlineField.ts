export function nowDeadlineParts() {
  const date = new Date();
  return {
    date: `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`,
    time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
  };
}

export function deadlineToParts(value?: string | null) {
  if (!value) {
    return { date: '', time: '' };
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { date: '', time: '' };
  }
  return {
    date: `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`,
    time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
  };
}

export function partsToDeadlineIso(datePart: string, timePart: string) {
  const dateMatch = datePart.trim().match(/^(\d{1,2})\.(\d{1,2})$/);
  const timeMatch = timePart.trim().match(/^(\d{1,2})[.:](\d{2})$/);
  if (!dateMatch || !timeMatch) {
    return null;
  }

  const day = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hours > 23 || minutes > 59) {
    return null;
  }

  const year = new Date().getFullYear();
  const parsed = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    return null;
  }

  return parsed.toISOString();
}

export function formatTimePart(value: string) {
  const match = value.trim().match(/^(\d{1,2})[.:](\d{2})$/);
  if (!match) {
    return value;
  }
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

export function formatCountdown(totalSeconds: number) {
  const negative = totalSeconds < 0;
  const abs = Math.abs(Math.floor(totalSeconds));
  const mm = String(Math.floor(abs / 60)).padStart(2, '0');
  const ss = String(abs % 60).padStart(2, '0');
  return `${negative ? '−' : ''}${mm}:${ss}`;
}
