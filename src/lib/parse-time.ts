/**
 * Parse a loose time string into HH:mm format.
 * Accepts: "14", "14:30", "9", "9:5", "0930", "1430", "2:30pm", "2pm", etc.
 */
export function parseTimeInput(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;

  let hours: number;
  let minutes: number;

  // Handle am/pm suffix
  const pmMatch = s.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)$/);
  if (pmMatch) {
    hours = parseInt(pmMatch[1], 10);
    minutes = pmMatch[2] ? parseInt(pmMatch[2], 10) : 0;
    if (pmMatch[3] === "pm" && hours < 12) hours += 12;
    if (pmMatch[3] === "am" && hours === 12) hours = 0;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  // Try HH:MM or H:MM
  const colonMatch = s.match(/^(\d{1,2}):(\d{1,2})$/);
  if (colonMatch) {
    hours = parseInt(colonMatch[1], 10);
    minutes = parseInt(colonMatch[2], 10);
  } else {
    // Try pure digits: 1-2 digits = hours, 3-4 digits = HHMM
    const digitMatch = s.match(/^(\d{1,4})$/);
    if (!digitMatch) return null;
    const num = digitMatch[1];
    if (num.length <= 2) {
      hours = parseInt(num, 10);
      minutes = 0;
    } else {
      // 3-4 digits: last two are minutes
      minutes = parseInt(num.slice(-2), 10);
      hours = parseInt(num.slice(0, -2), 10);
    }
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
