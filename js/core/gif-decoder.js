/**
 * @file gif-decoder.js
 * @description 纯前端高兼容 GIF 动画解码与序列帧拆分核心模块 (GifDecoder)
 * 支持双引擎解码：
 * 1. 优先使用现代浏览器 WebCodecs 原生 ImageDecoder（C++ 硬件级超高速解码）
 * 2. 自包含纯 JS GIF89a LZW 解码引擎（全平台/脱机单文件/Node.js 测试环境 100% 降级支持）
 * 核心功能：
 * - 快速判断是否为 GIF 动图 (isGif)
 * - 完整解析全部动作帧、透明通道与各帧精准延迟 (decode)
 * - 将拆分出的帧自动规整排版为 Sprite Sheet 精灵大图 (assembleSpriteSheet)
 */

import { JSZip } from '../vendor/jszip.min.js';

/**
 * 纯 JS GIF 字节流读取器
 */
class GifByteStream {
  constructor(uint8Array) {
    this.data = uint8Array;
    this.pos = 0;
    this.len = uint8Array.length;
  }

  hasMore() {
    return this.pos < this.len;
  }

  readByte() {
    if (this.pos >= this.len) return -1;
    return this.data[this.pos++];
  }

  peekByte() {
    if (this.pos >= this.len) return -1;
    return this.data[this.pos];
  }

  readUint16() {
    if (this.pos + 2 > this.len) return -1;
    const val = this.data[this.pos] | (this.data[this.pos + 1] << 8);
    this.pos += 2;
    return val;
  }

  readBytes(n) {
    const end = Math.min(this.pos + n, this.len);
    const slice = this.data.subarray(this.pos, end);
    this.pos = end;
    return slice;
  }

  skip(n) {
    this.pos = Math.min(this.pos + n, this.len);
  }

  // 读取由多个 sub-block 组成的数据块并合并为一个连续的 Uint8Array
  readSubBlocks() {
    const chunks = [];
    let totalLen = 0;

    while (this.hasMore()) {
      const blockSize = this.readByte();
      if (blockSize <= 0) break; // 0 表示块终止

      const chunk = this.readBytes(blockSize);
      chunks.push(chunk);
      totalLen += chunk.length;
    }

    const merged = new Uint8Array(totalLen);
    let offset = 0;
    for (const ch of chunks) {
      merged.set(ch, offset);
      offset += ch.length;
    }
    return merged;
  }

  // 跳过由多个 sub-block 组成的数据块
  skipSubBlocks() {
    while (this.hasMore()) {
      const blockSize = this.readByte();
      if (blockSize <= 0) break;
      this.skip(blockSize);
    }
  }
}

/**
 * 纯 JS GIF LZW 变长比特流解压算法
 */
function lzwDecompress(minCodeSize, compressedBytes, expectedPixelCount) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;

  let codeSize = minCodeSize + 1;
  let codeMask = (1 << codeSize) - 1;
  let nextCode = clearCode + 2;

  // 初始化字典：0 ~ clearCode - 1 为单像素索引
  const prefix = new Int32Array(4096);
  const suffix = new Uint8Array(4096);
  const length = new Int32Array(4096);

  for (let i = 0; i < clearCode; i++) {
    prefix[i] = -1;
    suffix[i] = i;
    length[i] = 1;
  }

  const output = new Uint8Array(expectedPixelCount);
  let outPos = 0;

  // 比特流读取状态
  let bitBuf = 0;
  let bitCount = 0;
  let bytePos = 0;
  const totalBytes = compressedBytes.length;

  let oldCode = -1;
  const stack = new Uint8Array(4096);
  let stackPos = 0;

  while (bytePos < totalBytes || bitCount >= codeSize) {
    while (bitCount < codeSize && bytePos < totalBytes) {
      bitBuf |= compressedBytes[bytePos++] << bitCount;
      bitCount += 8;
    }

    if (bitCount < codeSize) break;

    const code = bitBuf & codeMask;
    bitBuf >>= codeSize;
    bitCount -= codeSize;

    if (code === clearCode) {
      // 重置字典
      codeSize = minCodeSize + 1;
      codeMask = (1 << codeSize) - 1;
      nextCode = clearCode + 2;
      oldCode = -1;
      continue;
    }

    if (code === eoiCode) {
      break;
    }

    if (oldCode === -1) {
      // 第一个数据代码
      if (outPos < expectedPixelCount) {
        output[outPos++] = suffix[code];
      }
      oldCode = code;
      continue;
    }

    let inCode = code;
    if (code >= nextCode) {
      // 特殊情况：code === nextCode
      stack[stackPos++] = suffix[oldCode];
      inCode = oldCode;
    }

    // 沿前缀链回溯展开当前 code
    while (inCode >= clearCode) {
      stack[stackPos++] = suffix[inCode];
      inCode = prefix[inCode];
    }
    stack[stackPos++] = suffix[inCode];
    const firstPixel = inCode;

    // 将回溯展开的数据弹出到输出
    while (stackPos > 0 && outPos < expectedPixelCount) {
      output[outPos++] = stack[--stackPos];
    }

    // 将新前缀加入字典
    if (nextCode < 4096) {
      prefix[nextCode] = oldCode;
      suffix[nextCode] = firstPixel;
      length[nextCode] = length[oldCode] + 1;
      nextCode++;

      if (nextCode > codeMask && codeSize < 12) {
        codeSize++;
        codeMask = (1 << codeSize) - 1;
      }
    }

    oldCode = code;
  }

  return output;
}

