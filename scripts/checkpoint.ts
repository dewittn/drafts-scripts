#!/usr/bin/env bun
/**
 * Checkpoint helper: decides how far main can safely move toward dev.
 *
 * main is the stable fallback. It only fast-forwards to a dev commit that has
 * settled: the commit is at least --days old (default 3), and every commit that
 * touched the same files within that window after it has settled too. Bugs in
 * this repo tend to surface within a day or two, while a script is still being
 * revised, so a run of quick revisions holds the whole run back until it goes
 * quiet. The rule and the history behind the 3 days are explained in
 * .claude/skills/drafts-change-workflow/references/checkpoints.md.
 *
 * Usage: bun scripts/checkpoint.ts [promote [<sha>]] [--days N]
 *
 *   (no task)       report what has settled; changes nothing
 *   promote         move main to the newest settled commit, tag it, push both
 *   promote <sha>   same, for a commit picked by hand (warns if it has not settled)
 *
 * Docs-only changes cannot break Drafts, so they settle at once and never hold
 * anything back.
 */
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const DAY_MS = 24 * 60 * 60 * 1000;

// Paths that never reach the Drafts runtime.
const docsOnlyPaths = ["docs/", ".claude/", "types/"];
const isRuntimeFile = (file: string) =>
  !docsOnlyPaths.some((prefix) => file.startsWith(prefix)) && !(file.endsWith(".md") && !file.includes("/"));

type Commit = { sha: string; full: string; date: Date; subject: string; files: string[] };

const args = process.argv.slice(2);
const daysFlag = args.indexOf("--days");
const soakDays = daysFlag == -1 ? 3 : Number(args[daysFlag + 1]);
const soakMs = soakDays * DAY_MS;
const positional = args.filter((arg, i) => !arg.startsWith("--") && (daysFlag == -1 || i != daysFlag + 1));
const [task = "report", pickedSha] = positional;

