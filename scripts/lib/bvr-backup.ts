/**
 * Copy the BVR runtime JSON into a timestamped folder outside the repo.
 * A plain file copy: restoring is dragging the files back.
 */
import { existsSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const defaultBackupRoot = (): string =>
  process.env.BVR_BACKUP_DIR ?? join(homedir(), "Backups", "drafts-bvr");

const pad = (value: number) => String(value).padStart(2, "0");

// Local time as YYYY-MM-DD_HHMMSS, so folders sort by when they were made.
export function backupStamp(now: Date = new Date()): string {
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${date}_${time}`;
}

// A folder name that does not exist yet, in case two backups land in one second.
function freshFolder(backupRoot: string, stamp: string): string {
  let folder = join(backupRoot, stamp);
  for (let n = 2; existsSync(folder); n++) folder = join(backupRoot, `${stamp}_${n}`);
  return folder;
}

export interface BackupResult {
  folder: string | undefined;
  files: string[];
}

// Copy every *.json under sourceDir into a new folder under backupRoot,
// keeping the relative tree. Returns no folder when there was nothing to copy.
export async function backupBvrData(
  sourceDir: string,
  backupRoot: string = defaultBackupRoot(),
  now: Date = new Date(),
): Promise<BackupResult> {
  if (!existsSync(sourceDir)) throw new Error(`No BVR data folder at ${sourceDir}`);

  const files = [...new Bun.Glob("**/*.json").scanSync({ cwd: sourceDir })].sort();
  if (files.length == 0) return { folder: undefined, files };

  const folder = freshFolder(backupRoot, backupStamp(now));
  for (const file of files) {
    const target = join(folder, file);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(join(sourceDir, file), target);
  }
  return { folder, files };
}
