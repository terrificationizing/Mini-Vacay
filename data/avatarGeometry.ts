// Shared shape produced by BOTH the preloaded-character table (data/avatarProfiles.ts)
// and the runtime user-photo pipeline (lib/avatarPipeline.ts), so MainScene has exactly
// one code path to apply an avatar regardless of where it came from.
export type AvatarGeometry = {
  eyeLocal: { left: { x: number; y: number }; right: { x: number; y: number } };
  scleraHeightLocal: number;
  shoulderLocal: { left: { x: number; y: number }; right: { x: number; y: number } };
  armColor: number; // 0xRRGGBB
  skinColor: number;
  irisColor: number;
};
