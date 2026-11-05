import assert from "node:assert/strict";
import { test } from "node:test";
import { boardIdOf, guessRoles } from "../../services/boardWatcher/setup.js";

void test("the board number comes from its link or alone, anything else is refused", () => {
  assert.equal(
    boardIdOf("https://acme.atlassian.net/jira/software/c/projects/LED/boards/1072?quickFilter=1"),
    1072,
  );
  assert.equal(boardIdOf(" 42 "), 42);
  assert.throws(() => boardIdOf("https://acme.atlassian.net/jira/software/projects/LED"));
});

void test("columns are first guessed from their names, in English or Portuguese", () => {
  const column = (name: string) => ({ name, statusIds: [name] });
  const guess = guessRoles(
    ["To Do", "Em andamento", "Code Review", "Wait Test", "Testing", "Validation", "Done"].map(
      column,
    ),
  );
  assert.deepEqual(guess, {
    todo: ["To Do"],
    inProgress: ["Em andamento"],
    codeReview: ["Code Review"],
    waitTest: ["Wait Test"],
    testing: ["Testing"],
    deploying: ["Validation"],
  });
});
