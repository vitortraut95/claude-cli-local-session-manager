#!/usr/bin/env node
/**
 * Prints the lane of a heavy-run command (its argv, or a `bash -c '…'` chain): "light" or "heavy".
 *
 * Heavy commands (builds, installs, whole-project typecheck/lint, full test suites, containers) take
 * one of the shared test slots. Light ones — git commit/push (their hooks touch only the staged
 * files), lint/format of explicit files, tests of explicit files or folders — skip the slot queue,
 * so a 5-second commit never waits behind a 20-minute build; they still wait for free RAM and run
 * with the same caps. Anything not recognized as light counts as heavy.
 */

const text = process.argv.slice(2).join(" ");

/** Shell segments: split on `;`, `&&`, `||`, `|` and newlines outside quotes, quotes dropped. */
const segments = [];
let current = "";
let quote = "";
for (let i = 0; i < text.length; i++) {
  const char = text[i];
  if (quote) {
    if (char === quote) quote = "";
    else current += char;
  } else if (char === "'" || char === '"') {
    quote = char;
  } else if (char === ";" || char === "\n" || char === "|" || char === "&") {
    segments.push(current);
    current = "";
  } else {
    current += char;
  }
}
segments.push(current);

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
  if (TEST_TOOLS.has(name)) {
    // A `--flag value` pair's value isn't a target; `--flag=value` carries its own.
    const targets = args.filter(
      (arg, i) =>
        !arg.startsWith("-") && !(args[i - 1]?.startsWith("--") && !args[i - 1].includes("=")),
    );
    return targets.length ? "light" : "heavy";
  }
  // A test script narrowed to files (`yarn test:unit src/a.test.ts`) is as light as jest on them.
  if (/^test(:[\w-]+)?$/.test(name)) return pathArgs(args).length ? "light" : "heavy";
  if (/^(tsc|vue-tsc|next|make|docker|npm|node|tsx)$/.test(name)) return "heavy";
  if (/^(test|typecheck|type-check|lint|build|install|ci|i)(:[\w-]+)?$/.test(name)) return "heavy";
  return "neutral";
};

const lanes = segments.map(classify);
process.stdout.write(lanes.includes("heavy") || !lanes.includes("light") ? "heavy\n" : "light\n");
