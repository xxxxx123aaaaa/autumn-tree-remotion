/**
 * `./engine/index.js`（场景引擎，ESM/Canvas2D）的类型声明。
 *
 * 引擎由 scene-port 从参考 p5 实现移植而来（见 ./README.md）：
 *   createEngine({ canvas }) → { renderFrame(t, skyTime), canvas, ... }
 * 逻辑坐标固定 720×960；传入 1080×1440 的 canvas 时 scale = 1.5。
 */

export type SceneEngineCanvas = HTMLCanvasElement;

export type SceneEngine = {
  /** 引擎绑定的输出画布（即传入的 <canvas>） */
  readonly canvas: SceneEngineCanvas;
  readonly width: number;
  readonly height: number;
  readonly scale: number;
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  readonly duration: number;
  readonly look: string;
  /** 同步渲染一帧：t = 场景时间（0..24s），skyTime = 月相/星光时间 */
  renderFrame(t: number, skyTime?: number): SceneEngineCanvas;
  /** renderFrame 的别名 */
  render(t: number, skyTime?: number): SceneEngineCanvas;
  rebuildMoon(): void;
  destroy(): void;
};

export type CreateEngineOptions = {
  /** 输出画布宽（像素）；省略时取 canvas.width */
  width?: number;
  /** 输出画布高（像素）；省略时按 3:4 推出 */
  height?: number;
  /** 缩放比；省略时 scale = width / 720 */
  scale?: number;
  /** 复用的画布（浏览器传 <canvas> 元素） */
  canvas?: SceneEngineCanvas | null;
  /** 画布工厂（Node 环境必须传，例如 @napi-rs/canvas 的 createCanvas） */
  createCanvas?: (width: number, height: number) => unknown;
  /** 是否启用 WebGL 反光（需先 import glitter.js；默认 false，走 Canvas2D 回退） */
  glitter?: boolean;
  /** 月面栅格使用的逻辑显示宽度 */
  displayWidth?: number;
  devicePixelRatio?: number;
};

/** 同步创建引擎并完成初始化（背景 grain / 树冠缓存 / 月面栅格，约 1–3 秒）。 */
export function createEngine(options?: CreateEngineOptions): SceneEngine;

export const LOGICAL_WIDTH: number;
export const LOGICAL_HEIGHT: number;
export const DURATION: number;
export const LOOK: string;
export const SCENE_INFO: {W: number; H: number; DURATION: number; LOOK: string};
