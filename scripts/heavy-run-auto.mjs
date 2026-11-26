#!/usr/bin/env node
/**
 * Prints the limits `scripts/heavy-run` uses when `orchestrator.heavyLimits` is "auto", from this
 * machine's RAM and cores and from the peak memory the same kind of command used before:
 *   node heavy-run-auto.mjs <repo>:<kind>   (no argument = preview limits only)
 * Output, one line: NEED_GB NEED_SOURCE RUN_MEMORY_GB RUN_CPU_PERCENT PREVIEW_MEMORY_GB
 * PREVIEW_SLOTS HEAVY_SLOTS CORES TOTAL_GB. NEED_SOURCE is "learned" or "default".
 *
 * The preview formulas mirror server/utils/heavyLimits.ts (autoPreviewLimits): keep them in sync.
 */
import { closeSync, fstatSync, openSync, readSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GIB = 1024 ** 3;
const HISTORY_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "history.jsonl");
/** Only the end of history.jsonl is read; the newest runs are there. */
const TAIL_BYTES = 2 * 1024 * 1024;
const SAMPLE_RUNS = 10;
/** Headroom over the largest recorded peak. */
const PEAK_HEADROOM = 1.2;
/** Used until a command of that kind has run in the repo. */
const DEFAULT_NEED_GB = {
  build: 6,
  "test-full": 6,
  typecheck: 4,
  install: 3,
  "test-files": 3,
  lint: 2,
  git: 2,
  docker: 4,
  other: 2,
};

const key = process.argv[2] ?? "";
const kind = key.slice(key.lastIndexOf(":") + 1);

/** peakMb of the last heavy.run events with this key (newest first), from the file's tail. */
function recentPeaksMb(runKey) {
  let fd;
  try {
    fd = openSync(HISTORY_FILE, "r");
  } catch {
    return [];
  }
  try {
    const size = fstatSync(fd).size;
    const start = Math.max(0, size - TAIL_BYTES);
    const buffer = Buffer.alloc(size - start);
    let read = 0;
    while (read < buffer.length) {
      const n = readSync(fd, buffer, read, buffer.length - read, start + read);
      if (n === 0) break;
      read += n;
    }
    const lines = buffer.toString("utf8", 0, read).split("\n");
    // The first line may start mid-way when the tail was cut.
    if (start > 0) lines.shift();
    const peaks = [];
    for (let i = lines.length - 1; i >= 0 && peaks.length < SAMPLE_RUNS; i--) {
      if (!lines[i].includes('"heavy.run"')) continue;
      try {
        const event = JSON.parse(lines[i]);
        if (event.type === "heavy.run" && event.key === runKey && Number.isFinite(event.peakMb)) {
          peaks.push(event.peakMb);
        }
      } catch {
        // A torn or foreign line: skip it.
      }
    }
    return peaks;
  } finally {
    closeSync(fd);
  }
}

const totalGb = os.totalmem() / GIB;
const cores = os.availableParallelism?.() ?? os.cpus().length;
const halfGb = Math.max(1, Math.floor(totalGb / 2));

const peaks = key ? recentPeaksMb(key) : [];
let needGb;
let needSource;
if (peaks.length > 0) {
  needGb = Math.max(1, Math.ceil((PEAK_HEADROOM * Math.max(...peaks)) / 1024));
  needSource = "learned";
} else {
  needGb = DEFAULT_NEED_GB[kind] ?? DEFAULT_NEED_GB.other;
  needSource = "default";
}
needGb = Math.min(needGb, halfGb);

const runMemoryGb = Math.max(1, Math.min(Math.max(2 * needGb, 4), halfGb));
const runCpuPercent = Math.max(100, Math.floor(cores * 50));
const heavySlots = Math.max(1, Math.floor(cores / 4));

// Mirrors autoPreviewLimits in server/utils/heavyLimits.ts.
const previewMemoryGb = Math.min(8, Math.max(4, Math.floor(totalGb * 0.2)));
const previewSlots = Math.max(1, Math.floor((totalGb * 0.4) / previewMemoryGb));

process.stdout.write(
  [
    needGb,
    needSource,
    runMemoryGb,
    runCpuPercent,
    previewMemoryGb,
    previewSlots,
    heavySlots,
    cores,
    Math.floor(totalGb),
  ].join(" ") + "\n",
);
