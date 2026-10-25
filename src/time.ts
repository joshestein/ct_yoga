// All Studios are in Cape Town. South Africa has no daylight saving, so the offset is fixed.
export const TIME_ZONE = "Africa/Johannesburg";
const OFFSET = "+02:00";

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

/** See CONTEXT.md "Upcoming" */
export const UPCOMING_DAYS = 7;

const localParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** "2026-10-27T17:15:00" in SAST */
export function toLocalDateTime(date: Date): string {
  const p = Object.fromEntries(localParts.formatToParts(date).map(({ type, value }) => [type, value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}

/** "2026-10-27" in SAST */
export function toLocalDate(date: Date): string {
  return toLocalDateTime(date).slice(0, 10);
}

/** SAST wall-clock time without offset -> ISO with offset */
export function fromLocalDateTime(local: string): string {
  return `${local.slice(0, 19)}${OFFSET}`;
}
