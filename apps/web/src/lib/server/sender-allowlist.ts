export type AllowListRule =
  | { type: 'email'; value: string }
  | { type: 'domain'; value: string };

/**
 * Parses a comma-separated sender allow-list string.
 *
 * Each entry is either:
 *   - an exact email address: "person@example.com"
 *   - a whole domain (starts with @): "@trusted.com"
 *
 * Entries are normalized to lowercase and empty entries are skipped.
 */
export function parseSenderAllowList(value: string): AllowListRule[] {
  return value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .map((entry) => {
      if (entry.startsWith('@')) {
        return { type: 'domain', value: entry } satisfies AllowListRule;
      }
      return { type: 'email', value: entry } satisfies AllowListRule;
    });
}

/**
 * Returns true if the (already lowercased) sender matches any rule.
 *
 * Matching order:
 *  1. Exact email match
 *  2. Domain match: sender ends with the domain rule (e.g. "@trusted.com")
 */
export function isSenderAllowed(sender: string, rules: AllowListRule[]): boolean {
  const normalized = sender.toLowerCase();
  for (const rule of rules) {
    if (rule.type === 'email' && normalized === rule.value) return true;
    if (rule.type === 'domain' && normalized.endsWith(rule.value)) return true;
  }
  return false;
}
