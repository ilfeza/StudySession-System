export function buildGroupInviteLink(inviteKey: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/groups?join=${encodeURIComponent(inviteKey)}`;
}

export function parseInviteInput(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    return '';
  }
  try {
    const url = new URL(trimmed);
    const fromQuery = url.searchParams.get('join');
    if (fromQuery) {
      return fromQuery.trim();
    }
  } catch {
    // not a URL
  }
  return trimmed;
}
