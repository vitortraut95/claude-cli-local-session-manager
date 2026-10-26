import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { AppError, errorMessage } from "../utils/httpError.js";
import { REPO_ROOT } from "../utils/repoRoot.js";
import { isLimuxRunning, limuxBin, LOCAL_LIMUX_BIN } from "./limuxGridService.js";
import type { LimuxInstallResult, LimuxStatus } from "../../shared/system.js";

/**
 * Installs or updates Limux for the current user, no sudo: the release's Linux tarball goes to
 * `~/.local/opt/limux/<version>/` (laid out like its own `install.sh` prefix), and
 * `~/.local/bin/limux` becomes a wrapper that adds the bundled Ghostty library to
 * `LD_LIBRARY_PATH` (the host's RUNPATH points at `/usr/local/lib/limux`; Limux restores the
 * original value for the shells it opens). The latest GitHub release is used, checked against its
 * SHA256SUMS; offline or with GitHub gone, the copy kept in `vendor/limux/` is.
 *
 * GTK4/libadwaita/WebKitGTK come from the system: missing ones are reported with the apt command,
 * never installed (that needs sudo).
 */

const execFileAsync = promisify(execFile);

export const MIN_LIMUX_VERSION = "0.1.33";

const RELEASES_API = "https://api.github.com/repos/am-will/limux/releases/latest";
const TARBALL_PATTERN = /^limux-(\d+\.\d+\.\d+)-linux-x86_64\.tar\.gz$/;
const VENDOR_DIR = path.join(REPO_ROOT, "vendor", "limux");
const INSTALL_ROOT = path.join(os.homedir(), ".local", "opt", "limux");
const WRAPPER_MARKER = "# Installed by Claude CLI Local Session Manager";
const LATEST_CACHE_MS = 60 * 60 * 1000;

/** Shared library → the Ubuntu/Debian package that ships it. */
const APT_PACKAGES: Record<string, string> = {
  "libgtk-4.so.1": "libgtk-4-1",
  "libadwaita-1.so.0": "libadwaita-1-0",
  "libwebkitgtk-6.0.so.4": "libwebkitgtk-6.0-4",
  "libjavascriptcoregtk-6.0.so.1": "libjavascriptcoregtk-6.0-1",
};

type Release = { version: string; tarballUrl: string; sumsUrl: string };

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function bundledTarball(): Promise<{ version: string; file: string } | null> {
  const names = await readdir(VENDOR_DIR).catch(() => [] as string[]);
  for (const name of names) {
    const match = TARBALL_PATTERN.exec(name);
    if (match?.[1]) return { version: match[1], file: path.join(VENDOR_DIR, name) };
  }
  return null;
}

let latestCache: { release: Release | null; at: number } | null = null;

async function fetchLatestRelease(): Promise<Release | null> {
  if (latestCache && Date.now() - latestCache.at < LATEST_CACHE_MS) return latestCache.release;
  let release: Release | null = null;
  try {
    const response = await fetch(RELEASES_API, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "claude-session-manager" },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) {
      const data = (await response.json()) as {
        assets?: { name: string; browser_download_url: string }[];
      };
      const assets = data.assets ?? [];
      const tarball = assets.find((asset) => TARBALL_PATTERN.test(asset.name));
      const sums = assets.find((asset) => asset.name === "SHA256SUMS");
      const version = tarball && TARBALL_PATTERN.exec(tarball.name)?.[1];
      if (tarball && sums && version) {
        release = {
          version,
          tarballUrl: tarball.browser_download_url,
          sumsUrl: sums.browser_download_url,
        };
      }
    }
  } catch {
    // Offline or GitHub unreachable: the bundled copy stands in.
  }
  latestCache = { release, at: Date.now() };
  return release;
}

async function installedVersion(bin: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(bin, ["--version"], { timeout: 5_000 });
    return /(\d+\.\d+\.\d+)/.exec(stdout)?.[1] ?? null;
  } catch {
    return null;
  }
}

async function isManagedWrapper(bin: string): Promise<boolean> {
  return (await readFile(bin, "utf-8").catch(() => "")).includes(WRAPPER_MARKER);
}

/** `ldd` of the managed install's host: the system libraries it can't resolve. */
async function missingLibraries(prefix: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(
      "ldd",
      [path.join(prefix, "libexec", "limux", "limux-host")],
      { env: { ...process.env, LD_LIBRARY_PATH: path.join(prefix, "lib", "limux") } },
    );
    return [...stdout.matchAll(/^\s*(\S+) => not found/gm)].map((match) => match[1] ?? "");
  } catch {
    return [];
  }
}

function aptCommandFor(libs: string[]): string | null {
  if (libs.length === 0) return null;
  const packages = new Set(libs.map((lib) => APT_PACKAGES[lib] ?? lib));
  return `sudo apt install ${[...packages].join(" ")}`;
}

export async function getLimuxStatus(): Promise<LimuxStatus> {
  const [bin, release, bundled] = await Promise.all([
    limuxBin(),
    fetchLatestRelease(),
    bundledTarball(),
  ]);
  const version = bin ? await installedVersion(bin) : null;
  const managed = bin === LOCAL_LIMUX_BIN && (await isManagedWrapper(bin));
  const missingLibs =
    managed && version ? await missingLibraries(path.join(INSTALL_ROOT, version)) : [];
  const latest = release?.version ?? bundled?.version ?? MIN_LIMUX_VERSION;
  return {
    installed: bin !== null,
    version,
    managed,
    latest,
    minVersion: MIN_LIMUX_VERSION,
    updateAvailable: bin !== null && (version === null || compareVersions(version, latest) < 0),
    running: bin !== null && (await isLimuxRunning()),
    missingLibs,
    aptCommand: aptCommandFor(missingLibs),
  };
}

