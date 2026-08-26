import { format, parseISO } from "date-fns";
import type { Locale as DateFnsLocale } from "date-fns";
import type { Locale } from "@/lib/i18n/types";

/**
 * Formátovací vzory pro data úkolu. Datum i čas jsou lokalizované:
 * čeština používá číselné datum a 24hodinový čas, angličtina "MMM d" a AM/PM.
 * `sep` odděluje datum od času.
 */
const PATTERNS: Record<Locale, { date: string; sep: string; time: string }[]> = {
  cs: [
    // [0] = bez roku (seznam úkolů), [1] = s rokem (detail úkolu)
    { date: "d.M.", sep: ", ", time: "H:mm" },
    { date: "d.M.yyyy", sep: ", ", time: "H:mm" },
  ],
  en: [
    { date: "MMM d", sep: ", ", time: "h:mm a" },
    { date: "MMM d, yyyy", sep: " ", time: "h:mm a" },
  ],
};

interface FormatTaskDateOptions {
  locale: Locale;
  dateFnsLocale: DateFnsLocale;
  /** Zobrazit rok (detail úkolu ano, seznam ne). */
  withYear?: boolean;
  /** Nahradí datum slovním popiskem, např. "Dnes". */
  dayLabel?: string;
}

/**
 * Naformátuje jedno datum úkolu (termín, připomínka).
 *
 * Datumy jsou "naivní" lokální řetězce: "yyyy-MM-dd" nebo "yyyy-MM-dd'T'HH:mm".
 * Čas se přidá jen tehdy, když ho řetězec obsahuje.
 */
export function formatTaskDate(
  value: string,
  { locale, dateFnsLocale, withYear = false, dayLabel }: FormatTaskDateOptions,
): string {
  const patterns = PATTERNS[locale][withYear ? 1 : 0];
  const day = dayLabel ?? format(parseISO(value), patterns.date, { locale: dateFnsLocale });
  if (!value.includes("T")) return day;
  const time = format(parseISO(value), patterns.time, { locale: dateFnsLocale });
  return `${day}${patterns.sep}${time}`;
}

/**
 * Naformátuje termín úkolu, případně jeho rozsah (dueDate – dueDateEnd).
 *
 * Když začátek i konec padnou do stejného dne, datum se vypíše jen jednou
 * a z konce zbude pouhý čas ("27.8.2026, 11:00 – 14:00").
 */
export function formatDueDate(
  dueDate: string,
  dueDateEnd: string | null,
  options: FormatTaskDateOptions,
): string {
  const start = formatTaskDate(dueDate, options);
  if (!dueDateEnd) return start;

  const sameDay = dueDate.split("T")[0] === dueDateEnd.split("T")[0];
  if (!sameDay) {
    return `${start} – ${formatTaskDate(dueDateEnd, { ...options, dayLabel: undefined })}`;
  }

  // Stejný den: datum se neopakuje, z konce zbude jen čas (a když ho nemá, zmizí celý).
  if (!dueDateEnd.includes("T")) return start;
  const { locale, dateFnsLocale, withYear = false } = options;
  const endTime = format(parseISO(dueDateEnd), PATTERNS[locale][withYear ? 1 : 0].time, {
    locale: dateFnsLocale,
  });
  return `${start} – ${endTime}`;
}
