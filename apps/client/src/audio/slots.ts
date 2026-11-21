/**
 * SOUND SLOTS — like the art slots, but for audio.
 *
 * Every sound is made in code for now (no music, ever: spec section 14).
 * To replace one with a recorded sound, drop a file with the slot's name into
 * apps/client/public/assets/sounds/ (.ogg, .mp3 or .wav), e.g. "slap.ogg".
 * The game uses it on the next page load. One-shot slots can have variants:
 * "slap_2.ogg", "slap_3.ogg"... and one is picked at random each time.
 */
export const SOUND_SLOTS = {
  wind: "Continuous desert wind, seamless loop, 10-30 s.",
  gust: "A gust of wind with moving sand, 2-5 s.",
  breath_in: "One heavy, dry inhale.",
  breath_out: "One heavy, rasping exhale.",
  gasp: "A sudden desperate gasp (low health).",
  sand: "Hand or knee dragging through sand, very short.",
  footstep: "One laboured footstep in sand.",
  slap: "Comic slap impact.",
  clatter: "Skeleton bones clattering after a slap.",
  groan: "Exaggerated final death groan.",
  sparkle: "Subtle magical shimmer as the soul rises.",
  drink: "Desperate gulping at a well.",
  sting: "Scorpion sting: a sharp zap and a yelp.",
} as const;

export type SoundSlot = keyof typeof SOUND_SLOTS;
