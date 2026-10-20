import {Config} from '@remotion/cli/config';

// 入口与输出
Config.setEntryPoint('./src/index.ts');

// 视频编码：H.264 / yuv420p / crf 18（视觉无损，兼容各播放器）
Config.setVideoImageFormat('jpeg');
Config.setCodec('h264');
Config.setCrf(18);
Config.setPixelFormat('yuv420p');
Config.setOverwriteOutput(true);

// 并发：1080x1440 的 Canvas2D 逐帧渲染，单帧较重。默认 4，
// 机器核少/内存紧张时命令行用 --concurrency=2 覆盖。
Config.setConcurrency(4);
