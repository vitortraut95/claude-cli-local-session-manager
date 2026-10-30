# Board watcher (design draft)

Watches a Jira board around the clock and feeds the existing task queue (`taskQueueService` +
`taskSchedulerService`). Looking at the board is plain REST polling, with no Claude session in
the loop; a session only starts when there's work.

**Status:** runs in the server in simulation mode: reads the real Jira board and Bitbucket PRs,
runs real review sessions, and records what it would do (`boardWatcher-actions.jsonl`) instead of
acting; digests go to Teams at 09:00 and 18:00.

## Rules per column

Only issues in the board's active sprint are considered, in every column. An issue carried over
from the previous sprint is in the active one, so it counts; what was already done with it (queued,
claimed) is remembered, so the sprint change doesn't repeat anything.

| Column                | Condition                                                    | Action                                     |
| --------------------- | ------------------------------------------------------------ | ------------------------------------------ |
| To Do, assigned to me | description passes the gate                                  | queued as `dev`                            |
| To Do, assigned to me | weak description                                             | not queued; reported once, with the reason |
| To Do, anyone else's  | —                                                            | nothing                                    |
| Code Review (others') | see "Playing nice"                                           | review + automatic approval                |
| Wait Test             | test plan in the comments, not tested since, I'm not the dev | moved to Testing and queued as `test`      |
| Testing               | —                                                            | nothing (someone is testing it)            |

### Description gate (`descriptionGate.ts`)

One point each for: 200+ characters; steps, acceptance criteria or Given/When/Then; an expected
result; a page or URL; a screenshot or Figma link. Minus one for a visual change (summary/labels)
with no Figma link. Queued at 3/5 or more. A cheap-model classifier can be added on top later,
only for what passes the heuristic.

### Test plan (`testPlan.ts`)

- Has a plan: a comment with a "How to test" / "Como testar" heading and numbered steps.
- Tested: a "Test report" / "Teste da tarefa … Resultado:" comment **after** the latest plan. A
  new plan after a report means test it again.
- Never tests a ticket the user developed (assignee = me).

### Picking Wait Test tickets

The watcher is a safety net, not a competitor: it only takes tickets nobody picked up.

- Waits 1 business hour in Wait Test first (`waitTestGraceMinutes`). On a real sprint, half the
  tickets were picked up by people within ~35 minutes; the rest sat for hours, and those are the
  ones it takes.
- Oldest in Wait Test first.
- Only plans a browser session can carry out alone: plans that run commands (curl), need a release
  tag, CMS/admin access, a real purchase or confirming with someone, or have no link to test on,
  are left for a person (and listed in the digest with the reason).
- At most 2 at once and 4 a day. It claims (moves to Testing) only when it starts right away.
- Result: posts the report and evidence; moves to PO Validation when it passes; when it fails, only
  comments and alerts the user.

## Limits

| Setting               | Default                                  | Why                                       |
| --------------------- | ---------------------------------------- | ----------------------------------------- |
| Polling               | 10 min in business hours, 60 min outside | reading is cheap; little changes at night |
| Visible actions       | weekdays 09:00–18:00 (machine timezone)  | nobody gets notified at 3 a.m.            |
| Wait before approving | 2 business hours since the last push     | gives people time to review first         |
| Comments per PR       | 3, blocking/major only                   | no nitpicks on a colleague's PR           |
| Review rounds         | one per new push, at most 3 per PR       | no back-and-forth loop with the author    |
| Approvals per day     | 8, then the watcher pauses and alerts    | that many in a day means something's off  |
| Tests claimed at once | 2, and 4 a day                           | doesn't hog the column                    |

## Playing nice

- PRs: only once their ticket (from the PR title or branch; any one, for a PR bundling several) is
  in the Code Review column (`columns.codeReview`), since people open PRs while still working; the
  wait before approving counts from the later of the last push and the ticket reaching Code Review.
- PRs: only where the user is a reviewer, never their own, and not already approved by them (a new
  push resets the approval). No approval on a draft, red CI,
  conflicts or another reviewer's "changes requested"; never "request changes" or decline. Any
  size is approved when nothing blocking is found.
- Jira: never assigns itself, never touches anyone else's ticket. The only status change is Wait
  Test → Testing when it claims a test, which is what tells others it's being tested.

### Review session

Runs as a background Claude session in a local worktree of the PR's source branch (so it can
search the whole repo for other uses of what changed), read-only: no edits, commits or pushes. It
gets the diff against the merge-base, the ticket with its comments, and the other open PRs that
touch the same files or tickets (a simulation flagged a "bug" that a sibling PR already handled).
Each finding comes back with severity, file, line and `topic`: questions for PO/design/content
(copy, prices, Figma parity) are `product` and are never posted; they stay in the actions log.
A PR bundling more than one ticket is normal for the team: scope is never flagged, but all of its
code is reviewed.
Reviews run one at a time after a look, with a cost cap per review (`review.maxBudgetUsd`); the
local clone of each repo comes from `bitbucket.localRepos`.

