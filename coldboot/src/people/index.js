// People: Microsoft Rocketbox avatars + motion capture.
//   buildCharacter(dna) → Character (person.js), new Animator(ch) (animator.js),
//   loadAvatar / loadClips / preload (loader.js), AVATARS / CLIPS (catalog.js).
export { buildCharacter, Character, avatarOf, DEFAULT_DNA } from './person.js';
export { Animator, voiceFeatures } from './animator.js';
export { loadAvatar, loadClips, preload } from './loader.js';
export { AVATARS, CLIPS, PLAYER_AVATARS, FOLK_AVATARS } from './catalog.js';
