import assert from "node:assert/strict";
import { test } from "node:test";
import { AI_REVIEW_MARKER, aiReviewComment } from "../../services/boardWatcher/bitbucket.js";
import type { PullRequest } from "../../services/boardWatcher/types.js";

const pr = { id: "248", repo: "my-repo", sourceHash: "f92fc8a1234" } as PullRequest;

void test("the summary names where each finding was commented, without repeating its text", () => {
  const body = "O eventGroup mudou de valor e isso muda o que chega no GA. ".repeat(10);
  const comment = aiReviewComment(pr, {
    outcome: { kind: "approved" },
    summary: "Troca os templates pelo único.",
    posted: [
      { severity: "major", file: "src/pages/a.page.js", line: 32, body },
      { severity: "minor", body: "Sem arquivo." },
    ],
  });
  assert.ok(comment.startsWith(`${AI_REVIEW_MARKER} · commit \`f92fc8a\` · aprovado`));
  assert.match(comment, /- \*\*importante\*\*: `src\/pages\/a\.page\.js:32`/);
  assert.match(comment, /- \*\*detalhe\*\*: comentário geral do PR/);
  assert.ok(!comment.includes("eventGroup"));
  assert.ok(!comment.includes("Sem arquivo."));
  assert.ok(!comment.includes("…"));
});

void test("no findings still says so", () => {
  const comment = aiReviewComment(pr, { outcome: { kind: "approved" }, posted: [] });
  assert.match(comment, /\*\*Apontamentos:\*\* nenhum\./);
});