// Run git without a shell. Returns stdout, or throws with git's stderr.
async function git(...gitArgs: string[]): Promise<string> {
  const proc = Bun.spawn(["git", ...gitArgs], { cwd: root, stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code != 0) throw new Error(`git ${gitArgs[0]} exited with code ${code}\n${stderr.trim()}`);
  return stdout;
}

// dev's own line of history since main, oldest first. A merged PR counts as
// one commit, dated when it landed on dev, with the files the whole PR changed.
async function loadCommits(): Promise<Commit[]> {
  const log = await git(
    "log", "--first-parent", "--diff-merges=first-parent", "--reverse", "--name-only",
    "--format=%x1e%h%x1f%H%x1f%cI%x1f%s", "main..dev",
  );
  return log.split("\x1e").slice(1).map((record) => {
    const [header, ...files] = record.trim().split("\n");
    const [sha, full, date, subject] = header.split("\x1f");
    return { sha, full, date: new Date(date), subject, files: files.filter((file) => file.trim() != "") };
  });
}

// Whether each commit has settled as of `now`. Walks newest to oldest, since a
// commit's status depends only on the commits after it.
function settledAsOf(commits: Commit[], now: number): boolean[] {
  const settled: boolean[] = [];
  for (let i = commits.length - 1; i >= 0; i--) settled[i] = holdUp(commits, settled, i, now) == undefined;
  return settled;
}

// Why commit i has not settled: "too new", or the later commit holding it back
// and the file they share. Undefined when it has settled.
function holdUp(commits: Commit[], settled: boolean[], i: number, now: number) {
  const commit = commits[i];
  const files = commit.files.filter(isRuntimeFile);
  if (files.length == 0) return undefined;
  if (now - commit.date.getTime() < soakMs) return { tooNew: true } as const;

  for (let j = i + 1; j < commits.length; j++) {
    const later = commits[j];
    if (later.date.getTime() - commit.date.getTime() >= soakMs) break;
    const shared = files.find((file) => later.files.includes(file));
    if (shared && !settled[j]) return { tooNew: false, by: j, file: shared } as const;
  }
  return undefined;
}

// Number of commits main can move forward: the settled run at the start.
const settledCount = (settled: boolean[]) => {
  const firstUnsettled = settled.indexOf(false);
  return firstUnsettled == -1 ? settled.length : firstUnsettled;
};

// The earliest time more commits settle, assuming nothing new lands on dev.
function nextSettle(commits: Commit[], now: number, current: number) {
  const times = commits.map((commit) => commit.date.getTime() + soakMs).filter((time) => time > now).sort();
  for (const time of times) {
    const count = settledCount(settledAsOf(commits, time));
    if (count > current) return { time, count };
  }
  return undefined;
}

// CalVer tag for a new checkpoint: YYYY.MM.NNN, counting up within the month.
async function nextTag(now: Date): Promise<string> {
  const month = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}`;
  const tags = (await git("tag", "--list", `${month}.*`)).split("\n").filter(Boolean);
  const last = Math.max(0, ...tags.map((tag) => Number(tag.split(".")[2]) || 0));
  return `${month}.${String(last + 1).padStart(3, "0")}`;
}

const describe = (commit: Commit) => `${commit.sha} ${commit.date.toISOString().slice(0, 10)} ${commit.subject}`;
const formatDate = (time: number) => new Date(time).toISOString().slice(0, 10);

// Follow the chain of hold-ups from the first unsettled commit to the commit
// that is simply too new.
function explainHold(commits: Commit[], settled: boolean[], start: number, now: number): string[] {
  const lines = [`Held back at ${describe(commits[start])}`];
  let i = start;
  for (let hold = holdUp(commits, settled, i, now); hold && !hold.tooNew; hold = holdUp(commits, settled, i, now)) {
    lines.push(`  waits on ${describe(commits[hold.by])}  (both change ${hold.file})`);
    i = hold.by;
  }
  lines.push(`  which is less than ${soakDays} days old`);
  return lines;
}

async function report() {
  const commits = await loadCommits();
  if (commits.length == 0) return console.log("main is up to date with dev.");

  const now = Date.now();
  const settled = settledAsOf(commits, now);
  const count = settledCount(settled);
  console.log(`main is ${commits.length} commits behind dev (${soakDays}-day settle rule).`);

  if (count == 0) {
    console.log("Nothing has settled yet.");
  } else {
    console.log(`\n${count} commit${count == 1 ? " has" : "s have"} settled and can move to main:`);
    commits.slice(0, count).forEach((commit) => console.log(`  ${describe(commit)}`));
    console.log(`\nCheckpoint: bun run checkpoint promote   (tag ${await nextTag(new Date(now))})`);
  }

  if (count < commits.length) {
    console.log("");
    explainHold(commits, settled, count, now).forEach((line) => console.log(line));
    const next = nextSettle(commits, now, count);
    if (next) console.log(`If nothing else changes, ${next.count} will have settled by ${formatDate(next.time)}.`);
  }
}

async function promote() {
  const commits = await loadCommits();
  const now = Date.now();
  const settled = settledAsOf(commits, now);
  const count = settledCount(settled);

  const target = pickedSha
    ? commits.findIndex((commit) => commit.full.startsWith(pickedSha) || commit.sha.startsWith(pickedSha))
    : count - 1;
  if (pickedSha && target == -1) throw new Error(`${pickedSha} is not on dev's line of history after main`);
  if (target < 0) throw new Error("Nothing has settled yet, so there is nothing to promote");
  if (target >= count) console.log(`Warning: ${commits[target].sha} has not settled; promoting it because it was picked by hand.`);

  const commit = commits[target];
  const tag = await nextTag(new Date(now));
  const included = commits.slice(0, target + 1);
  const message = [`Checkpoint ${tag}`, "", ...included.map((item) => `- ${item.subject}`)].join("\n");

  // Pushing a commit to main never needs a checkout: the remote refuses
  // anything but a fast-forward, and the fetch fast-forwards local main.
  await git("push", "origin", `${commit.full}:refs/heads/main`);
  await git("fetch", "origin", "main:main");
  await git("tag", "-a", tag, commit.full, "-m", message);
  await git("push", "origin", tag);

  console.log(`main moved forward ${included.length} commits to ${describe(commit)}`);
  console.log(`Tagged ${tag}`);
}

const tasks: Record<string, () => Promise<unknown>> = { report, promote };
const run = tasks[task];
if (!run || Number.isNaN(soakDays)) {
  console.error(`Usage: bun scripts/checkpoint.ts [promote [<sha>]] [--days N]`);
  process.exit(1);
}

try {
  await run();
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
