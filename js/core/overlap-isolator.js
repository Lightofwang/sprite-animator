/**
 * @file overlap-isolator.js
 * @description 交叉消除专属工具集核心模块 (Overlap Isolator)
 * 提供 Frame 独立图层隔离机制、圆形橡皮擦、多边形套索、魔棒 Flood Fill 及 Undo/Redo 历史栈
 */

import { createImageDataObject } from './image-processor.js';

/**
 * 跨环境离屏 Canvas 模拟实现 (用于 Node.js 单元测试与无 DOM 纯计算环境)
 */
class MemoryContext2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.globalCompositeOperation = 'source-over';
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1;
    this.lineCap = 'butt';
    this.lineJoin = 'miter';
    this._path = [];
  }

  save() {
    this._savedState = {
      globalCompositeOperation: this.globalCompositeOperation,
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      lineCap: this.lineCap,
      lineJoin: this.lineJoin
    };
  }

  restore() {
    if (this._savedState) {
      Object.assign(this, this._savedState);
    }
  }

  beginPath() {
    this._path = [];
  }

  moveTo(x, y) {
    this._path.push({ type: 'moveTo', x: Math.round(x), y: Math.round(y) });
  }

  lineTo(x, y) {
    this._path.push({ type: 'lineTo', x: Math.round(x), y: Math.round(y) });
  }

  closePath() {
    this._path.push({ type: 'closePath' });
  }

  arc(cx, cy, radius, startAngle, endAngle) {
    this._path.push({ type: 'arc', cx, cy, radius });
  }

  clearRect(x, y, w, h) {
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const data = this.canvas.data;
    const startX = Math.max(0, Math.floor(x));
    const startY = Math.max(0, Math.floor(y));
    const endX = Math.min(cw, Math.ceil(x + w));
    const endY = Math.min(ch, Math.ceil(y + h));

    for (let py = startY; py < endY; py++) {
      for (let px = startX; px < endX; px++) {
        const off = (py * cw + px) * 4;
        data[off] = 0;
        data[off + 1] = 0;
        data[off + 2] = 0;
        data[off + 3] = 0;
      }
    }
  }

  fillRect(x, y, w, h) {
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const data = this.canvas.data;
    const startX = Math.max(0, Math.floor(x));
    const startY = Math.max(0, Math.floor(y));
    const endX = Math.min(cw, Math.ceil(x + w));
    const endY = Math.min(ch, Math.ceil(y + h));

    for (let py = startY; py < endY; py++) {
      for (let px = startX; px < endX; px++) {
        const off = (py * cw + px) * 4;
        data[off] = 255;
        data[off + 1] = 255;
        data[off + 2] = 255;
        data[off + 3] = 255;
      }
    }
  }

  getImageData(sx, sy, sw, sh) {
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const imgData = createImageDataObject(sw, sh);
    const srcData = this.canvas.data;
    const dstData = imgData.data;

    for (let y = 0; y < sh; y++) {
      const srcY = sy + y;
      if (srcY < 0 || srcY >= ch) continue;
      for (let x = 0; x < sw; x++) {
        const srcX = sx + x;
        if (srcX < 0 || srcX >= cw) continue;

        const srcOff = (srcY * cw + srcX) * 4;
        const dstOff = (y * sw + x) * 4;
        dstData[dstOff] = srcData[srcOff];
        dstData[dstOff + 1] = srcData[srcOff + 1];
        dstData[dstOff + 2] = srcData[srcOff + 2];
        dstData[dstOff + 3] = srcData[srcOff + 3];
      }
    }
    return imgData;
  }

  putImageData(imageData, dx, dy) {
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const sw = imageData.width;
    const sh = imageData.height;
    const srcData = imageData.data;
    const dstData = this.canvas.data;

    for (let y = 0; y < sh; y++) {
      const dstY = dy + y;
      if (dstY < 0 || dstY >= ch) continue;
      for (let x = 0; x < sw; x++) {
        const dstX = dx + x;
        if (dstX < 0 || dstX >= cw) continue;

        const srcOff = (y * sw + x) * 4;
        const dstOff = (dstY * cw + dstX) * 4;
        dstData[dstOff] = srcData[srcOff];
        dstData[dstOff + 1] = srcData[srcOff + 1];
        dstData[dstOff + 2] = srcData[srcOff + 2];
        dstData[dstOff + 3] = srcData[srcOff + 3];
      }
    }
  }

  drawImage(source, ...args) {
    let sx = 0, sy = 0, sw = source.width, sh = source.height;
    let dx = 0, dy = 0, dw = source.width, dh = source.height;

    if (args.length === 2) {
      [dx, dy] = args;
    } else if (args.length === 4) {
      [dx, dy, dw, dh] = args;
    } else if (args.length === 8) {
      [sx, sy, sw, sh, dx, dy, dw, dh] = args;
    }

    let srcPixels = null;
    let srcW = source.width;
    let srcH = source.height;

    if (source.data instanceof Uint8ClampedArray) {
      srcPixels = source.data;
    } else if (typeof source.getContext === 'function') {
      const sCtx = source.getContext('2d');
      if (source.data) {
        srcPixels = source.data;
      } else if (sCtx && typeof sCtx.getImageData === 'function') {
        srcPixels = sCtx.getImageData(0, 0, srcW, srcH).data;
      }
    } else if (source.naturalWidth) {
      srcW = source.naturalWidth;
      srcH = source.naturalHeight;
    }

    const dstData = this.canvas.data;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    for (let y = 0; y < dh; y++) {
      const targetY = dy + y;
      if (targetY < 0 || targetY >= ch) continue;
      const srcSampleY = Math.floor(sy + (y / dh) * sh);
      if (srcSampleY < 0 || srcSampleY >= srcH) continue;

      for (let x = 0; x < dw; x++) {
        const targetX = dx + x;
        if (targetX < 0 || targetX >= cw) continue;
        const srcSampleX = Math.floor(sx + (x / dw) * sw);
        if (srcSampleX < 0 || srcSampleX >= srcW) continue;

        const dstOff = (targetY * cw + targetX) * 4;

        if (srcPixels) {
          const srcOff = (srcSampleY * srcW + srcSampleX) * 4;
          const sr = srcPixels[srcOff];
          const sg = srcPixels[srcOff + 1];
          const sb = srcPixels[srcOff + 2];
          const sa = srcPixels[srcOff + 3];

          if (this.globalCompositeOperation === 'source-in') {
            // source-in: 保留源像素，但受限于目标原有 alpha
            const destA = dstData[dstOff + 3];
            if (destA > 0 && sa > 0) {
              dstData[dstOff] = sr;
              dstData[dstOff + 1] = sg;
              dstData[dstOff + 2] = sb;
              dstData[dstOff + 3] = sa;
            } else {
              dstData[dstOff + 3] = 0;
            }
          } else {
            dstData[dstOff] = sr;
            dstData[dstOff + 1] = sg;
            dstData[dstOff + 2] = sb;
            dstData[dstOff + 3] = sa;
          }
        }
      }
    }
  }

  fill() {
    const arcCmd = this._path.find(p => p.type === 'arc');
    if (arcCmd) {
      const { cx, cy, radius } = arcCmd;
      const r2 = radius * radius;
      const cw = this.canvas.width;
      const ch = this.canvas.height;
      const data = this.canvas.data;

      const minX = Math.max(0, Math.floor(cx - radius));
      const maxX = Math.min(cw - 1, Math.ceil(cx + radius));
      const minY = Math.max(0, Math.floor(cy - radius));
      const maxY = Math.min(ch - 1, Math.ceil(cy + radius));

      for (let py = minY; py <= maxY; py++) {
        const dy = py - cy;
        for (let px = minX; px <= maxX; px++) {
          const dx = px - cx;
          if (dx * dx + dy * dy <= r2) {
            const off = (py * cw + px) * 4;
            if (this.globalCompositeOperation === 'destination-out') {
              data[off + 3] = 0;
            } else {
              data[off] = 255;
              data[off + 1] = 255;
              data[off + 2] = 255;
              data[off + 3] = 255;
            }
          }
        }
      }
      return;
    }

    // 多边形填充
    const points = this._path.filter(p => p.type === 'moveTo' || p.type === 'lineTo');
    if (points.length >= 3) {
      const cw = this.canvas.width;
      const ch = this.canvas.height;
      const data = this.canvas.data;

      for (let py = 0; py < ch; py++) {
        for (let px = 0; px < cw; px++) {
          if (OverlapIsolator.pointInPolygon(px, py, points)) {
            const off = (py * cw + px) * 4;
            if (this.globalCompositeOperation === 'destination-out') {
              data[off + 3] = 0;
            } else {
              data[off] = 255;
              data[off + 1] = 255;
              data[off + 2] = 255;
              data[off + 3] = 255;
            }
          }
        }
      }
    }
  }

  stroke() {
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const data = this.canvas.data;
    const halfWidth = this.lineWidth / 2;
    const r2 = halfWidth * halfWidth;

    let p1 = null;
    for (const cmd of this._path) {
      if (cmd.type === 'moveTo') {
        p1 = cmd;
      } else if (cmd.type === 'lineTo' && p1) {
        const p2 = cmd;
        const minX = Math.max(0, Math.floor(Math.min(p1.x, p2.x) - halfWidth));
        const maxX = Math.min(cw - 1, Math.ceil(Math.max(p1.x, p2.x) + halfWidth));
        const minY = Math.max(0, Math.floor(Math.min(p1.y, p2.y) - halfWidth));
        const maxY = Math.min(ch - 1, Math.ceil(Math.max(p1.y, p2.y) + halfWidth));

        for (let py = minY; py <= maxY; py++) {
          for (let px = minX; px <= maxX; px++) {
            const distSq = OverlapIsolator.distToSegmentSquared(px, py, p1.x, p1.y, p2.x, p2.y);
            if (distSq <= r2) {
              const off = (py * cw + px) * 4;
              if (this.globalCompositeOperation === 'destination-out') {
                data[off + 3] = 0;
              }
            }
          }
        }
        p1 = p2;
      }
    }
  }
}

