import { join } from "node:path";
import { fetchStudio } from "./adapters/index.ts";
import { render } from "./render.ts";
import { loadSnapshot, saveSnapshot, writeAtomic } from "./store.ts";
import { studios } from "./studios.ts";
import { DAY, UPCOMING_DAYS } from "./time.ts";

const dataDir = process.env.YOGA_DATA_DIR ?? "data";
const outFile = process.env.YOGA_OUT_FILE ?? join("dist", "index.html");

const now = new Date();
const window = { from: now, to: new Date(now.getTime() + UPCOMING_DAYS * DAY) };

const results = await Promise.allSettled(
  studios.map(async (studio) => {
    const classes = await fetchStudio(studio, window);
    await saveSnapshot(dataDir, studio.id, { fetchedAt: now.toISOString(), classes });
    return classes.length;
  }),
);

results.forEach((result, i) => {
  const studio = studios[i]!;
  if (result.status === "fulfilled") console.log(`${studio.name}: ${result.value} classes`);
  else console.error(`${studio.name}: update failed, keeping last good data`, result.reason);
});

const snapshots = await Promise.all(studios.map((s) => loadSnapshot(dataDir, s.id)));
await writeAtomic(outFile, render(studios, snapshots, now));
console.log(`Wrote ${outFile}`);

// Non-zero exit marks the systemd run as failed, so `systemctl status` shows a broken adapter
if (results.some((r) => r.status === "rejected")) process.exitCode = 1;