async function download(url: string, file: string): Promise<void> {
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`GET ${url} answered ${response.status}`);
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
}

async function verifySha256(file: string, sums: string): Promise<void> {
  const name = path.basename(file);
  const expected = sums
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .find(([, entry]) => entry === name)?.[0];
  const actual = createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
  if (!expected || expected !== actual) throw new Error(`${name}: checksum mismatch`);
}

/** The verified tarball to install: GitHub's latest release, else the bundled copy. */
async function obtainTarball(
  tmpDir: string,
): Promise<{ version: string; file: string; source: "github" | "bundled" }> {
  const [release, bundled] = await Promise.all([fetchLatestRelease(), bundledTarball()]);
  if (release && release.version !== bundled?.version) {
    try {
      const file = path.join(tmpDir, `limux-${release.version}-linux-x86_64.tar.gz`);
      const sumsResponse = await fetch(release.sumsUrl, { signal: AbortSignal.timeout(15_000) });
      if (!sumsResponse.ok) throw new Error(`SHA256SUMS answered ${sumsResponse.status}`);
      const sums = await sumsResponse.text();
      await download(release.tarballUrl, file);
      await verifySha256(file, sums);
      return { version: release.version, file, source: "github" };
    } catch (err) {
      if (!bundled) throw err;
      console.warn(`[limux] download failed, using the bundled copy: ${errorMessage(err)}`);
    }
  }
  if (!bundled) {
    throw new AppError(
      "LIMUX_INSTALL_FAILED",
      "GitHub is unreachable and there's no bundled copy.",
    );
  }
  await verifySha256(bundled.file, await readFile(path.join(VENDOR_DIR, "SHA256SUMS"), "utf-8"));
  return { ...bundled, source: "bundled" };
}

/** Copies the tarball's files into `prefix` the way its `install.sh` lays them out. */
async function layOut(extracted: string, prefix: string): Promise<void> {
  await rm(prefix, { recursive: true, force: true });
  await mkdir(path.join(prefix, "bin"), { recursive: true });
  await mkdir(path.join(prefix, "lib", "limux"), { recursive: true });
  await cp(path.join(extracted, "limux"), path.join(prefix, "bin", "limux"));
  await cp(path.join(extracted, "libexec"), path.join(prefix, "libexec"), { recursive: true });
  await cp(
    path.join(extracted, "lib", "libghostty-internal.so"),
    path.join(prefix, "lib", "limux", "libghostty-internal.so"),
  );
  await cp(path.join(extracted, "share"), path.join(prefix, "share"), { recursive: true });
}

async function writeAtomically(file: string, content: string, mode: number): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  await writeFile(tmp, content, { mode });
  await rename(tmp, file);
}

/** Desktop entry + icons in `~/.local/share`, so the app menu opens this install. */
async function installDesktopEntry(prefix: string): Promise<void> {
  const share = path.join(os.homedir(), ".local", "share");
  const entry = await readFile(
    path.join(prefix, "share", "applications", "dev.limux.linux.desktop"),
    "utf-8",
  ).catch(() => null);
  if (entry) {
    await writeAtomically(
      path.join(share, "applications", "dev.limux.linux.desktop"),
      entry
        .replace(/^Exec=.*$/m, `Exec=${LOCAL_LIMUX_BIN}`)
        .replace(/^TryExec=.*$/m, `TryExec=${LOCAL_LIMUX_BIN}`),
      0o644,
    );
  }
  await cp(path.join(prefix, "share", "icons"), path.join(share, "icons"), {
    recursive: true,
  }).catch(() => undefined);
}

let installing: Promise<LimuxInstallResult> | null = null;

/** One install at a time: a second click joins the one running. */
export function installLimux(): Promise<LimuxInstallResult> {
  installing ??= runInstall().finally(() => {
    installing = null;
  });
  return installing;
}

async function runInstall(): Promise<LimuxInstallResult> {
  if (process.arch !== "x64") {
    throw new AppError("LIMUX_UNSUPPORTED_ARCH", "Limux only ships x86_64 Linux builds.");
  }
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "limux-install-"));
  try {
    const { version, file, source } = await obtainTarball(tmpDir);
    await execFileAsync("tar", ["xzf", file, "-C", tmpDir]);
    const prefix = path.join(INSTALL_ROOT, version);
    await layOut(path.join(tmpDir, `limux-${version}-linux-x86_64`), prefix);

    const libDir = path.join(prefix, "lib", "limux");
    await writeAtomically(
      LOCAL_LIMUX_BIN,
      [
        "#!/bin/sh",
        WRAPPER_MARKER,
        `export LD_LIBRARY_PATH="${libDir}\${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"`,
        `exec "${path.join(prefix, "bin", "limux")}" "$@"`,
        "",
      ].join("\n"),
      0o755,
    );
    await installDesktopEntry(prefix);

    // Older versions: a running Limux keeps its open files, so they can go now.
    for (const name of await readdir(INSTALL_ROOT)) {
      if (name !== version)
        await rm(path.join(INSTALL_ROOT, name), { recursive: true, force: true });
    }

    const installed = await installedVersion(LOCAL_LIMUX_BIN);
    if (installed !== version) {
      throw new AppError(
        "LIMUX_INSTALL_FAILED",
        `The installed limux didn't answer --version with ${version}.`,
      );
    }
    return { ...(await getLimuxStatus()), source };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("LIMUX_INSTALL_FAILED", `Couldn't install Limux: ${errorMessage(err)}`, {
      cause: err,
    });
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}
