/** Refresh cadence for the Realtime backup; inactive tabs are paused by the component. */
export function notificationRefreshDelayMs(live: boolean, failures: number) {
  if (failures > 0) return Math.min(300_000, 30_000 * 2 ** Math.min(failures, 4));
  return live ? 300_000 : 60_000;
}

export function notificationRequestIsTerminal(status: number | undefined) {
  return status === 401 || status === 402 || status === 403;
}
