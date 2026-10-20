# RENDER-REPORT.md —— 成片渲染与逐帧复核报告

日期：2026-10-20 · 作者：remotion-shell · 参考：`ref/reference.mp4`（《树上的秋天化作了月光》，Motion Face 片段）

## 一、结论

- **成片**：`out/autumn-tree-moon.mp4` —— **1080×1440、30 fps、560 帧、18.667 s、H.264 High / yuv420p / CRF 18、3.39 MB**（`out/` 已 gitignore，不入库）。
- **复刻度**：与参考视频抽帧逐帧对照，**MAE 均值 1.16 / SSIM 均值 0.9939**（75 帧、720×960，0.25 s–18.5 s 全覆盖）；从成片 mp4 再抽 13 帧对照，**MAE 1.36 / SSIM 0.9921**（含 H.264 有损 + 缩放误差）。
- **一致性**：树形/树冠范围、金色配色、落物、触地反弹、化蝶、蝶群赴月、月相由缺到圆、星光收尾与参考在时序与构图上一致；见对照图 [`docs/render-compare.jpg`](docs/render-compare.jpg)。
- **仓库状态**：`npm install` → `npx remotion render` 一条命令出片（正常机器）；打包链路已实测（见 `TESTING.md`）。

## 二、本机渲染路径说明（重要）

**本机 DSH 沙箱无法启动任何 Chromium**：沙箱禁止进程创建 Windows named pipe，而 Chromium 的
mojo IPC 强依赖 named pipe，系统 Chrome 155 / Playwright chrome-headless-shell 148 / Remotion
自带 Chrome Headless Shell 全部在启动阶段 FATAL：

```
FATAL:mojo\public\cpp\platform\platform_channel.cc:108] Check failed: . : 拒绝访问。 (0x5)
```

因此 `npx remotion render`（依赖 Chrome Headless）**无法在本沙箱内执行**。为了完成逐帧视觉验证，
本次采用**等价渲染路径**：

1. 使用与仓库**完全相同的引擎源码**：`src/engine/{index,p5-compat,scene,tree-data,moon-map}.js`
   （由 `engine/` 移植产物复制而来，md5 与源目录完全一致，渲染前再次校验）；
2. 使用 `src/constants.ts` 里**同一个** `frameToSceneTime()` 做帧→时间映射
   （`t = min(24, frame/30*1.5)`，`skyTime = t + max(0, frame/30*1.5-24)`）；
3. 用 `@napi-rs/canvas`（Skia，与 Chrome Canvas2D 同一光栅器）渲染 1080×1440 的 560 帧
   （即 Remotion 组件里 `<canvas>` 每帧实际会收到的像素：组件仅做 `delayRender` + `engine.renderFrame(t, skyTime)`）；
4. `ffmpeg` 编码 H.264（CRF 18 / yuv420p / 30 fps）。

> 换句话说：Remotion 组件在浏览器里做的是「每帧把 t/skyTime 交给引擎，引擎同步画到 canvas」，
> 本报告用同样的引擎、同样的映射、同样的 1080×1440 输出在 Node 里复现了这部像素生成过程；
> 唯一未在本机执行的是 Chrome 自身的 canvas 光栅化（同为 Skia，理论上逐像素等价）。
> 真实 Remotion 出片命令见第四节。
>
> **补记（2026-10-21）**：验证环境后来获得了完整进程权限，**真实 Remotion + Chromium 渲染已在本机
> 成功执行**（`renderStill` 与整片 `renderMedia`），成片与等价路径一致，详见第六节。

## 三、逐帧复核

### 3.1 无损 PNG 对照（75 帧，720×960，覆盖 0.25 s–18.5 s）

对照源：`ref/cmp/f000N.png`（参考视频 4 fps 抽帧）；渲染帧：引擎同一映射渲染后输出 720×960。
帧号映射：`cmp f000N = 视频帧 round((N-1)*7.5) + 3`（与 `engine/validate.js` 的实测校准一致）。

| 指标 | 均值 | 中位 | 最小 | 最大 |
|---|---|---|---|---|
| MAE（0–255） | **1.1649** | 1.1449 | 0.0048 | 1.5343 |
| SSIM | **0.99394** | 0.9949 | 0.98877 | 0.99998 |

- 最大误差帧：`f0027`（视频 t≈2.43 s，MAE 1.534 / SSIM 0.9888）、`f0030`（t≈2.71 s，1.510 / 0.9891）、
  `f0032`（t≈2.93 s，1.510 / 0.9905）——集中在**树冠快速生长/落物起步**的高频细节段，属亚像素级差异；
