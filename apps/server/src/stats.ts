/** Live server numbers for the /health page, so a playtest host can be watched for free. */
export const STATS = {
  startedAt: Date.now(),
  ticks: 0,
  /** Slowest simulation tick in the current minute and the previous one, ms. */
  slowestTickMs: 0,
  slowestTickMsLastMinute: 0,
  /** Average tick time, ms (exponential moving average). */
  avgTickMs: 0,
  joins: 0,
  deaths: 0,
  drinks: 0,
  chatLines: 0,
};

let minute = Math.floor(Date.now() / 60_000);

export function recordTick(ms: number): void {
  const m = Math.floor(Date.now() / 60_000);
  if (m !== minute) {
    minute = m;
    STATS.slowestTickMsLastMinute = STATS.slowestTickMs;
    STATS.slowestTickMs = 0;
  }
  STATS.ticks++;
  STATS.slowestTickMs = Math.max(STATS.slowestTickMs, ms);
  STATS.avgTickMs = STATS.avgTickMs === 0 ? ms : STATS.avgTickMs * 0.99 + ms * 0.01;
}