### Test session

By default (`test.runner: "queue"`) a claimed ticket is added to the app's task queue as a test
entry, so the scheduler launches it like any queued test: within its session, memory and plan
limits, as an interactive session with the user's test skill and a disposable worktree of the
ticket's branch. The skill still asks the user before posting anything. `test.runner: "headless"`
runs the unattended session below instead.

#### Headless runner

Runs the user's test skill in autonomous mode in a non-interactive `claude -p --chrome` (its own
Chrome tab group), in the evidence folder outside every repo, with no tool that writes and no way
to reach Jira or Bitbucket (no MCP servers, no Atlassian tokens in its env): the watcher is the
only thing that posts. It gets the ticket, the comments up to the test plan (never a test report)
and the branch diff. Rules on top of the skill: no questions, test through the plan's links, at
least one control scenario, check indexing when pages or files change, and check every item when
the change renders many from a template. Screenshots are copied to `boardWatcher-tests/`.
`yarn board-watcher:test-run KEY` runs it on any ticket to compare with a person's verdict.

## Sandbox (`board-watcher:eval`)

Everything the watcher reads or writes goes through providers (`types.ts`): board, code host,
reviewer, notifier and the task queue. `fake.ts` serves them from a scenario and records every
write as a one-line effect (`approve web#12`, `transition DEMO-10 -> testing`) instead of leaving
the machine.

```bash
yarn board-watcher:eval              # every scenario
yarn board-watcher:eval weekend      # names containing "weekend"
yarn board-watcher:eval --verbose    # also print each decision and effect
```

Scenarios live in `server/fixtures/board-watcher/*.json`, each a list of ticks (a clock time, the
board/PRs seen and the review results) with the effects and decisions expected. They use made-up
data only (project `DEMO`, user `me`, colleagues `ana`/`bia`) since this repo is public. When a
rule or threshold changes, the scenarios are the regression test; a real case that went wrong
becomes a new scenario.

## Local config

The board's ids live in the gitignored `boardWatcher.json` at the repo root:

```json
{
  "me": "<Jira account id>",
  "columns": { "todo": ["<status id>"], "waitTest": ["<status id>"], "testing": ["<status id>"] },
  "testingStatusId": "<status id>"
}
```

Any limit above can be overridden there too (`approveDelayHours`, `maxApprovesPerDay`, …,
`businessHours`). The column ids come from `GET /rest/agile/1.0/board/<id>/configuration`.

## Next

1. Review quality: a sandbox git repo with fake PRs (planted bugs and clean ones) to measure what
   a Claude review catches and what it would approve that it shouldn't.
2. Real providers in dry-run: read Jira/Bitbucket for real, send every write to an action log.
   Jira transitions go by transition id, so the provider looks up the one leading to
   `testingStatusId`.
3. Notifications: Teams webhook (`TEAMS_WEBHOOK_URL`, Adaptive Card 1.2) for `urgent`, a digest at
   the start and end of the day, and a "Board" panel in the app with the full log.
4. Wire into the server (timer, persisted state, pause/resume) and the task queue.
