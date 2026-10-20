import React, {useLayoutEffect, useRef, useState} from 'react';
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
} from 'remotion';
import {VIDEO, frameToSceneTime} from './constants';
import {createEngine, type SceneEngine} from './engine/index.js';

/**
 * 引擎初始化较重（背景 grain / 月面 / 树冠缓存，约 1–3 秒，同步完成），
 * 用 delayRender 让 Remotion 等到初始化完成再截帧；超时给足 5 分钟。
 */
const ENGINE_INIT_TIMEOUT_MS = 300_000;

/**
 * 模块级缓存：Remotion 渲染时所有帧共用一个页面、一个 canvas，
 * 引擎只初始化一次；若 canvas 元素变化（Studio 热更新等）则重建。
 */
let engineCache: {canvas: HTMLCanvasElement; engine: SceneEngine} | null = null;

export const AutumnTreeMoon: React.FC = () => {
  const frame = useCurrentFrame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState<SceneEngine | null>(null);

  // 首帧渲染时注册 delayRender（引擎未就绪前不截帧）
  const [initHandle] = useState<number>(() =>
    delayRender('初始化场景引擎', {timeoutInMilliseconds: ENGINE_INIT_TIMEOUT_MS}),
  );

  // 一次性初始化：拿到 canvas 元素后同步创建引擎（重活），完成后 continueRender。
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    try {
      const cached = engineCache && engineCache.canvas === canvas ? engineCache.engine : null;
      const created =
        cached ??
        createEngine({
          canvas,
          width: VIDEO.width,
          height: VIDEO.height,
        });
      engineCache = {canvas, engine: created};
      setEngine(created);
    } catch (error) {
      cancelRender(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    continueRender(initHandle);
  }, [initHandle]);

  // 每帧同步重绘：layout 阶段完成，Remotion 截帧时像素已就绪。
  useLayoutEffect(() => {
    if (!engine) {
      return;
    }
    const {t, skyTime} = frameToSceneTime(frame);
    try {
      engine.renderFrame(t, skyTime);
    } catch (error) {
      cancelRender(error instanceof Error ? error : new Error(String(error)));
    }
  }, [engine, frame]);

  return (
    <AbsoluteFill style={{backgroundColor: '#000000'}}>
      <canvas
        ref={canvasRef}
        width={VIDEO.width}
        height={VIDEO.height}
        style={{width: '100%', height: '100%', display: 'block'}}
      />
    </AbsoluteFill>
  );
};
