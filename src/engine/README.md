# `src/engine/` —— 场景引擎（Canvas2D 确定性渲染内核）

本目录是从参考 p5.js 实现（[WiseWong6/august-night-osmanthus](https://github.com/WiseWong6/august-night-osmanthus)）
移植来的确定性场景引擎，**由 scene-port 产出并直接复制**，只为 Remotion 渲染服务。
Remotion 组件（`src/AutumnTreeMoon.tsx`）只通过 `createEngine()` 使用它。

| 文件 | 作用 |
|---|---|
| `index.js` | 引擎入口：`createEngine({canvas, width, height})` → `{canvas, renderFrame(t, skyTime), ...}`；负责 p5 实例、逻辑坐标 720×960 与输出尺寸 scale 的换算、逐帧 `setTransform` |
| `p5-compat.js` | 最小 p5 兼容层（`createCanvas / pixelDensity / createGraphics / image / drawingContext / noLoop`），可在浏览器 `<canvas>` 与 Node `@napi-rs/canvas` 上运行 |
| `scene.js` | 移植后的 `ref/p5src/scene.js`：`render(t, skyTime)` 纯函数式绘制（树生长 / 金色树冠 / 落物 / 化蝶 / 赴月 / 月相 / 星光） |
| `tree-data.js` | 树几何与时间数据（约 5.2MB，`globalThis.NightTreeData`，由 `scene.js` 直接 import） |
| `moon-map.js` | 月面明暗数据（`globalThis.NightMoonMap`，128×128 灰度） |
| `index.d.ts` | 上述引擎的 TypeScript 类型声明（给 Remotion 组件用） |

## 与 Remotion 的边界约定

```ts
const engine = createEngine({canvas, width: 1080, height: 1440}); // 逻辑坐标 720×960，scale = 1.5
engine.renderFrame(t, skyTime); // 同步绘制到 canvas；t = min(24, frame/30*1.5)
```

* **逻辑坐标固定 720×960**（与参考 p5 实现一致），`width/height` 是输出像素尺寸，
  `scale = width / 720`；传入 1080×1440 的 `<canvas>` 时自动按 1.5 倍栅格化；
* **确定性**：同一 `(t, skyTime)` 必出同样像素；不使用 `Math.random` / `Date.now` / rAF；
* **同步**：`renderFrame()` 返回时像素已写好，组件在 `useLayoutEffect` 里调用后即被 Remotion 截帧；
* **不依赖 GPU**：走 Canvas2D（浏览器 Canvas2D 与 Node 的 Skia 实现同一光栅器）。
  参考实现的 `glitter.js`（WebGL 反光）**未纳入**本仓库，引擎默认 `glitter: false`
  走 `drawSurfaceLight` Canvas2D 回退路径，保证无 GPU 的 headless Chromium 也能出片；
* **初始化重**：`createEngine()` 同步执行背景 grain / 月面栅格 / 树冠缓存烘焙（约 1–3 秒），
  组件用 `delayRender(..., {timeoutInMilliseconds: 300_000})` 等它完成，之后所有帧复用同一实例。

## 时间映射（由组件传入，引擎不感知）

```
base    = frame / 30 * 1.5
t       = min(24, base)                 // 场景时间 0..24s
skyTime = t + max(0, base - 24)         // 24s 后继续增长（月相 / 星光收尾）
```

映射实现见 `src/constants.ts` 的 `frameToSceneTime()`。

## 说明

引擎文件由场景移植方（scene-port）在 `D:\动效库\engine\` 开发并逐帧对照参考视频验证
（720×960 下与参考帧 MAE≈1.15 / SSIM≈0.994），复制进本仓库时**未改动内容**（md5 一致）。