class MemoryCanvas {
  constructor(width, height) {
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));
    this.data = new Uint8ClampedArray(this.width * this.height * 4);
    this._ctx = new MemoryContext2D(this);
  }

  getContext(type) {
    if (type === '2d') return this._ctx;
    return null;
  }
}

/**
 * 交叉消除与局部选区修整核心类 (OverlapIsolator)
 */
export class OverlapIsolator {
  constructor() {
    // 历史记录最大快照栈深度
    this.maxHistory = 20;

    // 针对每个 Frame 对象的历史记录映射 WeakMap / Map
    this._historyMap = new WeakMap();
  }

  /**
   * 跨平台创建离屏 Canvas 元素
   * @param {number} width 
   * @param {number} height 
   * @returns {HTMLCanvasElement|OffscreenCanvas|MemoryCanvas}
   */
  createCanvas(width, height) {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));

    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const cvs = document.createElement('canvas');
      cvs.width = w;
      cvs.height = h;
      return cvs;
    }

    if (typeof OffscreenCanvas !== 'undefined') {
      return new OffscreenCanvas(w, h);
    }

    return new MemoryCanvas(w, h);
  }

  /**
   * 初始化 Frame 的独立图层 maskCanvas
   * 如果尚未初始化或选框尺寸改变，自动从原图对应矩形区域拷贝初始像素
   * @param {Object} frame Frame 帧对象
   * @param {HTMLImageElement|HTMLCanvasElement|Object} sourceImage 原始大图资源
   * @returns {HTMLCanvasElement|MemoryCanvas}
   */
  initFrameCanvas(frame, sourceImage = null) {
    if (!frame || !frame.rect) {
      throw new Error('[OverlapIsolator.initFrameCanvas] 无效的 frame 帧对象');
    }

    const { x, y, w, h } = frame.rect;
    const targetW = Math.max(1, Math.round(w));
    const targetH = Math.max(1, Math.round(h));

    // 检查是否已有 maskCanvas 且尺寸一致
    if (frame.maskCanvas && frame.maskCanvas.width === targetW && frame.maskCanvas.height === targetH) {
      return frame.maskCanvas;
    }

    // 创建全新离屏 Canvas
    const canvas = this.createCanvas(targetW, targetH);
    const ctx = canvas.getContext('2d');

    // 清空画布
    ctx.clearRect(0, 0, targetW, targetH);

    // 拷贝源图像对应区域像素
    if (sourceImage) {
      try {
        if (typeof ctx.drawImage === 'function') {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(sourceImage, x, y, targetW, targetH, 0, 0, targetW, targetH);
        }
      } catch (err) {
        console.warn('[OverlapIsolator.initFrameCanvas] 从 sourceImage 绘制像素失败:', err);
      }
    }

    // 如果 frame 自带初始 customPixels (ImageData 结构) 则优先写入
    if (frame.customPixels && frame.customPixels.data) {
      try {
        ctx.putImageData(frame.customPixels, 0, 0);
      } catch (e) {
        console.warn('[OverlapIsolator.initFrameCanvas] 应用 customPixels 失败:', e);
      }
    }

    frame.maskCanvas = canvas;
    frame._isModified = false;

    // 重置历史记录栈
    this.clearHistory(frame);

    return canvas;
  }

  /**
   * 获取当前帧修整后的最终 Canvas
   * @param {Object} frame 
   * @param {HTMLImageElement|HTMLCanvasElement|Object} [sourceImage] 
   * @returns {HTMLCanvasElement|MemoryCanvas}
   */
  getFrameCanvas(frame, sourceImage = null) {
    if (!frame) return null;
    if (!frame.maskCanvas || frame.maskCanvas.width !== frame.rect.w || frame.maskCanvas.height !== frame.rect.h) {
      return this.initFrameCanvas(frame, sourceImage);
    }
    return frame.maskCanvas;
  }

  // ================= 撤销/重做历史栈管理 (History Stack) =================

  /**
   * 获取或初始化 Frame 的历史栈
   * @private
   */
  _getHistory(frame) {
    let hist = this._historyMap.get(frame);
    if (!hist) {
      hist = { undoStack: [], redoStack: [] };
      this._historyMap.set(frame, hist);
    }
    return hist;
  }

  /**
   * 在执行笔刷/抠图修改前，保存当前状态快照
   * @param {Object} frame 
   */
  saveSnapshot(frame) {
    if (!frame || !frame.maskCanvas) return;
    const canvas = frame.maskCanvas;
    const ctx = canvas.getContext('2d');
    if (!ctx || typeof ctx.getImageData !== 'function') return;

    try {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // 深拷贝像素缓冲区
      const cloned = createImageDataObject(imgData.width, imgData.height, new Uint8ClampedArray(imgData.data));
      const hist = this._getHistory(frame);
      hist.undoStack.push(cloned);

      if (hist.undoStack.length > this.maxHistory) {
        hist.undoStack.shift();
      }
      // 产生新修改时清空重做栈
      hist.redoStack = [];
    } catch (e) {
      console.warn('[OverlapIsolator.saveSnapshot] 记录历史快照异常:', e);
    }
  }

  /**
   * 执行撤销 (Ctrl+Z)
   * @param {Object} frame 
   * @returns {boolean} 是否成功撤销
   */
  undo(frame) {
    if (!this.canUndo(frame)) return false;
    const canvas = frame.maskCanvas;
    const ctx = canvas.getContext('2d');
    const hist = this._getHistory(frame);

    try {
      // 当前状态保存入 redo 栈
      const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const clonedCurrent = createImageDataObject(current.width, current.height, new Uint8ClampedArray(current.data));
      hist.redoStack.push(clonedCurrent);

      // 弹出最近快照还原
      const prevSnapshot = hist.undoStack.pop();
      ctx.putImageData(prevSnapshot, 0, 0);
      frame._isModified = true;
      return true;
    } catch (e) {
      console.error('[OverlapIsolator.undo] 撤销还原失败:', e);
      return false;
    }
  }

  /**
   * 执行重做 (Ctrl+Y)
   * @param {Object} frame 
   * @returns {boolean} 是否成功重做
   */
  redo(frame) {
    if (!this.canRedo(frame)) return false;
    const canvas = frame.maskCanvas;
    const ctx = canvas.getContext('2d');
    const hist = this._getHistory(frame);

    try {
      // 当前状态保存入 undo 栈
      const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const clonedCurrent = createImageDataObject(current.width, current.height, new Uint8ClampedArray(current.data));
      hist.undoStack.push(clonedCurrent);

      // 弹出最近 redo 快照还原
      const nextSnapshot = hist.redoStack.pop();
      ctx.putImageData(nextSnapshot, 0, 0);
      frame._isModified = true;
      return true;
    } catch (e) {
      console.error('[OverlapIsolator.redo] 重做还原失败:', e);
      return false;
    }
  }

  /**
   * 是否可撤销
   * @param {Object} frame 
   * @returns {boolean}
   */
  canUndo(frame) {
    if (!frame || !frame.maskCanvas) return false;
    return this._getHistory(frame).undoStack.length > 0;
  }

  /**
   * 是否可重做
   * @param {Object} frame 
   * @returns {boolean}
   */
  canRedo(frame) {
    if (!frame || !frame.maskCanvas) return false;
    return this._getHistory(frame).redoStack.length > 0;
  }

  /**
   * 清空历史栈
   * @param {Object} frame 
   */
  clearHistory(frame) {
    if (!frame) return;
    const hist = this._getHistory(frame);
    hist.undoStack = [];
    hist.redoStack = [];
  }

  // ================= 核心工具 1: 橡皮擦 (Eraser) =================

  /**
   * 应用橡皮擦笔刷
   * 在 maskCanvas 上使用 destination-out 擦除像素为完全透明
   * @param {Object} frame 帧对象
   * @param {number} localX 当前局部 X 坐标
   * @param {number} localY 当前局部 Y 坐标
   * @param {number} brushSize 笔刷粗细 (像素直径)
   * @param {number|null} [lastLocalX=null] 上一笔局部 X 坐标 (若有则进行圆头线段插值)
   * @param {number|null} [lastLocalY=null] 上一笔局部 Y 坐标
   */
  applyEraser(frame, localX, localY, brushSize, lastLocalX = null, lastLocalY = null) {
    if (!frame || !frame.maskCanvas) return;
    const canvas = frame.maskCanvas;
    const ctx = canvas.getContext('2d');
    const radius = Math.max(0.5, brushSize / 2);

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 若有上一笔坐标，绘制线段连贯消除断点
    if (
      lastLocalX !== null && lastLocalX !== undefined &&
      lastLocalY !== null && lastLocalY !== undefined
    ) {
      ctx.beginPath();
      ctx.moveTo(lastLocalX, lastLocalY);
      ctx.lineTo(localX, localY);
      ctx.stroke();
    }

    // 并在当前点绘制实心圆形笔触
    ctx.beginPath();
    ctx.arc(localX, localY, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    frame._isModified = true;
  }

  // ================= 核心工具 2: 多边形套索 (Lasso) =================

  /**
   * 应用多边形套索工具
   * 传入多边形顶点数组，将多边形外部（或内部）在 maskCanvas 上清除为完全透明
   * @param {Object} frame 帧对象
   * @param {Array<{x: number, y: number}>} points 局部多边形顶点数组
   * @param {boolean} [keepInside=true] 是否保留内部 (true: 清除外部; false: 清除内部)
   * @returns {boolean} 是否成功执行
   */
  applyPolygonLasso(frame, points, keepInside = true) {
    if (!frame || !frame.maskCanvas || !Array.isArray(points) || points.length < 3) {
      return false;
    }

    const canvas = frame.maskCanvas;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    if (keepInside) {
      // 保留多边形内部，清除外部像素
      // 使用离屏蒙版以 source-in 提取多边形内部，并写回当前 Canvas
      const maskCanvas = this.createCanvas(w, h);
      const mctx = maskCanvas.getContext('2d');

      mctx.clearRect(0, 0, w, h);
      mctx.fillStyle = '#000000';
      mctx.beginPath();
      mctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        mctx.lineTo(points[i].x, points[i].y);
      }
      mctx.closePath();
      mctx.fill();

      // 合成原图像素
      mctx.globalCompositeOperation = 'source-in';
      mctx.drawImage(canvas, 0, 0);

      // 写回目标 Canvas
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(maskCanvas, 0, 0);
    } else {
      // 清除多边形内部像素，保留外部
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    frame._isModified = true;
    return true;
  }

  // ================= 核心工具 3: 魔棒 Flood Fill (Magic Wand) =================

  /**
   * 应用魔棒去色工具
   * 在当前帧局部像素矩阵中，使用泛洪填充（Flood Fill）算法将目标色块及其相近颜色区域擦除为透明
   * @param {Object} frame 帧对象
   * @param {number} startX 点击起点局部 X 坐标
   * @param {number} startY 点击起点局部 Y 坐标
   * @param {number} [tolerance=20] 颜色容差 (0~255)
   * @param {boolean} [contiguous=true] 是否仅清除相连区域 (true: 泛洪填充; false: 全图去色)
   * @returns {boolean} 是否修改了像素
   */
  applyMagicWand(frame, startX, startY, tolerance = 20, contiguous = true) {
    if (!frame || !frame.maskCanvas) return false;
    const canvas = frame.maskCanvas;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    const sx = Math.floor(startX);
    const sy = Math.floor(startY);
    if (sx < 0 || sx >= w || sy < 0 || sy >= h) return false;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const startOff = (sy * w + sx) * 4;
    const r0 = data[startOff];
    const g0 = data[startOff + 1];
    const b0 = data[startOff + 2];
    const a0 = data[startOff + 3];

    // 若起点本身已是完全透明，无需处理
    if (a0 === 0) return false;

    const tol = Math.max(0, Math.min(255, Number(tolerance) || 0));

    // 颜色相似性判定 (切比雪夫距离)
    const isMatch = (pixelIndex) => {
      const off = pixelIndex * 4;
      const a = data[off + 3];
      if (a === 0) return false; // 已经是透明的无需再次处理

      const r = data[off];
      const g = data[off + 1];
      const b = data[off + 2];

      return Math.max(Math.abs(r - r0), Math.abs(g - g0), Math.abs(b - b0)) <= tol;
    };

    if (contiguous) {
      // 连续泛洪填充 (基于定长指针队列优化)
      const totalPixels = w * h;
      const visited = new Uint8Array(totalPixels);
      const queue = new Int32Array(totalPixels);
      let head = 0;
      let tail = 0;

      const startIdx = sy * w + sx;
      visited[startIdx] = 1;
      queue[tail++] = startIdx;

      while (head < tail) {
        const curr = queue[head++];
        const off = curr * 4;
        data[off + 3] = 0; // 擦除为完全透明

        const cx = curr % w;
        const cy = (curr / w) | 0;

        // 4-邻域展开
        if (cx > 0) {
          const left = curr - 1;
          if (!visited[left]) {
            visited[left] = 1;
            if (isMatch(left)) queue[tail++] = left;
          }
        }
        if (cx < w - 1) {
          const right = curr + 1;
          if (!visited[right]) {
            visited[right] = 1;
            if (isMatch(right)) queue[tail++] = right;
          }
        }
        if (cy > 0) {
          const top = curr - w;
          if (!visited[top]) {
            visited[top] = 1;
            if (isMatch(top)) queue[tail++] = top;
          }
        }
        if (cy < h - 1) {
          const bottom = curr + w;
          if (!visited[bottom]) {
            visited[bottom] = 1;
            if (isMatch(bottom)) queue[tail++] = bottom;
          }
        }
      }
    } else {
      // 非连续全局相似色块清除
      const totalPixels = w * h;
      for (let i = 0; i < totalPixels; i++) {
        if (isMatch(i)) {
          data[i * 4 + 3] = 0;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    frame._isModified = true;
    return true;
  }

  // ================= 几何与数学静态辅助方法 =================

  /**
   * 判断点 (px, py) 是否在多边形内部 (Ray-Casting 射线法)
   * @param {number} px 
   * @param {number} py 
   * @param {Array<{x: number, y: number}>} points 
   * @returns {boolean}
   */
  static pointInPolygon(px, py, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x, yi = points[i].y;
      const xj = points[j].x, yj = points[j].y;
      const intersect = ((yi > py) !== (yj > py)) &&
        (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * 计算点到线段的最短距离平方
   * @param {number} px 
   * @param {number} py 
   * @param {number} x1 
   * @param {number} y1 
   * @param {number} x2 
   * @param {number} y2 
   * @returns {number}
   */
  static distToSegmentSquared(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return (px - x1) * (px - x1) + (py - y1) * (py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * (x2 - x1);
    const projY = y1 + t * (y2 - y1);
    return (px - projX) * (px - projX) + (py - projY) * (py - projY);
  }
}

// 导出单例实例与类
export const overlapIsolator = new OverlapIsolator();
export default overlapIsolator;
