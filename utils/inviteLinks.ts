const POLLED_WEB_ORIGIN = 'https://polled.app';

export function buildJoinLink(joinCode?: string | null) {
  const trimmedCode = joinCode?.trim();

  if (!trimmedCode) {
    return `${POLLED_WEB_ORIGIN}/join`;
  }

  const params = new URLSearchParams({ code: trimmedCode });
  return `${POLLED_WEB_ORIGIN}/join?${params.toString()}`;
}
