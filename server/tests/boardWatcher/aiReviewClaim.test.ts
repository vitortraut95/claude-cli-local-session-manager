import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import {
  AI_REVIEW_CLAIM,
  AI_REVIEW_CLAIM_TTL_MS,
  AI_REVIEW_MARKER,
  blocksReview,
  claimAiReview,
  hasAiReviewComment,
  postAiReviewComment,
} from "../../services/boardWatcher/bitbucket.js";
import type { PullRequest } from "../../services/boardWatcher/types.js";

const credentials = { workspace: "ws", email: "a@b.c", token: "t" };
let prId = 100;
// Each test gets its own PR: the module caches PRs it saw reviewed.
const newPr = () =>
  ({ id: String((prId += 1)), repo: "repo", sourceHash: "abc1234" }) as PullRequest;

type Comment = { id: number; created_on: string; deleted?: boolean; content: { raw: string } };

/** A fake Bitbucket comments API: GET lists `comments`, POST adds one, PUT/DELETE change one. */
function fakeBitbucket(comments: Comment[], nextId = 900, beforePost?: () => void) {
  const calls: string[] = [];
  mock.method(globalThis, "fetch", (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    calls.push(`${method} ${new URL(url).pathname.replace(/^.*\/pullrequests\/\d+/, "")}`);
    const id = Number(/\/comments\/(\d+)/.exec(url)?.[1]);
    if (method === "POST") {
      beforePost?.();
      const raw = (JSON.parse(init.body as string) as Comment).content.raw;
      const comment = { id: nextId, created_on: new Date().toISOString(), content: { raw } };
      nextId += 1;
      comments.push(comment);
      return Promise.resolve(Response.json(comment));
    }
    if (method === "DELETE") {
      const comment = comments.find((c) => c.id === id);
      if (comment) comment.deleted = true;
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (method === "PUT") {
      const comment = comments.find((c) => c.id === id);
      if (comment) comment.content.raw = (JSON.parse(init.body as string) as Comment).content.raw;
      return Promise.resolve(Response.json(comment ?? {}, { status: comment ? 200 : 404 }));
    }
    return Promise.resolve(Response.json({ values: comments }));
  });
  return calls;
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const review = (id: number): Comment => ({
  id,
  created_on: minutesAgo(5),
  content: { raw: `${AI_REVIEW_MARKER} · commit \`abc1234\` · aprovado` },
});
const claim = (id: number, createdOn = minutesAgo(5)): Comment => ({
  id,
  created_on: createdOn,
  content: { raw: `${AI_REVIEW_CLAIM}\n\n_..._` },
});

afterEach(() => mock.restoreAll());

void test("a posted review always blocks; a reservation only while fresh and not our own", () => {
  const now = Date.now();
  const fresh = { id: 1, claim: true, createdOn: new Date(now - 60_000).toISOString() };
  const stale = {
    id: 2,
    claim: true,
    createdOn: new Date(now - AI_REVIEW_CLAIM_TTL_MS - 1).toISOString(),
  };
  assert.equal(blocksReview({ id: 3, claim: false, createdOn: "" }, 3, now), true);
  assert.equal(blocksReview(fresh, null, now), true);
  assert.equal(blocksReview(fresh, 1, now), false);
  assert.equal(blocksReview(stale, null, now), false);
});

void test("the reservation starts with the marker, so older automations skip the PR too", () => {
  assert.ok(AI_REVIEW_CLAIM.startsWith(AI_REVIEW_MARKER));
});

void test("a teammate's fresh reservation counts as reviewed, a stale one doesn't", async () => {
  fakeBitbucket([claim(10)]);
  assert.equal(await hasAiReviewComment(credentials, newPr()), true);
  mock.restoreAll();
  fakeBitbucket([claim(11, minutesAgo(3 * 60))]);
  assert.equal(await hasAiReviewComment(credentials, newPr()), false);
});

void test("claiming a free PR posts the reservation and returns its id", async () => {
  const comments: Comment[] = [];
  fakeBitbucket(comments);
  const id = await claimAiReview(credentials, newPr());
  assert.equal(id, 900);
  assert.ok(comments[0]?.content.raw.startsWith(AI_REVIEW_CLAIM));
});

void test("a PR already reviewed or reserved isn't claimed", async () => {
  const calls = fakeBitbucket([review(10)]);
  assert.equal(await claimAiReview(credentials, newPr()), null);
  assert.ok(!calls.some((c) => c.startsWith("POST")));
});

void test("when two automations reserve at once, the later one deletes its own", async () => {
  const comments: Comment[] = [];
  // The teammate's reservation (id 40) lands between our check and our post.
  fakeBitbucket(comments, 50, () => comments.push(claim(40)));
  assert.equal(await claimAiReview(credentials, newPr()), null);
  assert.equal(comments.find((c) => c.id === 50)?.deleted, true);
  assert.equal(comments.find((c) => c.id === 40)?.deleted, undefined);
});

void test("the review replaces the session's reservation instead of adding a comment", async () => {
  const comments = [claim(70)];
  const calls = fakeBitbucket(comments);
  const pr = { ...newPr(), aiReviewClaimId: 70 };
  await postAiReviewComment(credentials, pr, { outcome: { kind: "approved" }, posted: [] });
  assert.equal(comments.length, 1);
  assert.match(comments[0]?.content.raw ?? "", /aprovado/);
  assert.ok(calls.includes("PUT /comments/70"));
});
