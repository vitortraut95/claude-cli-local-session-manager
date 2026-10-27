import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import path from "node:path";
import type { UserPreferences } from "./preferencesService.js";
import { stopPreviewsIn } from "./previewService.js";
import { directoryExists, getActiveResumeSessionIds } from "./sessionService.js";
import { getUserSkillsDir } from "./skillsHubService.js";
import { launchTaskTerminal } from "./taskService.js";
import { firstWorkspaceDir } from "./workspaceService.js";
import { prepareWorktreeBestEffort } from "./worktreeSetupService.js";
import { API_PORT } from "../utils/apiPort.js";
import {
  forceRemoveWorktree,
  getRepoRoot,
  runGit,
  sanitizeWorktreeDirName,
  tryGit,
} from "../utils/git.js";
import { recordEvent } from "../utils/history.js";
import { AppError, ConflictError, errorMessage } from "../utils/httpError.js";
import {
  getTaskStore,
  markTestSession,
  setSessionStatus,
  setTestWorktrees,
  type QueueEntry,
} from "../utils/taskStore.js";

/**
 * Test entries of the task queue: someone else's task branch, tested by `taskTestSkill` (none = a
 * plain "test the task" prompt). Each repo
 * gets a disposable worktree detached at `origin/<branch>` (`.claude/worktrees/test-<key>`), so the
 * test can run locally and change files without touching the main checkouts. The session itself
 * opens in the first workspace dir with those worktrees as `--add-dir`, so it can still be resumed
 * after they're removed — once the session is marked done and closed (`cleanupFinishedTests`).
 */

/** A skill folder name as `/<name>` takes it — also keeps it from smuggling anything into the
 *  shell command or out of the skills folder. */
const SKILL_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

