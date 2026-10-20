/* 场景引擎入口：把 p5 版 scene.js 包装成确定性逐帧渲染器。
 *
 *   import { createEngine } from './engine/index.js';
 *   import { createCanvas } from '@napi-rs/canvas';           // Node
 *   const engine = createEngine({ width: 720, height: 960, createCanvas });
 *   engine.renderFrame(t, skyTime);                            // 绘制到 engine.canvas
 *
 * 浏览器（Remotion）：传入 <canvas> 元素：
 *   const engine = createEngine({ width: 1080, height: 1440, canvas: canvasEl });
 *
 * 逻辑坐标固定 720×960（与参考 p5 实现一致）；width/height 是输出像素尺寸，
 * pixelDensity = width/720，内部据此放大 backing store。createEngine 同步完成初始化
 * （背景、树冠缓存、月面栅格等），耗时约 1–3 秒，Remotion 中请用 delayRender 等待。
 */
import { P5 } from './p5-compat.js';
import { mountScene, SCENE_INFO } from './scene.js';

export { P5, SCENE_INFO };
export { defaultCreateCanvas } from './p5-compat.js';

export const LOGICAL_WIDTH = SCENE_INFO.W;
export const LOGICAL_HEIGHT = SCENE_INFO.H;
export const DURATION = SCENE_INFO.DURATION;
export const LOOK = SCENE_INFO.LOOK;

/**
 * 创建场景引擎。
 * @param {object} [options]
 * @param {number} [options.width=720]   输出画布宽（像素）；scale = width / 720
 * @param {number} [options.height=960]  输出画布高（像素）
 * @param {HTMLCanvasElement|object} [options.canvas] 复用已有画布（浏览器/Node 均可）
 * @param {Function} [options.createCanvas] (w,h)=>canvas 工厂；Node 必需（@napi-rs/canvas.createCanvas）
 * @param {boolean} [options.glitter=false] 是否启用 WebGL 反光（需先 import './glitter.js'；默认关闭）
 * @param {number} [options.displayWidth=720] 月面栅格用的逻辑显示宽度（CSS 像素）
 */
export function createEngine(options = {}) {
  const { canvas = null, createCanvas } = options;
  // 未显式给尺寸时，从已有画布推断（Remotion 的 <canvas width=1080 height=1440> 即 scale=1.5）。
  let width = options.width ?? canvas?.width ?? null;
  let scale = options.scale ?? null;
  if (width == null) width = scale != null ? Math.round(LOGICAL_WIDTH * scale) : LOGICAL_WIDTH;
  if (scale == null) scale = width / LOGICAL_WIDTH;
  const height = options.height ?? Math.round(LOGICAL_HEIGHT * scale);
  const expectedHeight = Math.round(LOGICAL_HEIGHT * scale);
  if (Math.abs(expectedHeight - height) > 1) {
    throw new Error(`createEngine: 输出尺寸 ${width}×${height} 不是 3:4（按 scale=${scale} 应为 ${width}×${expectedHeight}）。`);
  }

  const p = new P5({ createCanvas, canvas, pixelDensity: scale });
  const env = {
    density: scale,
    displayWidth: options.displayWidth ?? LOGICAL_WIDTH,
    devicePixelRatio: options.devicePixelRatio ?? scale,
    glitter: options.glitter === true,
  };
  const scene = mountScene(p, env);
  p.start(); // 执行 p.setup：创建画布并烘焙全部缓存

  const engine = {
    /** 输出画布（浏览器 <canvas> 或 napi-rs Canvas） */
    canvas: p.canvas,
    width,
    height,
    scale,
    logicalWidth: LOGICAL_WIDTH,
    logicalHeight: LOGICAL_HEIGHT,
    duration: DURATION,
    look: LOOK,

    /**
     * 渲染某一时刻。
     * @param {number} t       动画时间 0..24 秒（确定性）
     * @param {number} [skyTime=t] 结尾星光时间（视频 16s 后继续增长）
     */
    renderFrame(t, skyTime = t) {
      const ctx = p.drawingContext;
      // 每帧从干净状态开始：保留外层 save，任何意外的 clip/变换在 restore 时收回。
      ctx.save();
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      try {
        scene.render(t, skyTime);
      } finally {
        ctx.restore();
      }
      return p.canvas;
    },

    /** renderFrame 的别名，贴合任务书中 `render(t, skyTime)` 的接口描述。 */
    render(t, skyTime = t) {
      return engine.renderFrame(t, skyTime);
    },

    /** 宿主 resize / 月面精度变化时可重建月面栅格。 */
    rebuildMoon() {
      scene.rebuildMoon();
    },

    destroy() {
      p.remove();
    },
  };

  return engine;
}
