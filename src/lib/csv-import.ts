export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
}

export interface MappedTask {
  title: string;
  dueDate: string | null;
  isCompleted: boolean;
  notes: string | null;
  listName: string | null;
}

/**
 * Parse CSV text into headers and rows.
 * Auto-detects comma vs semicolon separator.
 * Supports quoted fields with escaped quotes.
 */
export function parseCSV(text: string): ParsedCSV {
  const lines = splitCSVLines(text);
  if (lines.length === 0) return { headers: [], rows: [] };

  const separator = detectSeparator(lines[0]);
  const headers = parseLine(lines[0], separator);

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;
    const values = parseLine(line, separator);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? "";
    }
    rows.push(row);
  }

  return { headers, rows };
}

function splitCSVLines(text: string): string[] {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      lines.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

function detectSeparator(headerLine: string): string {
  const commaCount = (headerLine.match(/,/g) ?? []).length;
  const semicolonCount = (headerLine.match(/;/g) ?? []).length;
  return semicolonCount > commaCount ? ";" : ",";
}

function parseLine(line: string, separator: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === separator) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

const SUBJECT_ALIASES = ["subject", "předmět", "task", "title", "úkol", "název"];
const DUE_DATE_ALIASES = ["due date", "datum splnění", "deadline", "termín"];
const STATUS_ALIASES = ["status", "stav", "% complete"];
const NOTES_ALIASES = ["notes", "poznámky", "body", "description", "popis"];
const CATEGORY_ALIASES = ["categories", "kategorie", "category", "seznam", "list"];

function findColumn(row: Record<string, string>, aliases: string[]): string | undefined {
  for (const key of Object.keys(row)) {
    const lower = key.toLowerCase().trim();
    if (aliases.includes(lower)) return row[key];
  }
  return undefined;
}

/**
 * Parse date string in various formats to YYYY-MM-DD.
 * Supports: YYYY-MM-DD, MM/DD/YYYY, DD.MM.YYYY, D.M.YYYY
 */
export function parseDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // YYYY-MM-DD (ISO)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // MM/DD/YYYY
  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const [, m, d, y] = usMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // DD.MM.YYYY or D.M.YYYY
  const euMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (euMatch) {
    const [, d, m, y] = euMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return null;
}

const COMPLETED_VALUES = ["completed", "dokončeno", "dokončený", "hotovo", "done"];

/**
 * Map an Outlook CSV row to a task import object.
 * Column matching is case-insensitive.
 */
export function mapOutlookTaskRow(row: Record<string, string>): MappedTask | null {
  const title = findColumn(row, SUBJECT_ALIASES);
  if (!title?.trim()) return null;

  const dueDateRaw = findColumn(row, DUE_DATE_ALIASES) ?? "";
  const statusRaw = findColumn(row, STATUS_ALIASES) ?? "";
  const notesRaw = findColumn(row, NOTES_ALIASES) ?? "";
  const categoryRaw = findColumn(row, CATEGORY_ALIASES) ?? "";

  // % Complete column: "100" means completed
  const isPercentComplete = statusRaw.trim() === "100";
  const isCompletedByStatus = COMPLETED_VALUES.includes(statusRaw.trim().toLowerCase());

  return {
    title: title.trim(),
    dueDate: parseDate(dueDateRaw),
    isCompleted: isCompletedByStatus || isPercentComplete,
    notes: notesRaw.trim() || null,
    listName: categoryRaw.trim() || null,
  };
}
