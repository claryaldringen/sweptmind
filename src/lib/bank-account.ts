/**
 * The IBAN in a configured value, ignoring spaces and stray characters around it — the
 * production .env.local value ends with a literal backslash-n that pm2's env loader keeps.
 */
export function parseIban(value: string | null | undefined): string | null {
  const match = value
    ?.replace(/\s+/g, "")
    .toUpperCase()
    .match(/[A-Z]{2}\d{2}[A-Z0-9]{11,30}/);
  return match?.[0] ?? null;
}

/** "CZ6508000000192000145399" → "CZ65 0800 0000 1920 0014 5399" */
export function formatIban(iban: string): string {
  return iban
    .replace(/\s+/g, "")
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

/**
 * Czech domestic account number from a Czech IBAN ("19-2000145399/0800"),
 * null for other countries.
 */
export function czechAccountFromIban(iban: string): string | null {
  const compact = iban.replace(/\s+/g, "");
  const match = /^CZ\d{2}(\d{4})(\d{6})(\d{10})$/.exec(compact);
  if (!match) return null;
  const [, bank, prefix, number] = match;
  const trim = (digits: string) => digits.replace(/^0+/, "");
  const prefixPart = trim(prefix);
  return `${prefixPart ? `${prefixPart}-` : ""}${trim(number)}/${bank}`;
}
