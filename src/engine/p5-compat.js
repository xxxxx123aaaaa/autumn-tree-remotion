/* 最小 p5.js 兼容层（Canvas2D 子集）。
 *
 * 目标：让 ref/p5src/scene.js 的绘制代码几乎原样运行在任意 Canvas2D 实现上：
 *   - 浏览器：HTMLCanvasElement
 *   - Node：@napi-rs/canvas（或其它 createCanvas 工厂）
 *
 * 只实现 scene.js 实际用到的 API：
 *   new p5 / p.setup / p.draw / p.createCanvas().parent() / p.pixelDensity(d) /
 *   p.frameRate() / p.createGraphics(w,h)（.drawingContext / .pixelDensity() / .canvas / .remove()）/
 *   p.image(img,x,y[,w,h]) / p.drawingContext / p.loop() / p.noLoop()
 *
 * 语义与 p5 1.x 对齐：pixelDensity(d) 表示 backing store = 逻辑尺寸 × d，
 * drawingContext 上的变换始终带有 scale(d)，因此绘制代码使用逻辑坐标（720×960）。
 */

/** 默认画布工厂：浏览器用 DOM canvas；Node 环境需由调用方注入。 */
export function defaultCreateCanvas(w, h) {
  if (typeof document !== 'undefined' && document.createElement) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    return canvas;
  }
  throw new Error(
    'p5-compat: 当前环境没有 document.createElement；Node 中请传入 createCanvas（例如 @napi-rs/canvas 的 createCanvas）。'
  );
}

/** 取 2D 上下文（兼容 napi-rs canvas 与浏览器）。 */
function get2d(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('p5-compat: canvas.getContext("2d") 返回空。');
  return ctx;
}

/** 等价的 p5.Graphics：逻辑尺寸 w×h，像素密度 pd。 */
export class Graphics {
  constructor(width, height, pixelDensity, createCanvas) {
    this.width = width;
    this.height = height;
    this._pixelDensity = pixelDensity;
    this._createCanvas = createCanvas;
    this._build();
  }

  _build() {
    const pd = this._pixelDensity;
    this.canvas = this._createCanvas(Math.round(this.width * pd), Math.round(this.height * pd));
    this.drawingContext = get2d(this.canvas);
    this.drawingContext.scale(pd, pd);
  }

  /** p.pixelDensity(d)：改变 backing store 分辨率；d 与当前一致时为 no-op。 */
  pixelDensity(d) {
    if (d === undefined) return this._pixelDensity;
    if (d === this._pixelDensity) return this;
    if (!(d > 0)) throw new Error(`p5-compat: 非法 pixelDensity ${d}`);
    this._pixelDensity = d;
    this.canvas.width = Math.round(this.width * d);
    this.canvas.height = Math.round(this.height * d);
    this.drawingContext = get2d(this.canvas);
    this.drawingContext.scale(d, d);
    return this;
  }

  /** p5.Graphics.clear()：清空整块图形（保留像素密度与变换）。 */
  clear() {
    if (this.drawingContext) this.drawingContext.clearRect(0, 0, this.width, this.height);
    return this;
  }

  remove() {
    if (this.canvas) {
      this.canvas.width = 0;
      this.canvas.height = 0;
    }
    this.canvas = null;
    this.drawingContext = null;
  }
}

/** 最小 p5 实例。构造后调用 start() 执行 setup（scene 的 setup 会创建画布并烘焙缓存）。 */
export class P5 {
  /**
   * @param {object} opts
   * @param {Function} [opts.createCanvas]  (w,h)=>canvas 工厂；Node 必须提供
   * @param {object}   [opts.canvas]        复用已有主画布（浏览器 <canvas> / napi canvas）
   * @param {number}   [opts.pixelDensity]  初始像素密度
   */
  constructor(opts = {}) {
    this._providedCanvas = opts.canvas || null;
    this._createCanvas = opts.createCanvas || ((w, h) => {
      // 没显式给工厂时：优先用主画布同类型构造（Node 的 @napi-rs/canvas 可行），
      // 其次回退到浏览器 document（HTMLCanvasElement 构造函数非法，会抛错后被捕获）。
      if (this._providedCanvas) {
        try {
          const sameType = new this._providedCanvas.constructor(w, h);
          if (sameType && typeof sameType.getContext === 'function') return sameType;
        } catch {
          /* 浏览器 HTMLCanvasElement：走下面的 document 路径 */
        }
      }
      return defaultCreateCanvas(w, h);
    });
    this._pixelDensity = opts.pixelDensity || 1;
    this._mainCanvas = null;
    this._mainContext = null;
    this._logicalWidth = 0;
    this._logicalHeight = 0;
    this._looping = false;
  }

  /* ------------------------------ 画布 ------------------------------ */
  createCanvas(w, h) {
    this._logicalWidth = w;
    this._logicalHeight = h;
    const pd = this._pixelDensity;
    let canvas = this._providedCanvas;
    if (!canvas) {
      canvas = this._createCanvas(Math.round(w * pd), Math.round(h * pd));
    } else {
      canvas.width = Math.round(w * pd);
      canvas.height = Math.round(h * pd);
    }
    this._mainCanvas = canvas;
    this._mainContext = get2d(canvas);
    this._mainContext.scale(pd, pd);
    // p5 的 createCanvas 返回 p5.Renderer，可链式 .parent('id')
    return { parent: () => this._mainCanvas, canvas, drawingContext: this._mainContext };
  }

  pixelDensity(d) {
    if (d === undefined) return this._pixelDensity;
    this._pixelDensity = d;
    return this;
  }

  frameRate() {
    return 30; // 渲染由外部逐帧驱动，帧率只影响交互播放
  }

  createGraphics(w, h) {
    return new Graphics(w, h, this._pixelDensity, this._createCanvas);
  }

  /* ------------------------------ 绘制 ------------------------------ */
  get drawingContext() {
    return this._mainContext;
  }

  get canvas() {
    return this._mainCanvas;
  }

  /**
   * p5 image(img, x, y, [w], [h])：
   * 源为整张 img.canvas（可能是高密度 backing store），目标使用逻辑尺寸。
   */
  image(img, x, y, w, h) {
    const source = img && (img.canvas || img);
    if (!source) return;
    const sw = source.width;
    const sh = source.height;
    if (!sw || !sh) return;
    const dw = w === undefined ? img.width : w;
    const dh = h === undefined ? img.height : h;
    if (dw === 0 || dh === 0) return;
    this._mainContext.drawImage(source, 0, 0, sw, sh, x, y, dw, dh);
  }

  loop() {
    this._looping = true;
  }

  noLoop() {
    this._looping = false;
  }

  /* ------------------------------ 生命周期 ------------------------------ */
  start() {
    if (typeof this.setup === 'function') this.setup();
  }

  remove() {
    if (this._mainCanvas) {
      this._mainCanvas.width = 0;
      this._mainCanvas.height = 0;
    }
    this._mainCanvas = null;
    this._mainContext = null;
  }
}
