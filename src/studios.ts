import type { Studio } from "./types.ts";

export const studios: Studio[] = [
  {
    id: "shala",
    name: "The Shala",
    platform: "teamup",
    providerId: 10213813,
    venueName: "In-Studio",
    color: "#7FB0E0",
    // Yoga-only studio
    isYoga: () => true,
  },
  {
    id: "yogaloft",
    name: "Yoga Loft",
    platform: "mindbody",
    widgetId: "4e47979c86c",
    color: "#EB8DB2",
    // Yoga-only studio
    isYoga: () => true,
  },
  {
    id: "lighthouse",
    name: "Lighthouse",
    platform: "wix",
    siteUrl: "https://www.lighthouseholistic.co.za",
    // Wix resource type for staff. Teachers appear under it.
    staffResourceTypeId: "1cd44cf8-756f-41c3-bd90-3e2ffcaf1155",
    color: "#E7B95A",
    // Mixed studio: sauna, hire, sound baths and breathwork share the schedule
    isYoga: ({ name, category }) => {
      // "Closed (...)" placeholders and the all-day lounge pass sit in the DAILY YOGA category
      if (/^closed\b|day drop-in/i.test(name)) return false;
      if (category === "DAILY YOGA" || category === "AERIAL YOGA") return true;
      return category === "WORKSHOPS" && /yoga|yin|nidra/i.test(name);
    },
  },
];
