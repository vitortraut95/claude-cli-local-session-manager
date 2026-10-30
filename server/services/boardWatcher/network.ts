import { readFile } from "node:fs/promises";

/**
 * What a test session needs from the machine's network before it starts (`test.requires` in
 * `boardWatcher.json`): a VPN interface up and/or IPv6 off. Linux only (`/sys`, `/proc`); both
 * are things only the user can change (VPN login, sudo), so a missing one holds the tests and the
 * user is told how to fix it.
 */

export type NetworkRequirements = { vpnInterface?: string; ipv6Disabled?: boolean };

const IFF_UP = 0x1;

async function interfaceUp(name: string): Promise<boolean> {
  const flags = await readFile(`/sys/class/net/${name}/flags`, "utf8").catch(() => null);
  return flags !== null && (Number.parseInt(flags.trim(), 16) & IFF_UP) !== 0;
}

/** Why a test can't start now, or null when the network is as required. */
export async function networkProblem(
  requires: NetworkRequirements | undefined,
): Promise<string | null> {
  if (!requires) return null;
  const problems: string[] = [];
  if (requires.vpnInterface && !/^[\w.-]+$/.test(requires.vpnInterface)) {
    return `invalid VPN interface name "${requires.vpnInterface}"`;
  }
  if (requires.vpnInterface && !(await interfaceUp(requires.vpnInterface))) {
    problems.push("VPN disconnected");
  }
  if (requires.ipv6Disabled) {
    const disabled = await readFile("/proc/sys/net/ipv6/conf/all/disable_ipv6", "utf8").catch(
      () => "1",
    );
    if (disabled.trim() !== "1") problems.push("IPv6 on");
  }
  return problems.length ? problems.join(" and ") : null;
}
