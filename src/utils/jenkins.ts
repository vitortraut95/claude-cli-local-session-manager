// The Jenkins base URL is per-machine config (`jenkinsBaseUrl` in userPreferences.json).

/**
 * The configured base as an absolute URL with no trailing slash. It's often saved without the
 * scheme ("jenkins.example.com"), which a link would otherwise resolve against this app's own
 * address. Null when not configured.
 */
export function jenkinsBase(jenkinsBaseUrl: string | null | undefined): string | null {
  const trimmed = jenkinsBaseUrl?.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}
