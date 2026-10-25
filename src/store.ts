import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { Snapshot, StudioId } from "./types.ts";

/** Last good Snapshot per Studio. A failed fetch leaves the previous file in place. */
export async function loadSnapshot(dataDir: string, id: StudioId): Promise<Snapshot | null> {
  const path = join(dataDir, `${id}.json`);
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "ENOENT") return null;
    throw err;
  }
  // A corrupt file must not take down the whole page: treat it like a missing one
  try {
    return JSON.parse(text) as Snapshot;
  } catch (err) {
    console.error(`${path}: unreadable snapshot, ignoring`, err);
    return null;
  }
}

export async function saveSnapshot(dataDir: string, id: StudioId, snapshot: Snapshot): Promise<void> {
  await writeAtomic(join(dataDir, `${id}.json`), JSON.stringify(snapshot));
}

/** Write to a temp file, then rename, so readers never see a partial file */
export async function writeAtomic(path: string, contents: string): Promise<void> {
  const dir = dirname(path);
  await mkdir(dir, { recursive: true });
  // Dotfile so a crash before the rename does not leave a publicly served stray in the web root
  const tmp = join(dir, `.${basename(path)}.${process.pid}.tmp`);
  await writeFile(tmp, contents);
  await rename(tmp, path);
}
