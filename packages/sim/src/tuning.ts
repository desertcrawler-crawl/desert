/**
 * Every gameplay number lives here.
 *
 * These are PLACEHOLDERS. Most come from the spec's working proposals
 * (spec v1.1, Parts I and II); a few marked "not in spec" are my own guesses
 * so the game can run. None of them is an approved balance value. Change
 * them here, and only here, when tuning.
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

  health: {
    /** Health when first entering a session, % (spec working proposal: 40). */
    firstEntry: 40,
    /** Health when rejoining after death, % (agreed core rule: 100). */
    rejoin: 100,
    /** Terminal dying state starts at this health, % (agreed core rule: 10). */
    terminalThreshold: 10,
    /** Final death cannot come sooner than this after entering the terminal state, s (agreed core rule: at least 60). */
    terminalMinSeconds: 60,
    /** Health loss in percentage points per minute (spec working balance model). */
    drainPerMinute: {
      crawlSun: 6,
      crawlShade: 2.4,
      walkSun: 9,
      walkShade: 5.4,
      /** Not in spec: lying or sitting still. Spec only says "less movement cost"; placeholder at 75% of crawling. */
      idleSun: 4.5,
      idleShade: 1.8,
    },
    /** Terminal state: 10% to 0% in about 60 s in sun, about 120 s in shade (spec working timing model). */
    terminalSecondsSun: 60,
    terminalSecondsShade: 120,
  },

  wells: {
    /** Distance at which a player automatically drinks, m. Not in spec (open); placeholder. */
    drinkRadius: 1.5,
    /** Active wells wanted with 1 player and with 30 players (spec starting point: ~3 and ~10-12). Linear in between. */
    activeAtOnePlayer: 3,
    activeAtThirtyPlayers: 11,
    /** Seconds between new wells while below the target. Not in spec; placeholder. */
    spawnIntervalSeconds: 15,
    /** A new well never appears closer than this to a living player, m. Not in spec; placeholder. */
    minDistanceFromPlayers: 10,
  },

  shade: {
    /** Height above the ground at which a body counts as shaded, m (proposal: one point at the body centre). */
    bodyHeight: 0.3,
    /** Size of one cell in the precomputed shade grid, m. */
    cellSize: 0.5,
  },

  session: {
    /** Agreed core rule: at most 30 simultaneous players per session. */
    maxPlayers: 30,
  },
} as const;
