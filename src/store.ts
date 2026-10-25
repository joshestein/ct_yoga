import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Snapshot, StudioId } from "./types.ts";

/** Last good Snapshot per Studio. A failed fetch leaves the previous file in place. */
export async function loadSnapshot(dataDir: string, id: StudioId): Promise<Snapshot | null> {
  try {
    return JSON.parse(await readFile(join(dataDir, `${id}.json`), "utf8")) as Snapshot;
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "ENOENT") return null;
    throw err;
  }
}

export async function saveSnapshot(dataDir: string, id: StudioId, snapshot: Snapshot): Promise<void> {
  await writeAtomic(join(dataDir, `${id}.json`), JSON.stringify(snapshot));
}

/** Write to a temp file, then rename, so readers never see a partial file */
export async function writeAtomic(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, contents);
  await rename(tmp, path);
}
