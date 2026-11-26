import assert from "node:assert/strict";
import { test } from "node:test";
import type { TaskStore } from "../../utils/taskStore.js";
import {
  stoppedTaskContainersFrom,
  taskKeyFromContainerName,
  type DockerInspect,
} from "../../services/previewService.js";

const WORKTREE = "/home/dev/repo/.claude/worktrees/env-PROJ-1";

function container(overrides: Partial<DockerInspect> & { name: string }): DockerInspect {
  const { name, ...rest } = overrides;
  return {
    Name: `/${name}`,
    Created: "2026-11-20T10:00:00Z",
    Config: { Image: "dev-image" },
    Mounts: [{ Type: "bind", Source: WORKTREE }],
    State: { Status: "exited", FinishedAt: "2026-11-21T10:00:00Z" },
    ...rest,
  };
}

const tasks = {
  "PROJ-456": { status: "in_progress" },
  "PROJ-123": { status: "done" },
} as unknown as TaskStore["tasks"];

void test("name suffix maps to a tracked key exactly", () => {
  assert.equal(taskKeyFromContainerName("app-proj456", ["PROJ-456"]), "PROJ-456");
});

void test("a key no longer tracked is rebuilt from the name", () => {
  assert.equal(taskKeyFromContainerName("app-br-proj999", []), "PROJ-999");
  assert.equal(taskKeyFromContainerName("app-br-b2b12", []), "B2B-12");
});

void test("names without a task suffix give no key", () => {
  assert.equal(taskKeyFromContainerName("other-app", []), null);
  assert.equal(taskKeyFromContainerName("tool-mock-1", []), null);
  assert.equal(taskKeyFromContainerName("app", []), null);
  assert.equal(taskKeyFromContainerName("redis5", []), null);
});

void test("an in-progress task's stopped container is not listed", () => {
  assert.deepEqual(stoppedTaskContainersFrom([container({ name: "app-proj456" })], tasks), []);
});

void test("a done task's stopped container is listed with image, key and stop time", () => {
  const found = stoppedTaskContainersFrom([container({ name: "app-proj123" })], tasks);
  assert.deepEqual(found, [
    {
      name: "app-proj123",
      image: "dev-image",
      taskKey: "PROJ-123",
      stoppedAt: "2026-11-21T10:00:00Z",
    },
  ]);
});

void test("a container of a key that is gone is listed, a running or paused one never", () => {
  const containers = [
    container({ name: "app-br-proj999" }),
    container({ name: "app-br-proj998", State: { Status: "running" } }),
    container({ name: "app-br-proj997", State: { Status: "paused" } }),
    container({ name: "app-br-proj996", State: { Status: "restarting" } }),
  ];
  assert.deepEqual(
    stoppedTaskContainersFrom(containers, tasks).map((c) => c.taskKey),
    ["PROJ-999"],
  );
});

void test("a created container uses its creation time, and a never-finished one too", () => {
  const found = stoppedTaskContainersFrom(
    [
      container({ name: "a-proj123", State: { Status: "created" } }),
      container({
        name: "b-proj123",
        State: { Status: "exited", FinishedAt: "0001-01-01T00:00:00Z" },
      }),
    ],
    tasks,
  );
  assert.deepEqual(
    found.map((c) => c.stoppedAt),
    ["2026-11-20T10:00:00Z", "2026-11-20T10:00:00Z"],
  );
});

void test("a stopped container without a task worktree mount is never listed", () => {
  const found = stoppedTaskContainersFrom(
    [
      container({
        name: "app-proj123",
        Mounts: [{ Type: "bind", Source: "/home/dev/repo" }],
      }),
      container({ name: "nginx-proxy2", Mounts: [{ Type: "bind", Source: "/home/dev/proxy" }] }),
    ],
    tasks,
  );
  assert.deepEqual(found, []);
});

void test("an ambiguous name (two tracked keys match) is not listed", () => {
  const ambiguous = {
    "B2-1": { status: "done" },
    "B-21": { status: "done" },
  } as unknown as TaskStore["tasks"];
  assert.equal(taskKeyFromContainerName("svc-b21", Object.keys(ambiguous)), null);
});