/** The configured `taskTestSkill`, checked to be installed; null when none is chosen. */
async function resolveTestSkill(prefs: UserPreferences): Promise<string | null> {
  const skill = prefs.taskTestSkill.trim();
  if (!skill) return null;
  try {
    if (!SKILL_NAME_PATTERN.test(skill)) throw new Error(`Invalid skill name: ${skill}`);
    await stat(path.join(getUserSkillsDir(), skill, "SKILL.md"));
  } catch (err) {
    throw new AppError(
      "TASK_TEST_SKILL_NOT_INSTALLED",
      `The task test skill "${skill}" isn't installed in ${getUserSkillsDir()}.`,
      { cause: err },
    );
  }
  return skill;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The branch to test in `repoRoot`, as on a fresh fetch of origin (the last fetched refs when
 * offline): `requested` when given, else the only origin branch with `key` in its name.
 */
async function resolveTestBranch(
  repoRoot: string,
  key: string,
  requested: string | null,
): Promise<string> {
  await runGit(["fetch", "origin", "--prune"], repoRoot, {
    nonInteractive: true,
    timeoutMs: 60_000,
  }).catch(() => undefined);
  const repo = path.basename(repoRoot);

  if (requested) {
    const found = await tryGit(
      ["rev-parse", "--verify", "--quiet", `refs/remotes/origin/${requested}^{commit}`],
      repoRoot,
    );
    if (!found) {
      throw new AppError(
        "TEST_BRANCH_NOT_FOUND",
        `${repo}: branch "${requested}" isn't on origin.`,
      );
    }
    return requested;
  }

  const refs = await runGit(
    ["for-each-ref", "--format=%(refname:lstrip=3)", "refs/remotes/origin"],
    repoRoot,
  );
  // The key as a whole token: PROJ-12 doesn't match PROJ-123.
  const pattern = new RegExp(`(^|[^A-Za-z0-9])${escapeRegExp(key)}($|[^0-9])`, "i");
  const matches = refs
    .split("\n")
    .map((ref) => ref.trim())
    .filter((ref) => ref && ref !== "HEAD" && pattern.test(ref));
  const [only] = matches;
  if (only && matches.length === 1) return only;
  if (matches.length === 0) {
    throw new AppError(
      "TEST_BRANCH_NOT_FOUND",
      `${repo}: no origin branch has "${key}" in its name — type the branch to test (it may ` +
        `have been merged into a grouping branch).`,
    );
  }
  throw new AppError(
    "TEST_BRANCH_AMBIGUOUS",
    `${repo}: more than one origin branch has "${key}" in its name (${matches.join(", ")}) — ` +
      `type the one to test.`,
  );
}

/** Test worktrees given to a session that's still running. */
async function worktreesInUse(): Promise<Set<string>> {
  const [store, active] = await Promise.all([getTaskStore(), getActiveResumeSessionIds()]);
  return new Set(
    Object.entries(store.sessions)
      .filter(([id, entry]) => active.has(id) && entry.test)
      .flatMap(([, entry]) => entry.test?.worktrees ?? []),
  );
}

/** A fresh worktree of `origin/<branch>` for the test; a leftover one from an earlier run is
 *  replaced, unless a running test still uses it. */
async function createTestWorktree(
  repoRoot: string,
  key: string,
  branch: string,
): Promise<{ worktreePath: string; linked: string[] }> {
  const worktreePath = path.join(
    repoRoot,
    ".claude",
    "worktrees",
    sanitizeWorktreeDirName(`test-${key}`),
  );
  if (await directoryExists(worktreePath)) {
    if ((await worktreesInUse()).has(worktreePath)) {
      throw new ConflictError(
        "TEST_WORKTREE_IN_USE",
        `A running test session still uses ${worktreePath} — close it first.`,
      );
    }
    await forceRemoveWorktree(worktreePath);
  }
  await runGit(["worktree", "add", "--detach", worktreePath, `origin/${branch}`], repoRoot);
  const setup = await prepareWorktreeBestEffort(repoRoot, worktreePath);
  return { worktreePath, linked: setup.linked.map((rel) => path.join(worktreePath, rel)) };
}

const PROMPT_TEXT = {
  en: {
    nickname: "Test - {link}",
    name: "Test {key}",
    noSkill: "Test the task {link}",
    worktrees:
      "Test worktrees (already added with --add-dir), each detached at the task branch from " +
      "origin: {dirs}. They're disposable and get deleted once this test is marked done: if the " +
      "test needs to run locally, run it there (installing, building and changing files is fine), " +
      "never in the main checkouts. Don't commit or push.",
    sharedNodeModules:
      "node_modules is a symlink to the main checkout's in: {dirs}. Before installing anything " +
      "there, delete just the link (rm node_modules, no -r).",
    failedRepos: "These repos couldn't be prepared for the test: {errors}",
    result:
      "Also save the final text (verdict and the text to paste in the task) as result.md in this " +
      "task's evidence folder, so it outlives this session.",
    done:
      "When the test is finished, mark it done (the worktrees are deleted once this session " +
      "closes): {command}",
  },
  pt: {
    nickname: "Teste - {link}",
    name: "Teste {key}",
    noSkill: "Teste a tarefa {link}",
    worktrees:
      "Worktrees de teste (já adicionados com --add-dir), cada um detached na branch da tarefa " +
      "do origin: {dirs}. São descartáveis e apagados quando este teste for marcado como " +
      "concluído: se o teste precisar rodar local, rode neles (pode instalar, buildar e alterar " +
      "arquivos), nunca nos checkouts principais. Não faça commit nem push.",
    sharedNodeModules:
      "O node_modules é um link para o da raiz do repo em: {dirs}. Antes de instalar algo ali, " +
      "apague só o link (rm node_modules, sem -r).",
    failedRepos: "Estes repos não puderam ser preparados para o teste: {errors}",
    result:
      "Salve também o texto final (veredito e o texto pra colar na tarefa) como resultado.md na " +
      "pasta de evidências desta tarefa, pra ele não depender desta sessão.",
    done:
      "Quando o teste terminar, marque como concluído (os worktrees são apagados quando esta " +
      "sessão fechar): {command}",
  },
};

export type TestLaunchOutcome = {
  sessionId: string;
  branch: string;
  worktreePath: string;
  addDirs: string[];
  extraErrors: string[];
  linkedNodeModules: number;
};

/** Launches a queue entry of kind "test". A repo after the first that can't be prepared doesn't
 *  stop the test (its error is returned); the first one does. With `noRepo`, the skill runs with
 *  no worktree at all. */
export async function launchTestEntry(
  entry: QueueEntry,
  prefs: UserPreferences,
): Promise<TestLaunchOutcome | null> {
  const [mainFolder] = entry.repos;
  if (!mainFolder && !entry.noRepo) return null;
  const skill = await resolveTestSkill(prefs);

  const worktrees: string[] = [];
  const linked: string[] = [];
  const extraErrors: string[] = [];
  let mainBranch = "";
  for (const folder of entry.repos) {
    try {
      const repoRoot = (await getRepoRoot(folder)) ?? folder;
      const branch = await resolveTestBranch(repoRoot, entry.key, entry.branch);
      const created = await createTestWorktree(repoRoot, entry.key, branch);
      worktrees.push(created.worktreePath);
      linked.push(...created.linked);
      if (folder === mainFolder) mainBranch = branch;
    } catch (err) {
      if (folder === mainFolder) {
        await Promise.all(worktrees.map((w) => forceRemoveWorktree(w).catch(() => undefined)));
        throw err;
      }
      extraErrors.push(`${folder}: ${errorMessage(err)}`);
    }
  }

  const text = PROMPT_TEXT[prefs.language ?? "en"];
  const link = entry.link ?? entry.key;
  const sessionId = randomUUID();
  const doneCommand =
    `curl -s -X PATCH http://localhost:${API_PORT}/sessions/${sessionId}/status ` +
    `-H 'Content-Type: application/json' -d '{"status":"done"}'`;
  const prompt = [
    skill ? `/${skill} ${link}` : text.noSkill.replace("{link}", link),
    worktrees.length > 0 ? text.worktrees.replace("{dirs}", worktrees.join(", ")) : "",
    linked.length > 0 ? text.sharedNodeModules.replace("{dirs}", linked.join(", ")) : "",
    extraErrors.length > 0 ? text.failedRepos.replace("{errors}", extraErrors.join("; ")) : "",
    text.result,
    text.done.replace("{command}", doneCommand),
  ]
    .filter(Boolean)
    .join("\n\n");

  // Marked before the terminal opens, so a session that dies right away is still cleaned up.
  await markTestSession(sessionId, entry.key, worktrees);
  try {
    await launchTaskTerminal({
      worktreePath: await firstWorkspaceDir(prefs),
      prompt,
      permissionModeAuto: prefs.taskTestPermissionModeAuto,
      repoRoot: "",
      nickname: text.nickname.replace("{link}", link),
      name: text.name.replace("{key}", entry.key),
      addDirs: worktrees,
      sessionId,
    });
  } catch (err) {
    await removeTestWorktrees(sessionId, worktrees);
    throw err;
  }
  await setSessionStatus(sessionId, "in_progress", "scheduler");
  return {
    sessionId,
    branch: mainBranch,
    worktreePath: worktrees[0] ?? "",
    addDirs: worktrees.slice(1),
    extraErrors,
    linkedNodeModules: linked.length,
  };
}

/** Removes `worktrees` (previews first); the ones that fail stay recorded for the next try. */
async function removeTestWorktrees(id: string, worktrees: string[]): Promise<void> {
  await stopPreviewsIn(worktrees, "removed").catch(() => undefined);
  const left: string[] = [];
  for (const worktree of worktrees) {
    try {
      await forceRemoveWorktree(worktree);
    } catch (err) {
      left.push(worktree);
      console.warn(`[tests] Couldn't remove ${worktree}: ${errorMessage(err)}`);
    }
  }
  await setTestWorktrees(id, left);
  recordEvent("test.cleaned", { sessionId: id, removed: worktrees.length - left.length, left });
}

/** Removes the worktrees of every test session marked done that isn't running anymore. */
export async function cleanupFinishedTests(): Promise<void> {
  const [store, active] = await Promise.all([getTaskStore(), getActiveResumeSessionIds()]);
  for (const [id, entry] of Object.entries(store.sessions)) {
    if (!entry.test?.worktrees.length || entry.status !== "done" || active.has(id)) continue;
    await removeTestWorktrees(id, entry.test.worktrees);
  }
}
