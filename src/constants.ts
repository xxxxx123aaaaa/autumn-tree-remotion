export const VIDEO = {
  width: 1080,
  height: 1440,
  fps: 30,
  durationInFrames: 560,
} as const;

/** 参考实现的「基准时间」长度（秒）：p5 场景 24s 完成后进入星光收尾。 */
export const BASE_DURATION_SECONDS = 24;
/** 成片速度 = 基线时间 × 1.5（16s 播完 24s 场景 + 约 2.667s 星光收尾）。 */
export const SPEED = 1.5;

export type SceneTime = {
  /** 成片秒数（frame / fps） */
  seconds: number;
  /** 乘以速度后的时间：base = seconds * SPEED */
  base: number;
  /** 场景引擎时间：t = min(24, base) */
  t: number;
  /** 月亮/星光时间：skyTime = t + max(0, base - 24) */
  skyTime: number;
};

/**
 * 帧 → 场景时间映射（与 MISSION.md 一致）：
 *   base    = frame / fps * 1.5
 *   t       = min(24, base)
 *   skyTime = t + max(0, base - 24)
 *
 * 视觉依据：金色树冠在成片 ≈2.0s 稳定（基准 TREE_END=3s ÷ 1.5）；
 * 月亮在 ≈8.23s 出现（基准 ≈12.35s）；满月在 ≈11.33s（基准 17s）。
 */
export function frameToSceneTime(frame: number): SceneTime {
  const seconds = frame / VIDEO.fps;
  const base = seconds * SPEED;
  const t = Math.min(BASE_DURATION_SECONDS, base);
  const skyTime = t + Math.max(0, base - BASE_DURATION_SECONDS);
  return {seconds, base, t, skyTime};
}
