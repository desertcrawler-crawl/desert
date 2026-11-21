/**
 * Every gameplay number lives here.
 *
 * These are PLACEHOLDERS taken from the spec's working proposals (spec v1.1,
 * Part I and Part II). None of them is an approved balance value. Change them
 * here, and only here, when tuning.
 */
export const TUNING = {
  /** Server simulation rate. Engineering hypothesis, not a design rule. */
  tickHz: 20,

  movement: {
    /** Crawl speed on easy ground, m/s (spec working proposal: ~0.55). */
    crawlSpeed: 0.55,
    /** Walk speed, m/s (spec working proposal: ~0.65). Not used until M2. */
    walkSpeed: 0.65,
    /** Reverse crawling speed as a share of forward speed. Open question; placeholder. */
    reverseFactor: 1.0,
    /** Turn rate while steering with A/D, degrees per second. Placeholder for the M1 control test. */
    turnRateDeg: 60,
  },

  session: {
    /** Agreed core rule: at most 30 simultaneous players per session. */
    maxPlayers: 30,
  },
} as const;
