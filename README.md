# 树上的秋天化作了月光 · Remotion 复刻

用 [Remotion](https://www.remotion.dev/) 复刻 Motion Face 片段
**《树上的秋天化作了月光》**（作者：WiseWong6）。

- 成片规格：**1080 × 1440（3:4）· 30 fps · 560 帧 · 18.667 s**
- 组合 ID：`AutumnTreeMoon`
- 渲染内核：纯 **Canvas 2D**（逐帧确定性绘制），**不依赖 GPU / WebGL**，无显卡机器也能出片
- 音频：参考实现的音轨来自其 `sound.js` 合成，本复刻**只还原画面**，不含音轨

## 快速开始

```bash
# 1. 安装依赖（Node 18+，实测 Node v23.11）
npm install

# 2. 预览（浏览器打开 Remotion Studio）
npm run dev

# 3. 渲染整片（默认输出 out/autumn-tree-moon.mp4）
npm run render
# 等价于：
npx remotion render AutumnTreeMoon out/autumn-tree-moon.mp4

# 4. 只渲染某一帧（PNG，便于对照检查）
npx remotion still AutumnTreeMoon out/still-frame-240.png --frame=240
```

常用可选参数：

```bash
# 机器内存紧张时降低并发（默认 4）
npx remotion render AutumnTreeMoon out/autumn-tree-moon.mp4 --concurrency=2

# 渲染片段（0~3 帧）快速验证链路
npx remotion render AutumnTreeMoon out/test.mp4 --frames=0-3

# 输出 GIF 预览
npx remotion render AutumnTreeMoon out/preview.gif --codec=gif --every-nth-frame=2
```

输出目录 `out/` 与 `node_modules/` 已在 `.gitignore` 中忽略，不会入库。

> 首次执行 `npm run render` / `npm run still` 时，Remotion 会自动下载 **Chrome Headless Shell**
> （约 120 MB，缓存在本机）；渲染全程 Canvas2D，不需要独立显卡/WebGL。
> 如需使用本机已安装的 Chrome，可加 `--browser-executable="<chrome.exe 路径>"`。

## 项目结构

```
repo/
├── package.json          # remotion 4.0.537 / @remotion/cli 4.0.537 / react 19
├── package-lock.json     # 依赖锁定（提交，保证可复现）
├── remotion.config.ts    # 编码 h264 / crf 18 / yuv420p / 并发 4
├── tsconfig.json
├── src/
│   ├── index.ts          # registerRoot 入口
│   ├── Root.tsx          # 注册 <Composition id="AutumnTreeMoon">
│   ├── AutumnTreeMoon.tsx# 组合组件：<canvas> + delayRender + 每帧 useLayoutEffect 同步重绘
│   ├── constants.ts      # 成片参数 + 帧→场景时间映射
│   └── engine/           # 场景引擎（Canvas2D 确定性渲染内核，移植自参考 p5 实现）
│       ├── index.js      # createEngine({canvas}) → renderFrame(t, skyTime)（逻辑坐标 720×960）
│       ├── p5-compat.js  # 最小 p5 兼容层（浏览器 canvas / Node @napi-rs/canvas 通用）
│       ├── scene.js      # 移植后的 scene.js：树生长/金色树冠/落物/化蝶/赴月/月相/星光
│       ├── tree-data.js  # 树几何与时间数据（约 5.2MB）
│       ├── moon-map.js   # 月面明暗数据（128×128）
│       ├── index.d.ts    # 引擎 TypeScript 类型声明
│       └── README.md     # 引擎 API、边界约定与移植说明
├── docs/
│   └── render-compare.jpg# 成片抽帧 vs 参考抽帧 对照图（<1MB）
├── RENDER-REPORT.md      # 等价成片验证报告（指标/对照/沙箱说明）
├── TESTING.md            # 渲染链路验证记录（命令 / 耗时 / 结果）
└── README.md
```

## 时间映射（关键）

参考视频是原始 p5 场景的 **1.5 倍速**版本（基准时间 24 s 压缩到 16 s），加约 2.667 s 星光收尾。
成片第 `frame` 帧（0-based，fps = 30）映射到场景时间：

```
base    = frame / 30 * 1.5
t       = min(24, base)                 // 场景时间 0..24s（生长/落叶/化蝶/赴月）
skyTime = t + max(0, base - 24)         // 24s 后继续增长（月相/星光收尾）
```

视觉依据：金色树冠在成片 ≈2.0 s 稳定（基准 `TREE_END = 3 s` ÷ 1.5）；月亮在 ≈8.23 s
出现（基准 ≈12.35 s）；满月在 ≈11.33 s（基准 17 s）。

映射实现见 `src/constants.ts` 的 `frameToSceneTime()`。

## 渲染实现要点

1. `<canvas width={1080} height={1440}>`，每一帧在 `useLayoutEffect` 中**同步**绘制
   （Remotion 截帧时像素已就绪，不依赖 rAF 异步刷新）；
2. 场景引擎初始化较重（背景 grain / 月面 / 树冠缓存，约 1–3 秒，同步完成），用
   `delayRender(..., {timeoutInMilliseconds: 300_000})` 等待初始化完成，
   初始化完成后 `continueRender`，之后每帧复用同一引擎实例；
3. 引擎内部绘制坐标系固定 **720 × 960**（与原 p5 实现一致），`createEngine({canvas})`
   按 `scale = 1080/720 = 1.5` 设置 `ctx.setTransform`，直接绘制到 1080 × 1440 的
   `<canvas>` 上（无需二次缩放贴图）；
4. 全部绘制走 Canvas 2D；若引擎内含 WebGL 反光增强，缺失 WebGL 时自动回退，
   保证 headless Chromium（无 GPU）可出片。

## 复刻来源与致谢

- 原始动效：Motion Face 片段《树上的秋天化作了月光》，作者 **WiseWong6**
  （片段 ID `2ce87c62-2623-4af7-9cd4-6473e2a231c2`）。
- 公开参考实现：[WiseWong6/august-night-osmanthus](https://github.com/WiseWong6/august-night-osmanthus)
  （p5.js 原实现）。本项目在视觉上复刻该作品，渲染内核移植自其公开源码，
  仅用于学习与动效复刻展示；版权归原作者所有。
- 本项目使用 [Remotion](https://www.remotion.dev/)（Remotion License）渲染。

## 验证结果（详见 [TESTING.md](TESTING.md) 与 [RENDER-REPORT.md](RENDER-REPORT.md)）

- 打包链路：默认 webpack 路径与 `--rspack` 均打包成功（52 个产物文件，含 5.2 MB `tree-data.js`）；
- 视觉复刻度（75 帧抽样，720×960 对照参考视频抽帧）：**MAE 均值 1.16 / SSIM 均值 0.9939**；
- **真实 Remotion + Chromium 渲染已实测通过**（2026-10-21）：`renderStill` 单帧成功；
  整片 `renderMedia` **560 帧 / 30 fps / 18.667 s**，渲染耗时 69 s；成片抽 11 帧与参考视频同帧对照
  **MAE 均值 1.0985 / SSIM 均值 0.9918**（min 0.9886，包含 H.264 有损与缩放误差）；
- 成片规格复核：1080×1440 / 30 fps / 560 帧 / 18.667 s / H.264（`out/` 不入库）；
- 对照图：[docs/render-compare.jpg](docs/render-compare.jpg)（左参考 / 右复刻）。

> 说明：本任务早期验证环境（DSH 沙箱）曾禁止 Chromium 所需的 Windows named pipe，
> 验证环境获得完整权限后已用真实 Remotion 渲染复核（见上）。仓库代码不依赖任何本地垫片，
> 正常机器上 `npm install && npx remotion render AutumnTreeMoon out/autumn-tree-moon.mp4` 即可出片。

## 备注

- 本仓库不含参考视频、参考截图或任何站点凭证；所有画面均由代码实时绘制。
- 依赖版本锁定为 `remotion@4.0.537`，`package-lock.json` 一并提交，`npm install`
  后即可复现。
