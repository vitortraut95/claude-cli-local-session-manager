import { readFile } from "node:fs/promises";

/** Linux only, like the rest of the app. Every reader returns null when its file can't be read. */

/** `MemAvailable` as a % of `MemTotal` (what the kernel thinks can still be handed out without
 *  swapping — page cache counts as available). */
export async function getFreeMemoryPercent(): Promise<number | null> {
  try {
    const meminfo = await readFile("/proc/meminfo", "utf8");
    const field = (name: string) => {
      const match = new RegExp(`^${name}:\\s+(\\d+)`, "m").exec(meminfo);
      return match?.[1] ? Number(match[1]) : null;
    };
    const total = field("MemTotal");
    const available = field("MemAvailable");
    if (!total || available === null) return null;
    return Math.round((available / total) * 100);
  } catch {
    return null;
  }
}

/**
 * PSI `some avg10` for memory: % of the last 10s some task was stalled waiting on memory. Unlike
 * free RAM, it rises only when the machine is actually struggling (reclaim, swap thrash).
 */
export async function getMemoryPressure(): Promise<number | null> {
  try {
    const pressure = await readFile("/proc/pressure/memory", "utf8");
    const match = /^some avg10=([\d.]+)/m.exec(pressure);
    return match?.[1] ? Number(match[1]) : null;
  } catch {
    return null;
  }
}