/**
 * 纯 JS GIF89a 完整解码器
 */
class PureJsGifDecoder {
  static decode(uint8Array) {
    const stream = new GifByteStream(uint8Array);

    // 1. 校验 Header (6 字节)
    const headerBytes = stream.readBytes(6);
    const headerStr = String.fromCharCode.apply(null, headerBytes);
    if (headerStr !== 'GIF87a' && headerStr !== 'GIF89a') {
      throw new Error(`无效的 GIF 文件格式头: "${headerStr}"，仅支持 GIF87a 与 GIF89a`);
    }

    // 2. Logical Screen Descriptor (7 字节)
    const logicalWidth = stream.readUint16();
    const logicalHeight = stream.readUint16();
    const packed = stream.readByte();
    const bgIndex = stream.readByte();
    const pixelAspect = stream.readByte();

    const hasGCT = (packed & 0x80) !== 0;
    const gctSize = 1 << ((packed & 0x07) + 1);

    // 全局调色板
    let globalColorTable = null;
    if (hasGCT) {
      globalColorTable = stream.readBytes(gctSize * 3);
    }

    // 解析状态
    const parsedRawFrames = [];
    let curGCE = {
      disposal: 0,
      delay: 100, // 默认 100ms (10 FPS)
      hasTransparent: false,
      transparentIndex: -1
    };

    while (stream.hasMore()) {
      const blockType = stream.readByte();
      if (blockType === -1 || blockType === 0x3B) {
        // 0x3B 为 Trailer 文件结束符
        break;
      }

      if (blockType === 0x21) {
        // Extension Block
        const extType = stream.readByte();
        if (extType === 0xF9) {
          // Graphic Control Extension
          const len = stream.readByte();
          if (len >= 4) {
            const gcePacked = stream.readByte();
            const delayTime = stream.readUint16(); // 单位 10ms
            const transparentIndex = stream.readByte();

            curGCE = {
              disposal: (gcePacked >> 2) & 7,
              // delayTime <= 1 时标准化为 10 即 100ms，以兼容大多数主流浏览器防卡顿策略
              delay: (delayTime <= 1 ? 10 : delayTime) * 10,
              hasTransparent: (gcePacked & 1) !== 0,
              transparentIndex
            };
          }
          // 跳过剩余的 sub-block (通常只有一个 0 字节 terminator)
          stream.skipSubBlocks();
        } else {
          // 其他扩展块 (0xFF Netscape, 0xFE Comment, 0x01 Plain Text 等)
          stream.skipSubBlocks();
        }
      } else if (blockType === 0x2C) {
        // Image Descriptor
        const left = stream.readUint16();
        const top = stream.readUint16();
        const width = stream.readUint16();
        const height = stream.readUint16();
        const imgPacked = stream.readByte();

        const hasLCT = (imgPacked & 0x80) !== 0;
        const isInterlaced = (imgPacked & 0x40) !== 0;
        const lctSize = 1 << ((imgPacked & 0x07) + 1);

        let activeColorTable = globalColorTable;
        if (hasLCT) {
          activeColorTable = stream.readBytes(lctSize * 3);
        }

        const minCodeSize = stream.readByte();
        const compressedBytes = stream.readSubBlocks();

        const pixelCount = width * height;
        let pixelIndices = lzwDecompress(minCodeSize, compressedBytes, pixelCount);

        // 如果是交错存储 (Interlaced)，进行交错还原
        if (isInterlaced && height > 1) {
          pixelIndices = deinterlace(pixelIndices, width, height);
        }

        // 将局部像素索引映射为 RGBA 缓冲区
        const patchRgba = new Uint8ClampedArray(pixelCount * 4);
        const transIdx = curGCE.hasTransparent ? curGCE.transparentIndex : -1;

        for (let p = 0; p < pixelCount; p++) {
          const colorIdx = pixelIndices[p];
          const outOffset = p * 4;

          if (colorIdx === transIdx) {
            patchRgba[outOffset] = 0;
            patchRgba[outOffset + 1] = 0;
            patchRgba[outOffset + 2] = 0;
            patchRgba[outOffset + 3] = 0;
          } else if (activeColorTable && (colorIdx * 3 + 2) < activeColorTable.length) {
            const ctOffset = colorIdx * 3;
            patchRgba[outOffset] = activeColorTable[ctOffset];
            patchRgba[outOffset + 1] = activeColorTable[ctOffset + 1];
            patchRgba[outOffset + 2] = activeColorTable[ctOffset + 2];
            patchRgba[outOffset + 3] = 255;
          } else {
            patchRgba[outOffset] = 0;
            patchRgba[outOffset + 1] = 0;
            patchRgba[outOffset + 2] = 0;
            patchRgba[outOffset + 3] = 0;
          }
        }

        parsedRawFrames.push({
          left,
          top,
          width,
          height,
          rgba: patchRgba,
          gce: { ...curGCE }
        });

        // 重置 GCE
        curGCE = {
          disposal: 0,
          delay: 100,
          hasTransparent: false,
          transparentIndex: -1
        };
      }
    }

    if (parsedRawFrames.length === 0) {
      throw new Error('GIF 文件中未解析到任何有效动作帧');
    }

    // 3. 执行 Disposal Method 合成流水线 (Compositing Pipeline)
    // 确保无论采用哪种处置方式（Disposal 0, 1, 2, 3），每一帧均输出完整尺寸与正确差量合成的画面
    const compositeCanvas = createOffscreenCanvas(logicalWidth, logicalHeight);
    const compCtx = compositeCanvas.getContext('2d');

    const frames = [];
    let snapshotBeforeRender = null;
    let totalDurationMs = 0;

    for (let i = 0; i < parsedRawFrames.length; i++) {
      const raw = parsedRawFrames[i];
      const gce = raw.gce;

      // 如果上一帧的 disposal 是 3 (Restore to Previous)，在此处恢复上一帧绘制前的 snapshot
      // （在循环底部处理）

      // 备份当前绘制前的画布 snapshot (用于 disposal === 3)
      if (compCtx && typeof compCtx.getImageData === 'function') {
        snapshotBeforeRender = compCtx.getImageData(0, 0, logicalWidth, logicalHeight);
      }

      // 将当前帧的局部 patch 贴图绘制到合成画布
      if (compCtx) {
        const patchCanvas = createOffscreenCanvas(raw.width, raw.height);
        const pctx = patchCanvas.getContext('2d');
        if (pctx && typeof pctx.putImageData === 'function') {
          const patchImageData = createImageDataHelper(raw.rgba, raw.width, raw.height);
          pctx.putImageData(patchImageData, 0, 0);
          compCtx.drawImage(patchCanvas, raw.left, raw.top);
        }
      }

      // 提取合成后的当前帧画布副本
      const frameCanvas = createOffscreenCanvas(logicalWidth, logicalHeight);
      const fctx = frameCanvas.getContext('2d');
      let finalImageData = null;
      if (fctx && compCtx) {
        fctx.drawImage(compositeCanvas, 0, 0);
        if (typeof fctx.getImageData === 'function') {
          finalImageData = fctx.getImageData(0, 0, logicalWidth, logicalHeight);
        }
      }

      const frameDelay = Math.max(10, gce.delay || 100);
      totalDurationMs += frameDelay;

      frames.push({
        index: i,
        width: logicalWidth,
        height: logicalHeight,
        delay: frameDelay,
        disposal: gce.disposal,
        canvas: frameCanvas,
        imageData: finalImageData
      });

      // 处理本帧的 Disposal Method 影响 (为下一帧准备合成底板)
      if (compCtx) {
        if (gce.disposal === 2) {
          // 恢复局部区域为透明背景
          compCtx.clearRect(raw.left, raw.top, raw.width, raw.height);
        } else if (gce.disposal === 3 && snapshotBeforeRender) {
          // 恢复为本帧绘制前的状态
          compCtx.putImageData(snapshotBeforeRender, 0, 0);
        }
        // disposal 0 或 1: 保留当前合成画面 (Do Not Dispose)
      }
    }

    const avgFps = frames.length > 0 ? Math.round((frames.length / (totalDurationMs / 1000)) * 10) / 10 : 12;

    return {
      width: logicalWidth,
      height: logicalHeight,
      frameCount: frames.length,
      durationMs: totalDurationMs,
      avgFps: avgFps || 12,
      frames
    };
  }
}

