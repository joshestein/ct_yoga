import { readFileSync } from "node:fs";
import { DAY, HOUR, TIME_ZONE, UPCOMING_DAYS, fromLocalDateTime, toLocalDate } from "./time.ts";
import type { ClientConfig, Snapshot, Studio, YogaClass } from "./types.ts";

// Inlined so the page stays one file that writeAtomic swaps in whole
const style = readFileSync(new URL("./style.css", import.meta.url), "utf8");
const script = readFileSync(new URL("./client.js", import.meta.url), "utf8");

const STALE_AFTER_HOURS = 2;
const FEW_SPOTS = 5;
/** Start-to-start gap that splits a day into morning, midday and evening runs */
const CLUSTER_GAP_HOURS = 2;

const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, weekday: "long" });
const shortDate = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, day: "numeric", month: "short" });
const dayLabel = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
});

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch);

export function render(studios: Studio[], snapshots: (Snapshot | null)[], generatedAt: Date): string {
  const studioById = new Map(studios.map((s) => [s.id, s]));
  const classes = snapshots
    .flatMap((s) => s?.classes ?? [])
    // Compare instants: platforms mix "Z" and "+02:00" offsets
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start) || a.studio.localeCompare(b.studio));

  const days = Map.groupBy(classes, (c) => toLocalDate(new Date(c.start)));
  const config: ClientConfig = {
    freshness: studios.map((s, i) => ({ name: s.name, fetchedAt: snapshots[i]?.fetchedAt ?? null })),
    staleAfterMs: STALE_AFTER_HOURS * HOUR,
    clusterGapMs: CLUSTER_GAP_HOURS * HOUR,
    dayMs: DAY,
    timeZone: TIME_ZONE,
    upcomingDays: UPCOMING_DAYS,
  };

  const row = (c: YogaClass) => {
    const studio = studioById.get(c.studio);
    const minutes = Math.round((Date.parse(c.end) - Date.parse(c.start)) / 60e3);
    const status = c.full ? "Full" : c.spotsLeft !== null && c.spotsLeft <= FEW_SPOTS ? `${c.spotsLeft} left` : "";
    return `
      <li class="${c.full ? "full" : ""}" style="--c:${studio?.color}" data-studio="${c.studio}" data-start="${c.start}">
        <a href="${escape(c.bookingUrl)}" target="_blank" rel="noopener">
          <span class="when"><time datetime="${c.start}">${clock.format(new Date(c.start))}</time>${minutes !== 60 ? `<span class="len">${minutes} min</span>` : ""}</span>
          <span class="what">
            <span class="name">${escape(c.name)}${status ? ` <span class="status">${status}</span>` : ""}</span>
            ${c.teacher ? `<span class="teacher">${escape(c.teacher)}</span>` : ""}
          </span>
          <span class="studio">${escape(studio?.name ?? c.studio)}</span>
        </a>
      </li>`;
  };

  const sections = [...days]
    .map(([date, dayClasses]) => {
      const noon = new Date(fromLocalDateTime(`${date}T12:00:00`));
      return `
    <section class="day" data-date="${date}" data-label="${dayLabel.format(noon)}">
      <h2><span class="big">${weekday.format(noon)}</span><span class="small">${shortDate.format(noon)}</span></h2>
      <ol>${dayClasses.map(row).join("")}</ol>
    </section>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#18181A">
<title>Yoga this week</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700;800&display=swap">
<style>
${style}</style>
</head>
<body>
<div class="wrap">
<header>
  <h1>Yoga this week</h1>
  <p class="updated">Updated ${clock.format(generatedAt)}, ${dayLabel.format(generatedAt)}</p>
  <div class="stale" hidden></div>
  <nav class="filter" aria-label="Studios">
    ${studios.map((s) => `<button type="button" style="--c:${s.color}" data-studio="${s.id}" aria-pressed="true">${escape(s.name)}</button>`).join("")}
  </nav>
</header>
<main>
${sections}
  <p class="empty" hidden></p>
</main>
</div>
<script type="application/json" id="config">${JSON.stringify(config).replaceAll("<", "\\u003c")}</script>
<script type="module">
${script}</script>
</body>
</html>
`;
}
