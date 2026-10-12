/**
 * @file image-processor.js
 * @description 图像导入、背景透明化与连通域包围盒自动识别算法核心模块
 */

/**
 * 辅助将各种颜色格式转换为标准 RGB 对象 { r, g, b }
 * @param {Object|Array|string} color 
 * @returns {{ r: number, g: number, b: number }}
 */
export function parseColor(color) {
  if (!color) {
    return { r: 255, g: 255, b: 255 };
  }

  // 对象格式 { r, g, b }
  if (typeof color === 'object' && !Array.isArray(color)) {
    return {
      r: Number(color.r ?? 0),
      g: Number(color.g ?? 0),
      b: Number(color.b ?? 0)
    };
  }

  // 数组格式 [r, g, b]
  if (Array.isArray(color)) {
    return {
      r: Number(color[0] ?? 0),
      g: Number(color[1] ?? 0),
      b: Number(color[2] ?? 0)
    };
  }

  // 十六进制颜色字符串, 如 "#ffffff" 或 "#fff"
  if (typeof color === 'string') {
    const hex = color.replace(/^#/, '').trim();
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16)
      };
    } else if (hex.length >= 6) {
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16)
      };
    }
  }

  return { r: 255, g: 255, b: 255 };
}

/**
 * 跨环境（Node.js / 浏览器）创建简易 ImageData 结构或原生 ImageData
 * @param {number} width 
 * @param {number} height 
 * @param {Uint8ClampedArray|null} data 
 * @returns {ImageData|{ width: number, height: number, data: Uint8ClampedArray }}
 */
export function createImageDataObject(width, height, data = null) {
  const pixelData = data || new Uint8ClampedArray(width * height * 4);
  if (typeof ImageData !== 'undefined') {
    return new ImageData(pixelData, width, height);
  }
  return {
    width,
    height,
    data: pixelData
  };
}

export class ImageProcessor {
  /**
   * 将指定纯色（如白色或绿幕）在容差内转为 Alpha = 0 透明通道，保留非背景色
   * @param {ImageData|Object} imageData 具有 width, height, data (Uint8ClampedArray) 的图像数据
   * @param {Object|Array|string} [targetColor={ r: 255, g: 255, b: 255 }] 目标背景色
   * @param {number} [tolerance=20] 容差值 (0~255)
   * @returns {ImageData|Object} 就地修改并返回的 imageData
   */
  static removeColorBackground(imageData, targetColor = { r: 255, g: 255, b: 255 }, tolerance = 20) {
    if (!imageData || !imageData.data) {
      throw new Error('[ImageProcessor.removeColorBackground] 无效的 imageData 输入');
    }

    const target = parseColor(targetColor);
    const tol = Math.max(0, Math.min(255, Number(tolerance) || 0));
    const data = imageData.data;
    const totalPixels = imageData.width * imageData.height;

    const tr = target.r;
    const tg = target.g;
    const tb = target.b;

    for (let i = 0; i < totalPixels; i++) {
      const offset = i * 4;
      const a = data[offset + 3];

      // 若已经透明则跳过
      if (a === 0) continue;

      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];

      const dr = Math.abs(r - tr);
      const dg = Math.abs(g - tg);
      const db = Math.abs(b - tb);

      // 切比雪夫颜色距离（RGB 各通道最大差值在容差以内）
      if (Math.max(dr, dg, db) <= tol) {
        data[offset + 3] = 0;
      }
    }

