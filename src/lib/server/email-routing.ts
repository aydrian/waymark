export type AgentName = 'main' | 'waymark';

/**
 * Maps a recipient email address to an agent name by local-part.
 *
 * Routing table:
 *   janine@*   → "main"
 *   waymark@*  → "waymark"
 *   anything else → null (unknown recipient)
 *
 * The address is normalized to lowercase before matching.
 */
export function resolveAgentFromRecipient(address: string): AgentName | null {
  const localPart = address.toLowerCase().split('@')[0];
  switch (localPart) {
    case 'janine':
      return 'main';
    case 'waymark':
      return 'waymark';
    default:
      return null;
  }
}
