#!/usr/bin/env bun
/**
 * Back up the BVR runtime data before migrating or testing.
 *
 * Usage: bun run bvr:backup
 *
 * Copies every *.json under <Drafts>/Library/Data/bvr/ to
 * ~/Backups/drafts-bvr/<YYYY-MM-DD_HHMMSS>/, keeping the folder tree, and
 * prints the folder. File contents are never printed.
 *
 *   DRAFTS_DEST     read from this Drafts Documents folder instead of iCloud
 *   BVR_BACKUP_DIR  write backups under this folder instead of ~/Backups/drafts-bvr
 */
import { bvrDataDir } from "./lib/drafts-paths";
import { backupBvrData } from "./lib/bvr-backup";

const sourceDir = bvrDataDir();

try {
  const { folder, files } = await backupBvrData(sourceDir);
  if (folder == undefined) {
    console.error(`Nothing to back up: no .json files under ${sourceDir}`);
    process.exit(1);
  }
  console.log(`Backed up ${files.length} files from ${sourceDir}`);
  console.log(folder);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