    return imageData;
  }

  /**
   * 在具有 Alpha 通道的 ImageData 像素矩阵中提取独立精灵帧的外接矩形
   * 使用连通域分析 (CCL) 并按 mergeDistance 合并相邻过近连通块，过滤小于 minSize 的噪声孤岛
   * @param {ImageData|Object} imageData
   * @param {number} [minSize=8] 最小尺寸阈值（过滤过小噪声孤岛）
   * @param {number} [mergeDistance=4] 相邻连通块合并间距阈值
   * @param {number} [alphaThreshold=10] 透明度判定阈值 (0~255)
   * @returns {Array<{ x: number, y: number, width: number, height: number }>}
   */
  static detectBoundingBoxes(imageData, minSize = 8, mergeDistance = 4, alphaThreshold = 10) {
    if (!imageData || !imageData.data || imageData.width <= 0 || imageData.height <= 0) {
      return [];
    }

    const { width: W, height: H, data } = imageData;
    const visited = new Uint8Array(W * H);
    const rawBoxes = [];

    // 8-邻域偏移量
    const dxs = [-1, 0, 1, -1, 1, -1, 0, 1];
    const dys = [-1, -1, -1, 0, 0, 1, 1, 1];

    // BFS 遍历队列（预分配足够容量避免频繁创建对象）
    let queueCapacity = 16384;
    let queueX = new Int32Array(queueCapacity);
    let queueY = new Int32Array(queueCapacity);

    for (let y = 0; y < H; y++) {
      const yOffset = y * W;
      for (let x = 0; x < W; x++) {
        const idx = yOffset + x;
        if (visited[idx] !== 0) continue;

        const a = data[idx * 4 + 3];
        if (a <= alphaThreshold) {
          visited[idx] = 1;
          continue;
        }

        // 发现未访问的非透明像素，开启连通域 BFS
        visited[idx] = 1;
        let head = 0;
        let tail = 0;

        queueX[tail] = x;
        queueY[tail] = y;
        tail++;

        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;
        let pixelCount = 0;

        while (head < tail) {
          const cx = queueX[head];
          const cy = queueY[head];
          head++;
          pixelCount++;

          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          for (let d = 0; d < 8; d++) {
            const nx = cx + dxs[d];
            const ny = cy + dys[d];

            if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
              const nIdx = ny * W + nx;
              if (visited[nIdx] === 0) {
                visited[nIdx] = 1;
                const na = data[nIdx * 4 + 3];
                if (na > alphaThreshold) {
                  // 动态扩容队列
                  if (tail >= queueCapacity) {
                    queueCapacity *= 2;
                    const newQx = new Int32Array(queueCapacity);
                    const newQy = new Int32Array(queueCapacity);
                    newQx.set(queueX);
                    newQy.set(queueY);
                    queueX = newQx;
                    queueY = newQy;
                  }
                  queueX[tail] = nx;
                  queueY[tail] = ny;
                  tail++;
                }
              }
            }
          }
        }

        const boxW = maxX - minX + 1;
        const boxH = maxY - minY + 1;

        // 噪声孤岛过滤：两边均小于 minSize 则过滤
        if (minSize > 0 && boxW < minSize && boxH < minSize) {
          continue;
        }

        rawBoxes.push({
          x: minX,
          y: minY,
          width: boxW,
          height: boxH,
          pixelCount
        });
      }
    }

    if (rawBoxes.length === 0) {
      return [];
    }

    // 相邻连通块合并
    const mergedBoxes = ImageProcessor.mergeBoxes(rawBoxes, mergeDistance);

    // 二次尺寸过滤与结构规范化
    const finalBoxes = [];
    for (const b of mergedBoxes) {
      if (minSize > 0 && b.width < minSize && b.height < minSize) {
        continue;
      }
      finalBoxes.push({
        x: Math.max(0, Math.min(W - 1, b.x)),
        y: Math.max(0, Math.min(H - 1, b.y)),
        width: Math.min(W - b.x, b.width),
        height: Math.min(H - b.y, b.height)
      });
    }

    // 智能排序：按从上到下、从左到右自然排版顺序排序
    return ImageProcessor.sortBoxes(finalBoxes);
  }

  /**
   * 合并距离小于等于 mergeDistance 的矩形
   * @param {Array<{ x: number, y: number, width: number, height: number }>} boxes 
   * @param {number} mergeDistance 
   * @returns {Array<{ x: number, y: number, width: number, height: number }>}
   */
  static mergeBoxes(boxes, mergeDistance) {
    if (boxes.length <= 1 || mergeDistance < 0) {
      return boxes.map(b => ({ ...b }));
    }

    let current = boxes.map(b => ({ ...b }));
    let changed = true;

    while (changed) {
      changed = false;
      const next = [];
      const visited = new Array(current.length).fill(false);

      for (let i = 0; i < current.length; i++) {
        if (visited[i]) continue;
        let b1 = { ...current[i] };
        visited[i] = true;

        for (let j = i + 1; j < current.length; j++) {
          if (visited[j]) continue;
          const b2 = current[j];

          // 水平与垂直间距计算
          const dx = Math.max(0, Math.max(b1.x, b2.x) - Math.min(b1.x + b1.width, b2.x + b2.width));
          const dy = Math.max(0, Math.max(b1.y, b2.y) - Math.min(b1.y + b1.height, b2.y + b2.height));

          if (dx <= mergeDistance && dy <= mergeDistance) {
            // 合并连通块
            const nx = Math.min(b1.x, b2.x);
            const ny = Math.min(b1.y, b2.y);
            const nw = Math.max(b1.x + b1.width, b2.x + b2.width) - nx;
            const nh = Math.max(b1.y + b1.height, b2.y + b2.height) - ny;
            b1 = { x: nx, y: ny, width: nw, height: nh };
            visited[j] = true;
            changed = true;
          }
        }
        next.push(b1);
      }
      current = next;
    }

    return current;
  }

  /**
   * 按照自然排版阅读顺序排序外接矩形（先按行，同行按列）
   * @param {Array<{ x: number, y: number, width: number, height: number }>} boxes 
   * @returns {Array<{ x: number, y: number, width: number, height: number }>}
   */
  static sortBoxes(boxes) {
    if (boxes.length <= 1) return boxes;

    // 动态计算行高判定阈值：取所有包围盒平均高度的 40%
    const totalHeight = boxes.reduce((acc, b) => acc + b.height, 0);
    const avgHeight = totalHeight / boxes.length;
    const rowTolerance = Math.max(6, Math.round(avgHeight * 0.4));

    return [...boxes].sort((a, b) => {
      if (Math.abs(a.y - b.y) > rowTolerance) {
        return a.y - b.y;
      }
      return a.x - b.x;
    });
  }

  /**
   * 从文件读取并加载为 HTMLImageElement
   * @param {File|Blob} file 
   * @returns {Promise<HTMLImageElement>}
   */
  static loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        return reject(new Error('未选择任何图像文件'));
      }
      if (typeof FileReader === 'undefined' || typeof Image === 'undefined') {
        return reject(new Error('当前运行环境不支持浏览器 FileReader 或 Image API'));
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('图像加载失败，文件可能已损坏或格式不受支持'));
        img.src = e.target.result;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  /**
   * 从 HTMLImageElement 获取 Canvas ImageData
   * @param {HTMLImageElement|HTMLCanvasElement} img 
   * @returns {ImageData}
   */
  static getImageDataFromImage(img) {
    if (!img) {
      throw new Error('未提供有效图像元素');
    }
    if (typeof document === 'undefined') {
      throw new Error('当前环境无 document 对象');
    }

    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;

    if (!width || !height) {
      throw new Error('图像尺寸为 0，无法提取像素');
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, width, height);
  }

  /**
   * 从 ImageData 创建离屏 HTMLCanvasElement
   * @param {ImageData|Object} imageData 
   * @returns {HTMLCanvasElement}
   */
  static createCanvasFromImageData(imageData) {
    if (!imageData || !imageData.data) {
      throw new Error('无效的 imageData');
    }
    if (typeof document === 'undefined') {
      throw new Error('当前环境无 document 对象');
    }

    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');

    // 确保传入符合标准 ImageData 格式
    let imgData = imageData;
    if (typeof ImageData !== 'undefined' && !(imageData instanceof ImageData)) {
      imgData = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  /**
   * 获取指定坐标 (x, y) 的像素颜色
   * @param {ImageData|Object} imageData 
   * @param {number} x 
   * @param {number} y 
   * @returns {{ r: number, g: number, b: number, a: number }}
   */
  static sampleColor(imageData, x, y) {
    const clampedX = Math.max(0, Math.min(imageData.width - 1, Math.round(x)));
    const clampedY = Math.max(0, Math.min(imageData.height - 1, Math.round(y)));
    const offset = (clampedY * imageData.width + clampedX) * 4;
    return {
      r: imageData.data[offset],
      g: imageData.data[offset + 1],
      b: imageData.data[offset + 2],
      a: imageData.data[offset + 3]
    };
  }

  /**
   * 判断图像指定矩形区域内是否为空白内容（全透明或全纯色背景）
   * @param {ImageData|Object} imageData 完整大图像素数据
   * @param {{x: number, y: number, w: number, h: number}} rect 检查矩形
   * @param {Object} [options]
   * @param {number} [options.tolerance=25] 颜色差异容差
   * @param {number} [options.minForegroundRatio=0.008] 最小前景像素占比 (默认 0.8%)
   * @returns {boolean} 是否为空白无内容
   */
  static isRectContentEmpty(imageData, rect, options = {}) {
    if (!imageData || !imageData.data || !rect) return true;
    const { x, y, w, h } = rect;
    if (w <= 0 || h <= 0) return true;

    const imgW = imageData.width;
    const imgH = imageData.height;
    const data = imageData.data;
    const tolerance = options.tolerance ?? 25;
    const minRatio = options.minForegroundRatio ?? 0.008;

    const startX = Math.max(0, Math.min(imgW - 1, Math.round(x)));
    const startY = Math.max(0, Math.min(imgH - 1, Math.round(y)));
    const endX = Math.max(0, Math.min(imgW, Math.round(x + w)));
    const endY = Math.max(0, Math.min(imgH, Math.round(y + h)));

    const actualW = endX - startX;
    const actualH = endY - startY;
    const totalPixels = actualW * actualH;
    if (totalPixels <= 0) return true;

    // 采样左上角作为背景基准色
    const bgOffset = (startY * imgW + startX) * 4;
    const bgR = data[bgOffset];
    const bgG = data[bgOffset + 1];
    const bgB = data[bgOffset + 2];
    const bgA = data[bgOffset + 3];

    // 如果背景为透明
    const isBgTransparent = bgA <= 20;

    let foregroundCount = 0;
    // 步长采样 (每 2 像素采样一个，保证性能超高，毫秒级完成)
    const step = totalPixels > 10000 ? 2 : 1;
    let sampledTotal = 0;

    for (let py = startY; py < endY; py += step) {
      const rowOffset = py * imgW;
      for (let px = startX; px < endX; px += step) {
        sampledTotal++;
        const pOffset = (rowOffset + px) * 4;
        const a = data[pOffset + 3];

        if (isBgTransparent) {
          if (a > 20) foregroundCount++;
        } else {
          // 背景为不透明纯色 (如黑底或白底)
          if (a <= 20) {
            foregroundCount++;
          } else {
            const dr = Math.abs(data[pOffset] - bgR);
            const dg = Math.abs(data[pOffset + 1] - bgG);
            const db = Math.abs(data[pOffset + 2] - bgB);
            if (dr > tolerance || dg > tolerance || db > tolerance) {
              foregroundCount++;
            }
          }
        }
      }
    }

    const ratio = foregroundCount / sampledTotal;
    return ratio < minRatio;
  }
}

export default ImageProcessor;
