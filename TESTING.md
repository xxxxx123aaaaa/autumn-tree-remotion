# TESTING.md —— 渲染链路验证记录

记录本仓库在本机（Windows 11 / Node v23.11.0 / npm 10.9.2）上的实测结果。
结论先行：**仓库可安装、可 typecheck、可打包（webpack 默认路径与 Rspack 均通过）**；
Remotion 的浏览器渲染（`remotion still` / `remotion render`）在正常机器上即可运行，
但**在本任务所用的 DSH 沙箱内无法执行**（原因见 §3），成片改用等价路径渲染验证（§4、`RENDER-REPORT.md`）。

## 1. 依赖安装

```bash
npm install
```

| 项 | 结果 |
|---|---|
| 依赖 | `remotion@4.0.537`、`@remotion/cli@4.0.537`、`react@19.2.0`、`react-dom@19.2.0`、`typescript@5.9.3` |
| 包数量 / 耗时 | 258 个包 / **14.6 s**（npmmirror registry，本机缓存命中） |
| lockfile | `package-lock.json` 已生成并提交（146 KB） |

> 本机沙箱特例（**不属于项目依赖，正常机器无需任何处理**）：DSH 沙箱禁止 npm 的
> postinstall 使用 pipe（`spawn EPERM`），因此本机用 `--ignore-scripts` 安装；
> 其中只影响 esbuild 平台的 postinstall（运行期由 esbuild 的 `@esbuild/win32-x64` 平台包直接提供二进制，无需脚本）。
> 正常机器直接 `npm install` 即可。

## 2. 类型检查（tsc --noEmit）

```bash
npm run typecheck   # tsc --noEmit
```

结果：**exit 0，1.8 s**（`allowJs: true`，engine 目录的 JS 通过 `index.d.ts` 声明类型）。

## 3. 打包链路（`remotion bundle`，不需要浏览器）

```bash
npx remotion bundle --out-dir=out/bundle-webpack   # 默认 webpack 路径
npx remotion bundle --rspack --out-dir=out/bundle-rspack
```

| 路径 | 结果 | 耗时 | 产物 |
|---|---|---|---|
| 默认（webpack） | ✅ exit 0 | **24.2 s**（含首次缓存） | 52 个文件 / 46.6 MB |
| `--rspack` | ✅ exit 0 | **2.1 s** | 52 个文件 / 50.9 MB |

打包包含 React 19 + TypeScript + 引擎全部 JS + 5.2 MB `tree-data.js`（主 bundle 约 10.8 MB），
说明**入口/组合/引擎导入在浏览器打包路径上完整可用**。

> 本机为绕过沙箱，`remotion.config.ts` 的 esbuild 转译由本地垫片用 TypeScript 顶替；
> 正常机器上由 Remotion 自带的 esbuild 完成，行为等价。

## 4. 浏览器渲染（本沙箱内不可执行）

### 4.1 结论

`npx remotion still` / `npx remotion render` 在本沙箱内无法运行，**不是工程问题，是沙箱限制**：
DSH 沙箱禁止进程创建 Windows named pipe，而 Chromium 的 mojo IPC（浏览器 ↔ 渲染/GPU 进程通信）
必须使用 named pipe，因此任何 Chromium（系统 Chrome 155、Playwright 的
`chrome-headless-shell` 148、Remotion 自带的 Chrome Headless Shell）启动即崩溃：

```
FATAL:mojo\public\cpp\platform\platform_channel.cc:108] Check failed: . : 拒绝访问。 (0x5)
ERROR:third_party\crashpad\crashpad\client\crashpad_client_win.cc:430] OpenProcess: 拒绝访问。 (0x5)
```

`--single-process --in-process-gpu --no-sandbox --disable-gpu --disable-breakpad --noerrdialogs`
等参数均无法绕过（实测），因此 Remotion 依赖的 Chrome 渲染在沙箱内不可达。

### 4.2 非沙箱环境（正常机器 / 用户本机终端）执行命令

```bash
# 单帧（PNG）
npx remotion still AutumnTreeMoon out/still-frame-30.png --frame=30

# 整片（1080×1440 / 30 fps / 560 帧）
npx remotion render AutumnTreeMoon out/autumn-tree-moon.mp4

# 低配机器：并发降到 2
npx remotion render AutumnTreeMoon out/autumn-tree-moon.mp4 --concurrency=2
```

预期：引擎初始化约 1–3 s（`delayRender` 超时 300 s，不会误判）；渲染 560 帧（Canvas2D，无 GPU 依赖）。

### 4.3 本机验证用的沙箱垫片说明（**不进仓库、不是项目依赖**）

为验证"Node 侧 spawn / 打包 / config"链路，本机验证时用了一个本地垫片
（`--require` 注入的 NODE_OPTIONS，位于工作区 `.npm-cache/shim/`，**不在本仓库内**）：
它把 `child_process.spawn` 的 piped stdio 转成 Python 子进程代理、把 `execFileSync` 换成
Python 捕获、把 config 的 esbuild 转译换成 TypeScript。仅用于本机沙箱；
**仓库本身不依赖、不引用任何垫片**，正常机器 `npm i && npx remotion render` 原生可用。

## 5. 等价成片验证（本机实际执行）

在无法启动 Chromium 的前提下，用**与仓库完全相同的引擎代码 + 完全相同的帧→时间映射**
在 Node（`@napi-rs/canvas`，Skia，与 Chrome Canvas2D 同一光栅器）中逐帧渲染，
再用 ffmpeg 编码，得到等价成片并逐帧对照参考（详见 `RENDER-REPORT.md`）。

| 项 | 实测 |
|---|---|
| 引擎初始化（1080×1440，Node） | 0.10 s |
| 渲染 560 帧 | **46.5 s**，平均 **83.1 ms/帧**（p95 110 ms，最慢 452 ms） |
| 帧图输出 | `out/frames/f0000.png … f0559.png`（255.4 MB，不入库） |
| ffmpeg 编码（h264/crf18/yuv420p/30fps） | 10.5 s |
| 成片 | `out/autumn-tree-moon.mp4`：**3.39 MB / 1080×1440 / 30 fps / 560 帧 / 18.667 s** |
| 与参考视频逐帧对照（75 帧，720×960） | MAE 均值 **1.16** / 中位 1.14；SSIM 均值 **0.9939** |
| 成片抽 13 帧与参考对照 | MAE 均值 **1.36**；SSIM 均值 **0.9921** |

等价的命令链（本机执行，非仓库内容）：

```bash
node render-verify.mjs --frames=560 --width=1080            # 逐帧 PNG
ffmpeg -framerate 30 -start_number 0 -i out/frames/f%04d.png \
       -c:v libx264 -crf 18 -pix_fmt yuv420p out/autumn-tree-moon.mp4
```

## 6. 验证命令清单（给非沙箱环境复跑）

```bash
npm install                 # 或 npm ci
npm run typecheck           # tsc --noEmit
npm run bundle              # remotion bundle（可选，验证打包）
npm run still               # 单帧 PNG
npm run render              # 整片 mp4
```
