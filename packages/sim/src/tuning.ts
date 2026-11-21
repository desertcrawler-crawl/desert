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

  posture: {
    /** Seconds to get up from crawling to walking. Spec: slow and physically demanding; value not in spec. */
    standUpSeconds: 3,
    /** Seconds to get back down to crawling. Not in spec; placeholder. */
    lieDownSeconds: 2,
  },

  slap: {
    /** All slap numbers are open in the spec; these are placeholders. Skeleton slaps share them (spec proposal). */
    range: 1.6,
    /** Target must be within this angle either side of where you face, degrees. Not in spec. */
    coneDeg: 70,
    cooldownSeconds: 3,
    /** Health the slapper pays, percentage points. The recipient loses nothing (agreed core rule). */
    cost: 1,
  },

  scorpions: {
    /** Distance at which a scorpion stings. Open in spec; placeholder. */
    triggerRange: 2.5,
    /** Sting damage, percentage points. Open in spec; placeholder. Never kills instantly (dying still lasts 60 s). */
    damage: 15,
    /** Agreed core rule: a replacement appears at the same spot 10 s after a sting. */
    respawnSeconds: 10,
  },

  fairness: {
    /** First-water target for a new player (spec working proposal): reachable crawling in about 3 minutes... */
    maxFirstWaterSeconds: 180,
    /** ...arriving with about 20% health or more. */
    minArrivalHealth: 20,
    /** Size of a pathfinding cell for route checks, m. */
    routeCellSize: 1,
  },

  chat: {
    maxLength: 200,
    /** Minimum seconds between messages from one player (operational safeguard). */
    minIntervalSeconds: 1,
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
    /** A dropped connection keeps its living character this long, s. Open in spec; not in spec; placeholder. */
    reconnectSeconds: 20,
    /** An empty session (and its skeletons) is kept this long, then retired, minutes (spec working proposal: 10). */
    emptyGraceMinutes: 10,
  },
} as const;
