import { z } from "zod";
import { getJson } from "../http.ts";
import type { TeamupStudio, TimeWindow, YogaClass } from "../types.ts";

const BASE = "https://goteamup.com";

const Event = z.object({
  name: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
  schedule_type: z.string(),
  is_full: z.boolean(),
  customer_url: z.string(),
  instructors: z.array(z.object({ name: z.string() })),
  venue: z.object({ name: z.string() }),
});

const Page = z.object({
  next: z.string().nullable(),
  results: z.array(Event),
});

export type TeamupPage = z.infer<typeof Page>;

export async function fetchTeamup(studio: TeamupStudio, window: TimeWindow): Promise<YogaClass[]> {
  const headers = { "Teamup-Provider-ID": String(studio.providerId), "Teamup-Request-Mode": "customer" };
  const params = new URLSearchParams({
    expand: "instructors,venue",
    page_size: "100",
    sort: "start",
    status: "active",
    starts_at_gte: window.from.toISOString(),
    starts_at_lte: window.to.toISOString(),
  });

  const pages: TeamupPage[] = [];
  let url: string | null = `${BASE}/api/v2/events?${params}`;
  while (url) {
    const page: TeamupPage = Page.parse(await getJson(url, headers));
    pages.push(page);
    url = page.next;
  }
  return parseTeamup(pages, studio);
}

export function parseTeamup(pages: TeamupPage[], studio: TeamupStudio): YogaClass[] {
  return pages
    .flatMap((page) => page.results)
    .filter((e) => e.schedule_type === "class" && e.venue.name === studio.venueName && studio.isYoga({ name: e.name }))
    .map((e) => ({
      studio: studio.id,
      name: e.name.trim(),
      teacher: e.instructors.map((i) => i.name).join(", ") || null,
      start: e.starts_at,
      end: e.ends_at,
      // Anonymous requests get no attendance count (`occupancy` mirrors capacity), only `is_full`
      spotsLeft: null,
      full: e.is_full,
      bookingUrl: new URL(e.customer_url, BASE).toString(),
    }));
}
