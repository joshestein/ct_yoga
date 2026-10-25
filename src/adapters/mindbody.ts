import { z } from "zod";
import { request } from "../http.ts";
import type { MindbodyStudio, YogaClass } from "../types.ts";

// The V2 schedule widget server-renders the next 7 days into Next.js flight data.
// It keeps the selected day in JS state only, so Booking Links open the schedule itself.
const widgetUrl = (widgetId: string) =>
  `https://go.mindbodyonline.com/book/widgets/schedules/view/${widgetId}/schedule`;

const Staff = z.object({ displayLabel: z.string() });

const Session = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  capacity: z.number(),
  numberRegistered: z.number(),
  startDateTime: z.string(),
  endDateTime: z.string(),
  cancelled: z.boolean(),
  // A Teacher who appears more than once is a "$2d" reference to flight row "2d"
  staff: z.array(z.union([Staff, z.string()])),
});

type Session = Omit<z.infer<typeof Session>, "staff"> & { staff: z.infer<typeof Staff>[] };

export async function fetchMindbody(studio: MindbodyStudio): Promise<YogaClass[]> {
  const html = await (await request(widgetUrl(studio.widgetId))).text();
  return parseMindbody(html, studio);
}

export function parseMindbody(html: string, studio: MindbodyStudio): YogaClass[] {
  const sessions = extractSessions(html);
  // An empty result means a changed page or a Cloudflare challenge, not an empty week
  if (sessions.length === 0) throw new Error("Mindbody: no class sessions found in widget HTML");

  return sessions
    .filter((s) => s.type === "Class" && !s.cancelled && studio.isYoga({ name: s.name }))
    .map((s) => {
      const spotsLeft = Math.max(0, s.capacity - s.numberRegistered);
      return {
        studio: studio.id,
        name: s.name.trim(),
        teacher: s.staff.map((p) => p.displayLabel).join(", ") || null,
        start: normaliseUtc(s.startDateTime),
        end: normaliseUtc(s.endDateTime),
        spotsLeft,
        full: spotsLeft === 0,
        bookingUrl: widgetUrl(studio.widgetId),
      };
    });
}

/** "2026-10-26T04:00:00.0000000Z" has 7 fraction digits, which Date does not accept everywhere */
function normaliseUtc(value: string): string {
  return new Date(value.replace(/\.\d+Z$/, "Z")).toISOString();
}

function extractSessions(html: string): Session[] {
  const flight = [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)]
    .map(([, literal]) => JSON.parse(literal ?? '""') as string)
    .join("");

  const resolveStaff = (ref: string) => {
    const row = new RegExp(`(?:^|\\n)${ref.slice(1)}:\\{`).exec(flight);
    if (!row) throw new Error(`Mindbody: unresolved staff reference ${ref}`);
    return Staff.parse(JSON.parse(balancedObject(flight, row.index + row[0].length - 1)));
  };

  const byId = new Map<string, Session>();
  for (const match of flight.matchAll(/\{"id":"cinst_/g)) {
    const raw = Session.parse(JSON.parse(balancedObject(flight, match.index)));
    const staff = raw.staff.map((s) => (typeof s === "string" ? resolveStaff(s) : s));
    byId.set(raw.id, { ...raw, staff });
  }
  return [...byId.values()];
}

/** The JSON object that starts at `start`, found by brace matching outside of strings */
function balancedObject(text: string, start: number): string {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  throw new Error("Mindbody: unterminated class session object");
}
