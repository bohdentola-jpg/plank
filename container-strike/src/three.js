// Single re-export point for the vendored three.js build so every module
// (browser and node test alike) resolves the same copy via relative paths.
// The copy lives inside container-strike/ so the game is fully self-contained.
export * from '../vendor/three.module.js';