- 全黑起始段（`f0001`–`f0005`）MAE ≤ 0.62，几乎逐像素一致；
- 该结果与场景移植阶段（`engine/validate.js`）报告的 MAE≈1.15 / SSIM≈0.994 一致，说明引擎在
  **repo 集成的同一份代码**下行为未变。

逐帧明细：`.npm-cache/render-check/compare-raw.csv`（本机工作区，未入库）。

### 3.2 成片 mp4 抽帧对照（13 帧）

从 `out/autumn-tree-moon.mp4` 按帧号 `3,48,93,…,543`（对应 `ref/cmp` 的 f0001…f0073）抽帧，
再与参考对照：

| 指标 | 均值 | 中位 | 最小 | 最大 |
|---|---|---|---|---|
| MAE | **1.3633** | 1.4230 | 0.0059 | 1.6461 |
| SSIM | **0.99208** | 0.99196 | 0.98941 | 0.99997 |

比无损 PNG 对照略高，来自 H.264 有损压缩与 1080→720 缩放；13 帧全部 SSIM ≥ 0.989。

### 3.3 对照图

[`docs/render-compare.jpg`](docs/render-compare.jpg)：12 组「左=参考 ref/cmp，右=成片抽帧（1080×1440）」
网格，标注每帧 t / MAE / SSIM；底部为汇总。可见树、树冠、金色粒子、蝶群、月相与参考基本一致。

## 四、Remotion 出片命令（正常机器直接可用）

```bash
cd repo
npm install
npx remotion render AutumnTreeMoon out/autumn-tree-moon.mp4          # 整片 560 帧
npx remotion render AutumnTreeMoon out/autumn-tree-moon.mp4 --concurrency=2   # 低配机器
npx remotion still AutumnTreeMoon out/still-frame-240.png --frame=240         # 单帧
```

- composition：`AutumnTreeMoon`，1080×1440 / 30 fps / 560 帧；
- 引擎初始化约 1–3 s（`delayRender` 超时设 300 s）；
- 全部 Canvas2D 绘制，**不依赖 GPU/WebGL**（无 GPU 的 headless Chromium 可出片）。

## 五、已知差异 / 风险

1. **浏览器光栅化未在本机执行**：Chrome Canvas2D 与 Node Skia 同为 Skia 光栅器，但抗锯齿/渐变插值
   可能有极小差异；逐帧指标已在 Node 侧达到 MAE 1.16 / SSIM 0.994，参考视频本身即为原 p5 实现的
   浏览器渲染结果，同源引擎的差异应远小于此。
2. **参考视频为原实现 4K 成片的 1.5 倍速压缩**，本复刻按时间映射对齐；抖动/颗粒为确定性种子生成，
   与参考非逐像素相同（这是 MAE 主要来源）。
3. **无音轨**：参考视频音轨来自原实现的 `sound.js` 合成，本复刻只还原画面（仓库不含音频）。
4. 引擎 `glitter.js`（WebGL 反光）**未纳入**，统一走 Canvas2D 回退，保证无 GPU 可渲染；
   与参考的差异主要是金色表面高光强度，肉眼几乎不可辨（MAE 已体现）。

## 六、真实 Remotion + Chromium 渲染验证（2026-10-21 补记）

验证环境（本机 Windows 11 / Node v23.11）后来获得完整进程权限（Chromium 所需的 named pipe 可用），
于是用**仓库内同一份代码**完成了真实 Remotion 渲染：

- 打包：`npx remotion bundle --out-dir=out/bundle-webpack`（此前已验证成功）；
- 渲染：`@remotion/renderer` 的 `selectComposition` → `renderStill` / `renderMedia`，
  浏览器使用本机 Chrome（`--browser-executable`，Chrome 155），组件内 `delayRender` 等引擎初始化；
- 结果：
  - **单帧**：`out/remotion-still-240.png`（1080×1440，第 240 帧）✅；与参考视频第 240 帧（同尺寸）
    对照 **MAE 1.32 / SSIM 0.9899**；
  - **整片**：`out/autumn-tree-moon-remotion.mp4` —— **4,531,704 B / 1080×1440 / 30 fps / 560 帧 /
    18.667 s / H.264**，渲染耗时 **69.2 s**（concurrency=2）；
  - 整片按帧号 `15,30,60,120,180,240,300,360,420,480,540` 抽 11 帧，与参考视频同帧号（720×960）对照：
    **MAE 均值 1.0985 / 中位 1.2422 / 最大 1.4354；SSIM 均值 0.9918 / 最小 0.9886**。
- 结论：真实 Remotion 管线的成片与 §3 等价路径指标一致（同一引擎、同一映射），
  **复刻度不依赖等价路径假设**；此前"沙箱无法启动 Chromium"仅是本机验证环境的阶段性限制，与仓库无关。
