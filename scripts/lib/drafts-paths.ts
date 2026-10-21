/**
 * Where the Drafts library lives on disk. Shared by the build and the BVR
 * data scripts so they always agree on the destination.
 *
 * DRAFTS_DEST overrides the destination (the Drafts iCloud Documents folder).
 * Point it at a scratch directory to try a script without touching iCloud.
 */
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export const repoRoot = resolve(import.meta.dir, "..", "..");

export const defaultDraftsDest = join(
  homedir(), "Library", "Mobile Documents", "iCloud~com~agiletortoise~Drafts5", "Documents",
);

// The Drafts Documents folder this run works against.
export const draftsDest = (): string => process.env.DRAFTS_DEST ?? defaultDraftsDest;

// The BVR runtime data folder inside a Drafts Documents folder.
export const bvrDataDir = (dest: string = draftsDest()): string => join(dest, "Library", "Data", "bvr");

// The committed teams.yaml in this repo (build-time team config).
export const repoTeamsYaml = join(repoRoot, "Library", "Data", "bvr", "teams.yaml");