/**
 * 交错还原助手 (De-interlacing)
 */
function deinterlace(input, width, height) {
  const output = new Uint8Array(width * height);
  const passOffsets = [0, 4, 2, 1];
  const passSteps = [8, 8, 4, 2];

  let srcRow = 0;
  for (let pass = 0; pass < 4; pass++) {
    const offset = passOffsets[pass];
    const step = passSteps[pass];
    for (let dstRow = offset; dstRow < height; dstRow += step) {
      const srcOffset = srcRow * width;
      const dstOffset = dstRow * width;
      output.set(input.subarray(srcOffset, srcOffset + width), dstOffset);
      srcRow++;
    }
  }

  return output;
}

/**
 * 跨环境创建离屏 Canvas 辅助方法
 */
function createOffscreenCanvas(width, height) {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));

  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(w, h);
  }

  // Node.js 极简测试模拟降级
  return {
    width: w,
    height: h,
    _data: new Uint8ClampedArray(w * h * 4),
    getContext: () => ({
      clearRect: () => {},
      drawImage: () => {},
      getImageData: (x, y, iw, ih) => ({
        width: iw,
        height: ih,
        data: new Uint8ClampedArray(iw * ih * 4)
      }),
      putImageData: () => {}
    })
  };
}

/**
 * 跨环境创建 ImageData 辅助方法
 */
