import type { Studio, TimeWindow, YogaClass } from "../types.ts";
import { fetchMindbody } from "./mindbody.ts";
import { fetchTeamup } from "./teamup.ts";
import { fetchWix } from "./wix.ts";

/** Classes that start inside `window`. Clipped here because not every platform takes a date range. */
export async function fetchStudio(studio: Studio, window: TimeWindow): Promise<YogaClass[]> {
  const classes = (await fetchPlatform(studio, window)).filter((c) => {
    const start = new Date(c.start);
    return start >= window.from && start <= window.to;
  });
  // A week without Classes means a renamed venue or category, or a closure. Keep the last good
  // Snapshot either way: the page then shows a stale warning, not a silently empty Studio.
  if (classes.length === 0) throw new Error(`${studio.name}: no classes in the window`);
  return classes;
}

function fetchPlatform(studio: Studio, window: TimeWindow): Promise<YogaClass[]> {
  switch (studio.platform) {
    case "teamup":
      return fetchTeamup(studio, window);
    case "mindbody":
      return fetchMindbody(studio);
    case "wix":
      return fetchWix(studio, window);
  }
}
