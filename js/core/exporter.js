/**
 * @file exporter.js
 * @description 多格式导出核心模块 (Exporter)
 * 支持 3 大导出功能：
 * 1. exportFramesAsZip: 透明 PNG 序列帧 Zip 压缩包（包含 animation.json 元数据）
 * 2. exportNewSpriteSheet: 重新规整排版无交叉的新 Sprite Sheet 透明大图（带 16px 安全间距）
 * 3. exportAnimationAsGif: 纯前端基于帧 pivot 与 offset 渲染的透明动画 GIF
 */

import { JSZip } from '../vendor/jszip.min.js';
import { GIFEncoder } from '../vendor/gifshot.min.js';

export class Exporter {
  /**
   * 创建离屏 Canvas
   * @param {number} width 
   * @param {number} height 
   * @returns {HTMLCanvasElement|Object}
   */
  static createCanvas(width, height) {
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      return canvas;
    }
    if (typeof OffscreenCanvas !== 'undefined') {
      return new OffscreenCanvas(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
    }
    // Node.js 极简模拟降级支持
    return {
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
      getContext: () => ({
        clearRect: () => {},
        drawImage: () => {},
        fillRect: () => {},
        getImageData: (x, y, w, h) => ({
          width: w,
          height: h,
          data: new Uint8ClampedArray(w * h * 4)
        })
      }),
      toBlob: (cb) => {
        if (typeof Blob !== 'undefined') {
          cb(new Blob([new Uint8Array(10)], { type: 'image/png' }));
        } else {
          cb(new Uint8Array(10));
        }
      }
    };
  }

  /**
   * 将 Canvas 转换为 PNG Blob (Promise 封装)
   * @param {HTMLCanvasElement} canvas 
   * @returns {Promise<Blob|Uint8Array>}
   */
  static canvasToBlob(canvas) {
    return new Promise((resolve) => {
      if (typeof canvas.toBlob === 'function') {
        canvas.toBlob((blob) => {
          resolve(blob || new Uint8Array(0));
        }, 'image/png');
      } else if (typeof canvas.toDataURL === 'function') {
        const dataUrl = canvas.toDataURL('image/png');
        const bin = atob(dataUrl.split(',')[1]);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        if (typeof Blob !== 'undefined') {
          resolve(new Blob([arr], { type: 'image/png' }));
        } else {
          resolve(arr);
        }
      } else {
        if (typeof Blob !== 'undefined') {
          resolve(new Blob([new Uint8Array(0)], { type: 'image/png' }));
        } else {
          resolve(new Uint8Array(0));
        }
      }
    });
  }