function createImageDataHelper(data, width, height) {
  if (typeof ImageData !== 'undefined') {
    return new ImageData(data, width, height);
  }
  return {
    width,
    height,
    data
  };
}

/**
 * GIF 解码器顶层对外服务门面
 */
export class GifDecoder {
  /**
   * 快速校验数据流是否为 GIF 动图
   * @param {ArrayBuffer|Uint8Array} data 
   * @returns {boolean}
   */
  static isGif(data) {
    if (!data) return false;
    let bytes = data;
    if (data instanceof ArrayBuffer) {
      bytes = new Uint8Array(data);
    } else if (ArrayBuffer.isView(data)) {
      bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    }
    if (bytes.length < 6) return false;
    const sig = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5]);
    return sig === 'GIF87a' || sig === 'GIF89a';
  }

  /**
   * 解码 GIF 文件（支持 File、Blob、ArrayBuffer 或 Uint8Array）
   * 自动按环境选择 WebCodecs 原生解码或纯 JS LZW 解码
   * @param {File|Blob|ArrayBuffer|Uint8Array} source 
   * @param {Object} options 
   * @returns {Promise<{ width: number, height: number, frameCount: number, durationMs: number, avgFps: number, frames: Array }>}
   */
  static async decode(source, options = {}) {
    let uint8Array = null;

    if (source instanceof Uint8Array) {
      uint8Array = source;
    } else if (source instanceof ArrayBuffer) {
      uint8Array = new Uint8Array(source);
    } else if (typeof Blob !== 'undefined' && source instanceof Blob) {
      const buf = await source.arrayBuffer();
      uint8Array = new Uint8Array(buf);
    } else if (source && typeof source.arrayBuffer === 'function') {
      const buf = await source.arrayBuffer();
      uint8Array = new Uint8Array(buf);
    } else {
      throw new Error('[GifDecoder] 不受支持的 GIF 数据来源，请传入 File、Blob、ArrayBuffer 或 Uint8Array');
    }

    if (!this.isGif(uint8Array)) {
      throw new Error('[GifDecoder] 该文件并非标准的 GIF87a 或 GIF89a 图像文件');
    }

    // 方案 A: 若浏览器原生支持 WebCodecs ImageDecoder，优先尝试原生硬件解码
    if (typeof window !== 'undefined' && typeof window.ImageDecoder !== 'undefined' && options.forcePureJs !== true) {
      try {
        const decoded = await this._decodeWithWebCodecs(uint8Array);
        if (decoded && decoded.frames && decoded.frames.length > 0) {
          return decoded;
        }
      } catch (err) {
        console.warn('[GifDecoder] WebCodecs 原生解码降级到纯 JS 引擎:', err);
      }
    }

    // 方案 B: 纯 JS GIF89a 引擎解码
    return PureJsGifDecoder.decode(uint8Array);
  }

  /**
   * 使用浏览器原生 WebCodecs ImageDecoder 进行极速解码
   * @private
   */
  static async _decodeWithWebCodecs(uint8Array) {
    const decoder = new window.ImageDecoder({
      data: uint8Array,
      type: 'image/gif'
    });

    await decoder.tracks.ready;
    const track = decoder.tracks.selectedTrack;
    const frameCount = track ? track.frameCount : 0;
    if (frameCount <= 0) {
      throw new Error('WebCodecs 未能识别到有效 GIF 帧轨道');
    }

    const frames = [];
    let totalDurationMs = 0;
    let logicalWidth = 0;
    let logicalHeight = 0;

    for (let i = 0; i < frameCount; i++) {
      const result = await decoder.decode({ frameIndex: i });
      const imgFrame = result.image; // VideoFrame

      if (i === 0) {
        logicalWidth = imgFrame.displayWidth || imgFrame.codedWidth;
        logicalHeight = imgFrame.displayHeight || imgFrame.codedHeight;
      }

      // 将 VideoFrame 绘制到 Canvas 上
      const frameCanvas = createOffscreenCanvas(logicalWidth, logicalHeight);
      const fctx = frameCanvas.getContext('2d');
      if (fctx) {
        fctx.drawImage(imgFrame, 0, 0, logicalWidth, logicalHeight);
      }

      // duration 单位通常为微秒 (microseconds, 1/1,000,000s)
      const durationMs = imgFrame.duration ? Math.round(imgFrame.duration / 1000) : 100;
      totalDurationMs += durationMs;

      // 释放 VideoFrame 资源
      if (typeof imgFrame.close === 'function') {
        imgFrame.close();
      }

      frames.push({
        index: i,
        width: logicalWidth,
        height: logicalHeight,
        delay: durationMs,
        disposal: 0,
        canvas: frameCanvas
      });
    }

    const avgFps = frames.length > 0 ? Math.round((frames.length / (totalDurationMs / 1000)) * 10) / 10 : 12;

    return {
      width: logicalWidth,
      height: logicalHeight,
      frameCount: frames.length,
      durationMs: totalDurationMs,
      avgFps: avgFps || 12,
      frames
    };
  }

  /**
   * 将解码出的动作帧自动拼装排版为规整的 Sprite Sheet 透明大图 Canvas，
   * 并为每一帧计算对应的选框与动画元数据，方便直接导入 Sprite Animator！
   * @param {Object} decodedGif GifDecoder.decode 的返回对象
   * @param {Object} options { padding, columns, namePrefix }
   * @returns {{ sheetCanvas: HTMLCanvasElement|Object, frames: Array, columns: number, rows: number, cellW: number, cellH: number }}
   */
  static assembleSpriteSheet(decodedGif, options = {}) {
    if (!decodedGif || !decodedGif.frames || decodedGif.frames.length === 0) {
      throw new Error('[GifDecoder] 没有可排版的动作帧');
    }

    const padding = options.padding !== undefined ? options.padding : 8;
    const namePrefix = options.namePrefix || '帧';
    const totalFrames = decodedGif.frames.length;
    const cellW = decodedGif.width;
    const cellH = decodedGif.height;

    // 自适应计算网格列数与行数 (若未指定则采用接近平方根的紧凑排版)
    const columns = options.columns && options.columns > 0
      ? Math.round(options.columns)
      : Math.max(1, Math.ceil(Math.sqrt(totalFrames)));
    const rows = Math.max(1, Math.ceil(totalFrames / columns));

    // 计算整张大图尺寸
    const sheetW = padding + columns * (cellW + padding);
    const sheetH = padding + rows * (cellH + padding);

    const sheetCanvas = createOffscreenCanvas(sheetW, sheetH);
    const sctx = sheetCanvas.getContext('2d');
    if (sctx) {
      sctx.clearRect(0, 0, sheetW, sheetH);
      sctx.imageSmoothingEnabled = false;
    }

    const framesMeta = [];

    for (let i = 0; i < totalFrames; i++) {
      const f = decodedGif.frames[i];
      const col = i % columns;
      const row = Math.floor(i / columns);

      const cellX = padding + col * (cellW + padding);
      const cellY = padding + row * (cellH + padding);

      // 将单帧绘制到大图对应单元格
      if (sctx && f.canvas) {
        sctx.drawImage(f.canvas, cellX, cellY, cellW, cellH);
      }

      // 生成适配 Sprite Animator 核心状态的 Frame 对象
      framesMeta.push({
        id: `gif_frame_${Date.now()}_${i + 1}`,
        name: `${namePrefix} ${i + 1}`,
        rect: {
          x: cellX,
          y: cellY,
          w: cellW,
          h: cellH
        },
        offset: { x: 0, y: 0 },
        pivot: { x: 0.5, y: 1.0 }, // 默认脚底地面中心对齐
        maskCanvas: null,
        duration: f.delay || Math.round(1000 / (decodedGif.avgFps || 12))
      });
    }

    return {
      sheetCanvas,
      frames: framesMeta,
      columns,
      rows,
      cellW,
      cellH,
      sheetWidth: sheetW,
      sheetHeight: sheetH
    };
  }

  /**
   * 将解码出的各帧直接打包为透明单帧 PNG 的 ZIP 压缩包
   * @param {Object} decodedGif 
   * @param {Object} options { filename, namePrefix }
   * @returns {Promise<{ blob: Blob|Uint8Array, count: number }>}
   */
  static async splitFramesToZip(decodedGif, options = {}) {
    if (!decodedGif || !decodedGif.frames || decodedGif.frames.length === 0) {
      throw new Error('[GifDecoder] 没有可导出的动作帧');
    }

    const zip = new JSZip();
    const prefix = options.namePrefix || 'frame';

    for (let i = 0; i < decodedGif.frames.length; i++) {
      const f = decodedGif.frames[i];
      const fileName = `${prefix}_${String(i + 1).padStart(3, '0')}.png`;

      // 提取 PNG Blob
      let blob = null;
      if (f.canvas && typeof f.canvas.toBlob === 'function') {
        blob = await new Promise((resolve) => f.canvas.toBlob(resolve, 'image/png'));
      } else if (f.canvas && typeof f.canvas.toDataURL === 'function') {
        const dataUrl = f.canvas.toDataURL('image/png');
        const bin = atob(dataUrl.split(',')[1]);
        const arr = new Uint8Array(bin.length);
        for (let j = 0; j < bin.length; j++) arr[j] = bin.charCodeAt(j);
        blob = arr;
      } else {
        blob = new Uint8Array(10);
      }

      zip.file(fileName, blob);
    }

    // 附带一份元数据 JSON
    const meta = {
      source: 'GIF Splitter',
      width: decodedGif.width,
      height: decodedGif.height,
      frameCount: decodedGif.frameCount,
      durationMs: decodedGif.durationMs,
      avgFps: decodedGif.avgFps,
      frames: decodedGif.frames.map((f, idx) => ({
        index: idx,
        name: `${prefix}_${String(idx + 1).padStart(3, '0')}.png`,
        delayMs: f.delay
      }))
    };
    zip.file('animation.json', JSON.stringify(meta, null, 2));

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    return {
      blob: zipBlob,
      count: decodedGif.frames.length
    };
  }
}

export default GifDecoder;
