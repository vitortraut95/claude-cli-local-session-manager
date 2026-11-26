#!/usr/bin/env node
/**
 * Prints the lane of a heavy-run command (its argv, or a `bash -c '…'` chain): "light" or "heavy".
 * With `--kind` first, prints the command's kind instead (heavy-run's history key uses it):
 * build, install, typecheck, test-full, test-files, lint, git, docker or other — the heaviest kind
 * in the chain wins, in that order.
 *
 * Heavy commands (builds, installs, whole-project typecheck/lint, full test suites, containers) take
 * one of the shared test slots. Light ones — git commit/push (their hooks touch only the staged
 * files), lint/format of explicit files, tests of explicit files or folders — skip the slot queue,
 * so a 5-second commit never waits behind a 20-minute build; they still wait for free RAM and run
 * with the same caps. Anything not recognized as light counts as heavy.
 */

const argv = process.argv.slice(2);
const kindMode = argv[0] === "--kind";
const text = (kindMode ? argv.slice(1) : argv).join(" ");

/** Shell segments: split on `;`, `&&`, `||`, `|` and newlines outside quotes, quotes dropped. */
const splitSegments = (source) => {
  const parts = [];
  let current = "";
  let quote = "";
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quote) {
      if (char === quote) quote = "";
      else current += char;
    } else if (char === "'" || char === '"') {
      quote = char;
    } else if (char === ";" || char === "\n" || char === "|" || char === "&") {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts;
};

/** Segments, with the body of a `bash -c '…'` (quoted, so one segment) split as its own chain. */
const chainSegments = (source) =>
  splitSegments(source).flatMap((segment) => {
    const nested = segment.match(/^\s*(?:\w+=\S*\s+)*(?:\S*\/)?(?:bash|sh)\s+-c\s+([\s\S]*)$/);
    return nested ? chainSegments(nested[1]) : [segment];
  });

/** Words of a segment without leading `VAR=value` assignments and `npx`/`yarn`/`pnpm exec` runners. */
const words = (segment) => {
  const list = segment.trim().split(/\s+/).filter(Boolean);
  while (list.length && /^\w+=/.test(list[0])) list.shift();
  while (list.length && /^(npx|exec|bash|sh|-c|nice|ionice|time)$/.test(list[0])) list.shift();
  if (list[0] === "yarn" || list[0] === "pnpm") list.shift();
  while (list.length && list[0].startsWith("-")) list.shift();
  if (list[0] === "run" || list[0] === "exec") list.shift();
  return list;
};

/** Positional args that name files or folders (not flags, not the whole project). */
const pathArgs = (args) =>
  args.filter((arg) => !arg.startsWith("-") && arg !== "." && arg !== "./" && /[/.]/.test(arg));

/** Jest/vitest targets: a `--flag value` pair's value isn't a target; `--flag=value` carries its own. */
const testTargets = (args) =>
  args.filter(
    (arg, i) =>
      !arg.startsWith("-") && !(args[i - 1]?.startsWith("--") && !args[i - 1].includes("=")),
  );

const LIGHT_TOOLS = new Set(["eslint", "prettier", "stylelint"]);
const TEST_TOOLS = new Set(["jest", "vitest"]);

/** "light", "heavy" or "neutral" (cd, echo, grep… — doesn't decide the lane). */
const classify = (segment) => {
  const [tool = "", ...args] = words(segment);
  const name = tool.split("/").pop();
  if (!name) return "neutral";
  if (name === "git") {
    const verb = args.find((arg, i) => !arg.startsWith("-") && args[i - 1] !== "-C");
    return verb === "commit" || verb === "push" ? "light" : "neutral";
  }
  if (LIGHT_TOOLS.has(name)) return pathArgs(args).length ? "light" : "heavy";
  if (TEST_TOOLS.has(name)) return testTargets(args).length ? "light" : "heavy";
  // A test script narrowed to files (`yarn test:unit src/a.test.ts`) is as light as jest on them.
  if (/^test(:[\w-]+)?$/.test(name)) return pathArgs(args).length ? "light" : "heavy";
  if (/^(tsc|vue-tsc|next|make|docker|npm|node|tsx)$/.test(name)) return "heavy";
  if (/^(test|typecheck|type-check|lint|build|install|ci|i)(:[\w-]+)?$/.test(name)) return "heavy";
  return "neutral";
};

/** Kinds from heaviest to lightest: the first one present in a chain is its kind. */
const KIND_ORDER = [
  "build",
  "install",
  "typecheck",
  "test-full",
  "test-files",
  "lint",
  "git",
  "docker",
  "other",
];

/** The kind of one segment, or null when it's neutral (cd, echo, grep…). */
const kindOf = (segment) => {
  const [tool = "", ...args] = words(segment);
  const name = tool.split("/").pop();
  if (!name) return null;
  if (name === "git") return "git";
  if (name === "docker") return "docker";
  // `npm run <script>` / `npm install`: the rest is the same as a yarn command.
  if (name === "npm") return kindOf(args.join(" "));
  if (LIGHT_TOOLS.has(name)) return "lint";
  if (TEST_TOOLS.has(name)) return testTargets(args).length ? "test-files" : "test-full";
  if (/^test(:[\w-]+)?$/.test(name)) return pathArgs(args).length ? "test-files" : "test-full";
  if (/^(tsc|vue-tsc|typecheck|type-check)(:[\w-]+)?$/.test(name)) return "typecheck";
  if (/^lint(:[\w-]+)?$/.test(name)) return "lint";
  if (/^build(:[\w-]+)?$/.test(name)) return "build";
  if (name === "next") return args[0] === "build" ? "build" : "other";
  if (/^(install|ci|i)(:[\w-]+)?$/.test(name)) return "install";
  if (/^(node|tsx|make)$/.test(name)) return "other";
  return null;
};

if (kindMode) {
  const kinds = chainSegments(text).map(kindOf).filter(Boolean);
  process.stdout.write(`${KIND_ORDER.find((kind) => kinds.includes(kind)) ?? "other"}\n`);
} else {
  const lanes = splitSegments(text).map(classify);
  process.stdout.write(lanes.includes("heavy") || !lanes.includes("light") ? "heavy\n" : "light\n");
}