  /**
   * 触发浏览器下载 Blob 文件
   * @param {Blob|Uint8Array} blob 
   * @param {string} filename 
   */
  static downloadBlob(blob, filename) {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }
    try {
      const url = URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 150);
    } catch (e) {
      console.warn('[Exporter] downloadBlob 触发下载失败:', e);
    }
  }

  /**
   * 将单帧内容完整绘制到指定上下文
   * @param {CanvasRenderingContext2D} ctx 
   * @param {Object} frame 
   * @param {number} dx 
   * @param {number} dy 
   * @param {number} dw 
   * @param {number} dh 
   * @param {HTMLImageElement|CanvasImageSource} sourceImage 
   */
  static drawFrameToContext(ctx, frame, dx, dy, dw, dh, sourceImage) {
    if (!ctx || !frame) return;
    const fw = frame.rect?.w || dw;
    const fh = frame.rect?.h || dh;

    // 优先使用已擦除修整交叉的 maskCanvas
    if (frame.maskCanvas) {
      ctx.drawImage(frame.maskCanvas, 0, 0, fw, fh, dx, dy, dw, dh);
    } else if (sourceImage && frame.rect) {
      ctx.drawImage(
        sourceImage,
        frame.rect.x, frame.rect.y, frame.rect.w, frame.rect.h,
        dx, dy, dw, dh
      );
    }
  }

  /**
   * 计算重新规整排版的新 Sprite Sheet 网格坐标与整体尺寸
   * 确保单元格之间有安全间隔 (默认 padding = 16px)，绝对没有交叉重叠
   * @param {Array<Object>} frames 
   * @param {Object} options { padding, columns, alignment }
   * @returns {{ width: number, height: number, columns: number, rows: number, cellW: number, cellH: number, padding: number, items: Array }}
   */
  static calculateSpriteSheetLayout(frames, options = {}) {
    if (!frames || frames.length === 0) {
      return {
        width: 0,
        height: 0,
        columns: 0,
        rows: 0,
        cellW: 0,
        cellH: 0,
        padding: options.padding ?? 16,
        items: []
      };
    }

    const padding = options.padding !== undefined ? options.padding : 16;
    const alignment = options.alignment || 'center'; // 'center' 或 'bottom-center'

    // 计算所有动作帧的最大宽度和最大高度作为规整单元格尺寸
    let maxW = 1;
    let maxH = 1;
    let minLeft = Infinity;
    let maxRight = -Infinity;
    let minTop = Infinity;
    let maxBottom = -Infinity;

    for (const frame of frames) {
      if (frame.rect) {
        const fw = frame.rect.w || 1;
        const fh = frame.rect.h || 1;
        if (fw > maxW) maxW = fw;
        if (fh > maxH) maxH = fh;

        const px = (frame.pivot && typeof frame.pivot.x === 'number') ? frame.pivot.x : 0.5;
        const py = (frame.pivot && typeof frame.pivot.y === 'number') ? frame.pivot.y : 1.0;
        const ox = (frame.offset && typeof frame.offset.x === 'number') ? frame.offset.x : 0;
        const oy = (frame.offset && typeof frame.offset.y === 'number') ? frame.offset.y : 0;

        const l = ox - fw * px;
        const r = ox + fw * (1 - px);
        const t = oy - fh * py;
        const b = oy + fh * (1 - py);
        if (l < minLeft) minLeft = l;
        if (r > maxRight) maxRight = r;
        if (t < minTop) minTop = t;
        if (b > maxBottom) maxBottom = b;
      }
    }

    const useUnionBounds = Boolean(options.expandForOffset && isFinite(minLeft) && isFinite(maxRight));
    const cellW = useUnionBounds
      ? Math.max(Math.round(maxW), Math.ceil(maxRight - minLeft))
      : Math.max(1, Math.round(maxW));
    const cellH = useUnionBounds
      ? Math.max(Math.round(maxH), Math.ceil(maxBottom - minTop))
      : Math.max(1, Math.round(maxH));

    // 计算网格列数与行数 (若未指定 columns 则自适应平方根排版)
    const columns = options.columns && options.columns > 0
      ? Math.round(options.columns)
      : Math.max(1, Math.ceil(Math.sqrt(frames.length)));
    const rows = Math.max(1, Math.ceil(frames.length / columns));

    // 计算总画布尺寸：每列间隔 padding，外围也保留 padding
    // 宽度 = padding + columns * (cellW + padding)
    // 高度 = padding + rows * (cellH + padding)
    const sheetWidth = padding + columns * (cellW + padding);
    const sheetHeight = padding + rows * (cellH + padding);

    const items = [];
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const col = i % columns;
      const row = Math.floor(i / columns);

      // 当前单元格内部坐标 (扣除 padding)
      const cellX = padding + col * (cellW + padding);
      const cellY = padding + row * (cellH + padding);

      const fw = frame.rect?.w || cellW;
      const fh = frame.rect?.h || cellH;

      let destX = cellX + Math.round((cellW - fw) / 2);
      let destY = cellY + Math.round((cellH - fh) / 2);

      if (useUnionBounds) {
        const px = (frame.pivot && typeof frame.pivot.x === 'number') ? frame.pivot.x : 0.5;
        const py = (frame.pivot && typeof frame.pivot.y === 'number') ? frame.pivot.y : 1.0;
        const ox = (frame.offset && typeof frame.offset.x === 'number') ? frame.offset.x : 0;
        const oy = (frame.offset && typeof frame.offset.y === 'number') ? frame.offset.y : 0;
        destX = cellX + Math.round(-minLeft + ox - fw * px);
        destY = cellY + Math.round(-minTop + oy - fh * py);
      } else if (alignment === 'bottom-center') {
        destX = cellX + Math.round((cellW - fw) / 2);
        destY = cellY + (cellH - fh);
      }

      items.push({
        index: i,
        frame,
        col,
        row,
        cellX,
        cellY,
        cellW,
        cellH,
        x: destX,
        y: destY,
        w: fw,
        h: fh,
        offsetIncluded: useUnionBounds
      });
    }

    return {
      width: sheetWidth,
      height: sheetHeight,
      columns,
      rows,
      cellW,
      cellH,
      padding,
      items
    };
  }

  // =========================================================================
  // 1. 导出透明 PNG 序列帧 ZIP 压缩包 (exportFramesAsZip)
  // =========================================================================

  /**
   * 将全部修复后的动作帧提取为透明 PNG 并压缩打包为 ZIP 文件下载
   * 同时生成包含 fps, pivot, offset, rect 元数据的 animation.json
   * @param {Array<Object>} frames 
   * @param {Object} options { sourceImage, fps, name, filename, onProgress, download }
   * @returns {Promise<{ success: boolean, count: number, blob: Blob|Uint8Array, json: Object, error?: string }>}
   */
  static async exportFramesAsZip(frames, options = {}) {
    // 1. 安全拦截：空帧保护
    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      return {
        success: false,
        count: 0,
        error: '没有可导出的动作帧，请先导入图片并框选动作角色。'
      };
    }

    const fps = options.fps || 12;
    const animName = options.name || 'sprite_animation';
    const filename = options.filename || `${animName}_frames.zip`;
    const sourceImage = options.sourceImage || null;
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};

    try {
      onProgress(0, frames.length, '正在初始化 ZIP 打包引擎...');
      const zip = new JSZip();
      const framesMeta = [];

      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const fw = Math.max(1, frame.rect?.w || 32);
        const fh = Math.max(1, frame.rect?.h || 32);

        // 创建单帧透明 Canvas 并渲染修复及对齐偏移后的帧
        const singleCanvas = this.createCanvas(fw, fh);
        const ctx = singleCanvas.getContext('2d');
        const ox = (options.bakeOffset !== false && frame.offset) ? (frame.offset.x || 0) : 0;
        const oy = (options.bakeOffset !== false && frame.offset) ? (frame.offset.y || 0) : 0;
        if (ctx) {
          ctx.clearRect(0, 0, fw, fh);
          this.drawFrameToContext(ctx, frame, ox, oy, fw, fh, sourceImage);
        }

        // 提取透明 PNG Blob
        const pngBlob = await this.canvasToBlob(singleCanvas);
        const frameFileName = `frame_${String(i + 1).padStart(3, '0')}.png`;

        zip.file(frameFileName, pngBlob);

        // 记录结构化元数据
        framesMeta.push({
          name: frameFileName,
          index: i,
          title: frame.name || `帧 ${i + 1}`,
          rect: {
            x: frame.rect?.x || 0,
            y: frame.rect?.y || 0,
            w: fw,
            h: fh
          },
          offset: {
            x: frame.offset?.x || 0,
            y: frame.offset?.y || 0
          },
          pivot: {
            x: frame.pivot?.x ?? 0.5,
            y: frame.pivot?.y ?? 1.0
          },
          duration: frame.duration || Math.round(1000 / fps)
        });

        onProgress(i + 1, frames.length, `正在导出单帧透明 PNG (${i + 1} / ${frames.length})...`);
      }

      // 生成包含完整元数据的 animation.json
      const animJson = {
        name: animName,
        fps,
        totalFrames: frames.length,
        frameDurationMs: Math.round(1000 / fps),
        exportedAt: new Date().toISOString(),
        frames: framesMeta
      };

      zip.file('animation.json', JSON.stringify(animJson, null, 2));

      onProgress(frames.length, frames.length, '正在生成并压缩 ZIP 文件...');
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // 触发浏览器下载
      if (options.download !== false) {
        this.downloadBlob(zipBlob, filename);
      }

      return {
        success: true,
        count: frames.length,
        blob: zipBlob,
        json: animJson
      };
    } catch (err) {
      console.error('[Exporter] exportFramesAsZip 失败:', err);
      return {
        success: false,
        count: 0,
        error: `导出 ZIP 失败: ${err.message}`
      };
    }
  }

  // =========================================================================
  // 2. 导出重新规整排版无交叉的新 Sprite Sheet (exportNewSpriteSheet)
  // =========================================================================

  /**
   * 将所有修复后的动作帧重新规整排版为绝无交叉重叠的透明新大图 (PNG)
   * 采用统一单元格 + 16px 安全外围隔离护城河，并自动烘焙每帧的 offset 对齐偏移
   * @param {Array<Object>} frames 
   * @param {Object} options { sourceImage, padding, columns, filename, alignment, bakeOffset, download }
   * @returns {Promise<{ success: boolean, count: number, blob: Blob|Uint8Array, canvas: HTMLCanvasElement, layout: Object, error?: string }>}
   */
  static async exportNewSpriteSheet(frames, options = {}) {
    // 1. 安全拦截：空帧保护
    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      return {
        success: false,
        count: 0,
        error: '没有可导出的动作帧，请先导入图片并框选动作角色。'
      };
    }

    const filename = options.filename || 'spritesheet_clean.png';
    const sourceImage = options.sourceImage || null;

    try {
      // 2. 计算规整排版网格与坐标
      const layout = this.calculateSpriteSheetLayout(frames, options);

      // 3. 创建大图透明画布
      const sheetCanvas = this.createCanvas(layout.width, layout.height);
      const ctx = sheetCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, layout.width, layout.height);
        ctx.imageSmoothingEnabled = false;

        // 4. 将每一帧严格按无交叉目标坐标（烘焙 offset 对齐偏移）绘制到新大图
        for (const item of layout.items) {
          const ox = (!item.offsetIncluded && options.bakeOffset !== false && item.frame?.offset) ? (item.frame.offset.x || 0) : 0;
          const oy = (!item.offsetIncluded && options.bakeOffset !== false && item.frame?.offset) ? (item.frame.offset.y || 0) : 0;

          if (typeof ctx.save === 'function' && typeof ctx.clip === 'function') {
            ctx.save();
            ctx.beginPath();
            ctx.rect(item.cellX, item.cellY, item.cellW, item.cellH);
            ctx.clip();
            this.drawFrameToContext(
              ctx,
              item.frame,
              item.x + ox,
              item.y + oy,
              item.w,
              item.h,
              sourceImage
            );
            ctx.restore();
          } else {
            this.drawFrameToContext(
              ctx,
              item.frame,
              item.x + ox,
              item.y + oy,
              item.w,
              item.h,
              sourceImage
            );
          }
        }
      }

      // 5. 导出透明大图 PNG Blob
      const sheetBlob = await this.canvasToBlob(sheetCanvas);

      // 6. 触发浏览器文件下载
      if (options.download !== false) {
        this.downloadBlob(sheetBlob, filename);
      }

      return {
        success: true,
        count: frames.length,
        blob: sheetBlob,
        canvas: sheetCanvas,
        layout
      };
    } catch (err) {
      console.error('[Exporter] exportNewSpriteSheet 失败:', err);
      return {
        success: false,
        count: 0,
        error: `导出新精灵表失败: ${err.message}`
      };
    }
  }

  // =========================================================================
  // 3. 导出透明动画动图 (exportAnimationAsGif)
  // =========================================================================

  /**
   * 逐帧在固定视口中按帧的 pivot 与 offset 渲染画面并编码生成动图 GIF
   * @param {Array<Object>} frames 
   * @param {Object} options { sourceImage, fps, width, height, loop, filename, onProgress, download }
   * @param {Object} playerState 
   * @returns {Promise<{ success: boolean, count: number, blob: Blob|Uint8Array, fps: number, error?: string }>}
   */
  static async exportAnimationAsGif(frames, options = {}, playerState = {}) {
    // 1. 安全拦截：空帧保护
    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      return {
        success: false,
        count: 0,
        error: '没有可导出的动作帧，请先导入图片并框选动作角色。'
      };
    }

    // 2. 计算所有帧在基准锚点对齐下的完整包围盒 (Boundings)
    let minLeft = Infinity;
    let maxRight = -Infinity;
    let minTop = Infinity;
    let maxBottom = -Infinity;

    frames.forEach(frame => {
      const fw = frame.rect?.w || 32;
      const fh = frame.rect?.h || 32;
      const px = (frame.pivot && typeof frame.pivot.x === 'number') ? frame.pivot.x : 0.5;
      const py = (frame.pivot && typeof frame.pivot.y === 'number') ? frame.pivot.y : 1.0;
      const ox = (frame.offset && frame.offset.x) || 0;
      const oy = (frame.offset && frame.offset.y) || 0;

      const l = ox - fw * px;
      const r = ox + fw * (1 - px);
      const t = oy - fh * py;
      const b = oy + fh * (1 - py);

      if (l < minLeft) minLeft = l;
      if (r > maxRight) maxRight = r;
      if (t < minTop) minTop = t;
      if (b > maxBottom) maxBottom = b;
    });

    const contentW = Math.max(16, maxRight - minLeft);
    const contentH = Math.max(16, maxBottom - minTop);

    // 安全留白边距 (保证武器刃尖与羽毛不贴边)
    const padding = 16;
    const rawTotalW = Math.ceil(contentW + padding * 2);
    const rawTotalH = Math.ceil(contentH + padding * 2);

    let width = options.width ? Math.max(32, options.width) : null;
    let height = options.height ? Math.max(32, options.height) : null;
    let scale = 1.0;

    if (width && height) {
      // 若外部显式指定了宽高 (例如测试用例或固定视口)
      // 计算自适应缩放比，确保整个人物和动作 100% 容纳在视口内部，绝不被裁切
      const availW = Math.max(16, width - padding * 2);
      const availH = Math.max(16, height - padding * 2);
      scale = Math.min(availW / contentW, availH / contentH);
    } else {
      // 默认根据全部动作帧包围盒自适应计算最佳尺寸 (上限 512px，兼顾高清与快速编码)
      const maxDim = 512;
      scale = Math.min(1.0, maxDim / Math.max(rawTotalW, rawTotalH));
      width = Math.round(rawTotalW * scale);
      height = Math.round(rawTotalH * scale);
    }

    // 确保宽高为偶数 (提升各平台 GIF 播放器兼容性)
    width = (width % 2 !== 0) ? width + 1 : width;
    height = (height % 2 !== 0) ? height + 1 : height;

    // 计算基准点渲染坐标 (使所有动作帧在画布中央统一基准对齐)
    const targetBaseX = Math.round((width / 2) - ((minLeft + maxRight) / 2) * scale);
    const targetBaseY = Math.round((height / 2) - ((minTop + maxBottom) / 2) * scale);

    const fps = options.fps || playerState?.fps || 12;
    const delayMs = Math.round(1000 / fps);
    const loop = options.loop !== undefined ? options.loop : 0;
    const filename = options.filename || 'animation.gif';
    const sourceImage = options.sourceImage || null;
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};

    try {
      onProgress(0, frames.length, '正在初始化 GIF 动画编码器...');
      const encoder = new GIFEncoder(width, height, { loop });

      // 单帧离屏渲染画布
      const frameCanvas = this.createCanvas(width, height);
      const fctx = frameCanvas.getContext('2d');

      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        if (fctx) {
          fctx.clearRect(0, 0, width, height);
          fctx.imageSmoothingEnabled = false;

          const fw = frame.rect?.w || 32;
          const fh = frame.rect?.h || 32;
          const px = (frame.pivot && typeof frame.pivot.x === 'number') ? frame.pivot.x : 0.5;
          const py = (frame.pivot && typeof frame.pivot.y === 'number') ? frame.pivot.y : 1.0;
          const ox = (frame.offset && frame.offset.x) || 0;
          const oy = (frame.offset && frame.offset.y) || 0;

          // 计算世界左上角对齐绘制点与缩放宽高
          const dx = Math.round(targetBaseX + (ox - fw * px) * scale);
          const dy = Math.round(targetBaseY + (oy - fh * py) * scale);
          const dw = Math.round(fw * scale);
          const dh = Math.round(fh * scale);

          this.drawFrameToContext(fctx, frame, dx, dy, dw, dh, sourceImage);

          // 传入当前帧数据
          const imgData = fctx.getImageData(0, 0, width, height);
          encoder.addFrame(imgData, delayMs);
        }

        onProgress(i + 1, frames.length, `正在渲染动图视口第 ${i + 1} 帧...`);
      }

      onProgress(frames.length, frames.length, '正在生成 256 色全局调色板并进行 LZW 压缩编码...');
      const gifBlob = encoder.toBlob();

      // 触发下载
      if (options.download !== false) {
        this.downloadBlob(gifBlob, filename);
      }

      return {
        success: true,
        count: frames.length,
        blob: gifBlob,
        fps,
        width,
        height
      };
    } catch (err) {
      console.error('[Exporter] exportAnimationAsGif 失败:', err);
      return {
        success: false,
        count: 0,
        error: `导出 GIF 动图失败: ${err.message}`
      };
    }
  }
}

export default Exporter;
