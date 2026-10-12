/**
 * @file frame-alignment.js
 * @description 帧位置编辑、锚点对齐与洋葱皮残影核心模块 (Alignment & Onion Skin)
 * 解决序列帧重心跳动与对齐问题，提供九宫格锚点系统、绝对像素锚点、键盘偏移微调与洋葱皮残影比对
 */

/**
 * 九宫格预设相对锚点定义
 * 包含键名、标准短代码、别名及相对帧尺寸的比例坐标 (0~1)
 */
export const PIVOT_PRESETS = {
  tl: { key: 'tl', domKey: 'top-left', name: '左上角', x: 0.0, y: 0.0, aliases: ['top-left', 'tl'] },
  tc: { key: 'tc', domKey: 'top-center', name: '中上', x: 0.5, y: 0.0, aliases: ['top-center', 'tc'] },
  tr: { key: 'tr', domKey: 'top-right', name: '右上角', x: 1.0, y: 0.0, aliases: ['top-right', 'tr'] },
  ml: { key: 'ml', domKey: 'center-left', name: '左中', x: 0.0, y: 0.5, aliases: ['center-left', 'mid-left', 'ml'] },
  c:  { key: 'c',  domKey: 'center', name: '正中心', x: 0.5, y: 0.5, aliases: ['center', 'c'] },
  mr: { key: 'mr', domKey: 'center-right', name: '右中', x: 1.0, y: 0.5, aliases: ['center-right', 'mid-right', 'mr'] },
  bl: { key: 'bl', domKey: 'bottom-left', name: '左下角', x: 0.0, y: 1.0, aliases: ['bottom-left', 'bl'] },
  bc: { key: 'bc', domKey: 'bottom-center', name: '底部中心', x: 0.5, y: 1.0, aliases: ['bottom-center', 'bc'] },
  br: { key: 'br', domKey: 'bottom-right', name: '右下角', x: 1.0, y: 1.0, aliases: ['bottom-right', 'br'] },
};

/**
 * 别名索引映射表，方便快速不区分大小写检索
 */
const ALIAS_MAP = new Map();
Object.values(PIVOT_PRESETS).forEach(preset => {
  ALIAS_MAP.set(preset.key.toLowerCase(), preset);
  preset.aliases.forEach(alias => {
    ALIAS_MAP.set(alias.toLowerCase(), preset);
  });
});

/**
 * 帧对齐与洋葱皮残影核心管理类
 */
export class FrameAlignment {
  constructor() {
    this.presets = PIVOT_PRESETS;
  }

  // ================= 1. 锚点计算 (Pivot Calculations) =================

  /**
   * 解析锚点预设 Key 或别名
   * @param {string} presetKey 如 'tl', 'top-left', 'bottom-center', 'bc'
   * @returns {Object|null} 预设对象或 null
   */
  resolvePreset(presetKey) {
    if (!presetKey || typeof presetKey !== 'string') return null;
    return ALIAS_MAP.get(presetKey.trim().toLowerCase()) || null;
  }

  /**
   * 应用预设锚点到指定帧
   * @param {Object} frame 帧对象
   * @param {string} presetKey 预设键名（如 'bc', 'bottom-center' 等）
   * @returns {{x: number, y: number}} 更新后的归一化锚点坐标
   */
  setPivotPreset(frame, presetKey) {
    if (!frame) throw new Error('[FrameAlignment] frame 不能为空');
    const preset = this.resolvePreset(presetKey);
    if (!preset) {
      console.warn(`[FrameAlignment] 未知的锚点预设键: ${presetKey}`);
      return frame.pivot || { x: 0.5, y: 1.0 };
    }

    frame.pivot = { x: preset.x, y: preset.y };
    return { ...frame.pivot };
  }

  /**
   * 根据绝对像素坐标设置锚点 (将像素转换为归一化比例 0.0 ~ 1.0)
   * @param {Object} frame 帧对象
   * @param {number} pixelX 帧内相对左上角的水平像素坐标
   * @param {number} pixelY 帧内相对左上角的垂直像素坐标
   * @returns {{x: number, y: number}} 更新后的归一化锚点坐标
   */
  setCustomPivot(frame, pixelX, pixelY) {
    if (!frame) throw new Error('[FrameAlignment] frame 不能为空');
    const w = frame.rect?.w || 0;
    const h = frame.rect?.h || 0;

    if (w <= 0 || h <= 0) {
      frame.pivot = { x: 0.5, y: 1.0 };
      return { ...frame.pivot };
    }

    const ratioX = pixelX / w;
    const ratioY = pixelY / h;

    frame.pivot = { x: ratioX, y: ratioY };
    return { ...frame.pivot };
  }

  /**
   * 获取当前帧最匹配的九宫格预设键名
   * @param {Object} frame 帧对象
   * @param {number} tolerance 容差，默认 0.05
   * @param {'full'|'short'} format 返回全拼 ('bottom-center') 或短代码 ('bc')
   * @returns {string|null} 匹配到的预设键名，若无匹配返回 null
   */
  getPivotPresetKey(frame, tolerance = 0.05, format = 'full') {
    if (!frame || !frame.pivot) return null;
    const { x, y } = frame.pivot;

    for (const preset of Object.values(PIVOT_PRESETS)) {
      if (Math.abs(preset.x - x) <= tolerance && Math.abs(preset.y - y) <= tolerance) {
        if (format === 'short') return preset.key;
        return preset.domKey || preset.aliases.find(a => a.includes('-')) || preset.key;
      }
    }
    return null;
  }

  /**
   * 根据帧尺寸、归一化锚点和 offset 偏移量，计算在世界视口或播放器基准点下绘制时的左上角实际渲染坐标
   * 公式:
   *   dx = targetBaseX - w * pivotX + offset.x
   *   dy = targetBaseY - h * pivotY + offset.y
   * @param {Object} frame 帧对象
   * @param {number} targetBaseX 目标视口世界基准 X 坐标 (如画布中心)
   * @param {number} targetBaseY 目标视口世界基准 Y 坐标 (如地面高度)
   * @returns {{dx: number, dy: number}} 左上角渲染坐标
   */
  calculateWorldRenderPos(frame, targetBaseX, targetBaseY) {
    if (!frame) return { dx: targetBaseX, dy: targetBaseY };

    const w = frame.rect ? frame.rect.w : 0;
    const h = frame.rect ? frame.rect.h : 0;
    const px = (frame.pivot && typeof frame.pivot.x === 'number') ? frame.pivot.x : 0.5;
    const py = (frame.pivot && typeof frame.pivot.y === 'number') ? frame.pivot.y : 1.0;
    const ox = frame.offset ? (frame.offset.x || 0) : 0;
    const oy = frame.offset ? (frame.offset.y || 0) : 0;

    const dx = targetBaseX - w * px + ox;
    const dy = targetBaseY - h * py + oy;

    return { dx, dy };
  }

  // ================= 2. 位置微调 (Keyboard Nudge & Offset) =================

  /**
   * 增量微调帧的偏移量 (支持键盘方向键与 Shift 增量)
   * @param {Object} frame 帧对象
   * @param {number} dx 水平增量 (正数向右，负数向左)
   * @param {number} dy 垂直增量 (正数向下，负数向上)
   * @returns {{x: number, y: number}} 更新后的偏移量对象
   */
  nudgeOffset(frame, dx, dy) {
    if (!frame) throw new Error('[FrameAlignment] frame 不能为空');
    if (!frame.offset) {
      frame.offset = { x: 0, y: 0 };
    }

    frame.offset.x = (frame.offset.x || 0) + dx;
    frame.offset.y = (frame.offset.y || 0) + dy;

    return { ...frame.offset };
  }

  /**
   * 归零重置当前帧偏移量
   * @param {Object} frame 帧对象
   * @returns {{x: number, y: number}}
   */
  resetOffset(frame) {
    if (!frame) throw new Error('[FrameAlignment] frame 不能为空');
    frame.offset = { x: 0, y: 0 };
    return { ...frame.offset };
  }

  // ================= 3. 洋葱皮残影生成 (Onion Skinning Helper) =================

  /**
   * 获取当前帧的前后相邻洋葱皮残影帧列表及其视觉着色配置
   * - 前相邻帧着色淡红/橙色 (淡暖色)，透明度 0.30
   * - 后相邻帧着色淡蓝/青色 (淡冷色)，透明度 0.30
   * - 边界处理：首帧无前帧，末帧无后帧
   * @param {Array<Object>} frames 完整序列帧数组
   * @param {number} currentIndex 当前选中的帧索引
   * @param {number} prevCount 前向残影数量，默认 1
   * @param {number} nextCount 后向残影数量，默认 1
   * @returns {Array<Object>} 残影配置对象数组
   */
  getOnionSkinFrames(frames, currentIndex, prevCount = 1, nextCount = 1) {
    if (!Array.isArray(frames) || frames.length === 0) return [];
    if (currentIndex < 0 || currentIndex >= frames.length) return [];

    const result = [];

    // 1. 提取前向帧 (倒序遍历以保持从远到近的层次)
    for (let step = prevCount; step >= 1; step--) {
      const idx = currentIndex - step;
      if (idx >= 0 && idx < frames.length) {
        result.push({
          frame: frames[idx],
          index: idx,
          type: 'prev',
          step,
          offsetIndex: -step,
          // 前帧着色：淡红/橙色半透明
          tint: 'rgba(255, 68, 68, 0.30)',
          color: '#ff4444',
          alpha: 0.30
        });
      }
    }

    // 2. 提取后向帧
    for (let step = 1; step <= nextCount; step++) {
      const idx = currentIndex + step;
      if (idx >= 0 && idx < frames.length) {
        result.push({
          frame: frames[idx],
          index: idx,
          type: 'next',
          step,
          offsetIndex: step,
          // 后帧着色：淡蓝/青色半透明
          tint: 'rgba(0, 180, 255, 0.30)',
          color: '#00b4ff',
          alpha: 0.30
        });
      }
    }

    return result;
  }

  // ================= 4. Canvas 视口渲染辅助方法 =================

  /**
   * 绘制单帧到目标 Canvas 上下文 (支持染色、透明度、锚点与地面参考线)
   * @param {CanvasRenderingContext2D} ctx 目标 2D 上下文
   * @param {Object} frame 帧对象
   * @param {HTMLImageElement|HTMLCanvasElement|null} sourceImage 原始大图
   * @param {number} targetBaseX 基准点 X
   * @param {number} targetBaseY 基准点 Y
   * @param {Object} options 渲染选项 { alpha, tint, showPivot, showGround }
   */
  renderFrameToContext(ctx, frame, sourceImage, targetBaseX, targetBaseY, options = {}) {
    if (!ctx || !frame || !frame.rect) return;

    const { dx, dy } = this.calculateWorldRenderPos(frame, targetBaseX, targetBaseY);
    const { w, h, x: sx, y: sy } = frame.rect;
    if (w <= 0 || h <= 0) return;

    const alpha = typeof options.alpha === 'number' ? options.alpha : 1.0;
    const tint = options.tint || null;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = alpha;

    // 获取帧绘制源 (优先使用已隔离的 maskCanvas)
    const drawSource = frame.maskCanvas || sourceImage;

    if (drawSource) {
      if (tint && typeof document !== 'undefined') {
        // 创建临时染色离屏 Canvas (适用于洋葱皮红/蓝残影)
        try {
          const tintCanvas = document.createElement('canvas');
          tintCanvas.width = w;
          tintCanvas.height = h;
          const tctx = tintCanvas.getContext('2d');
          tctx.imageSmoothingEnabled = false;

          // 绘制原帧图像
          if (frame.maskCanvas) {
            tctx.drawImage(frame.maskCanvas, 0, 0, w, h);
          } else {
            tctx.drawImage(sourceImage, sx, sy, w, h, 0, 0, w, h);
          }

          // 叠加上色模式
          tctx.globalCompositeOperation = 'source-atop';
          tctx.fillStyle = tint;
          tctx.fillRect(0, 0, w, h);

          // 绘制上色后的残影
          ctx.drawImage(tintCanvas, dx, dy);
        } catch (e) {
          // 容错降级直接绘制原图
          this._drawRawFrame(ctx, frame, sourceImage, dx, dy, w, h);
        }
      } else {
        // 无染色正常绘制
        this._drawRawFrame(ctx, frame, sourceImage, dx, dy, w, h);
      }
    }

    ctx.restore();
  }

  /**
   * 绘制原图切片
   * @private
   */
  _drawRawFrame(ctx, frame, sourceImage, dx, dy, w, h) {
    if (frame.maskCanvas) {
      ctx.drawImage(frame.maskCanvas, 0, 0, w, h, dx, dy, w, h);
    } else if (sourceImage) {
      ctx.drawImage(sourceImage, frame.rect.x, frame.rect.y, w, h, dx, dy, w, h);
    }
  }

  /**
   * 渲染完整对齐视口舞台 (包含地面线、洋葱皮前后残影、主帧与锚点准星)
   * @param {HTMLCanvasElement} canvas 视口 Canvas 元素
   * @param {Object} currentFrame 当前激活选中的帧
   * @param {Array<Object>} allFrames 全部帧列表
   * @param {number} currentIndex 当前帧索引
   * @param {HTMLImageElement|null} sourceImage 原始大图
   * @param {Object} displayConfig 显示配置 { showGround, onionSkin, showPivot, onionSkinOpacity }
   */
  /**
   * 计算视口舞台的最佳缩放比 (自适应完整展示整个人物与武器)
   * @param {number} canvasWidth 
   * @param {number} canvasHeight 
   * @param {Array<Object>} allFrames 
   * @param {Object|null} currentFrame 
   * @param {number|string} userZoom 'auto' 或 具体倍率数字
   * @returns {number}
   */
  calculateStageScale(canvasWidth, canvasHeight, allFrames = [], currentFrame = null, userZoom = 'auto') {
    if (typeof userZoom === 'number' && userZoom > 0) {
      return userZoom;
    }
    if (typeof userZoom === 'string' && userZoom !== 'auto') {
      const parsed = parseFloat(userZoom);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }

    // 自适应 Auto Fit 逻辑
    let maxW = currentFrame?.rect?.w || 0;
    let maxH = currentFrame?.rect?.h || 0;

    if (Array.isArray(allFrames)) {
      allFrames.forEach(f => {
        if (f && f.rect) {
          if (f.rect.w > maxW) maxW = f.rect.w;
          if (f.rect.h > maxH) maxH = f.rect.h;
        }
      });
    }

    if (maxW <= 0 || maxH <= 0) return 1.0;

    // 可用区域：宽度预留 15% 边距，高度从脚底 82% 向上预留 6% 边距即 76%
    const availW = canvasWidth * 0.85;
    const availH = canvasHeight * 0.76;

    const scaleW = availW / maxW;
    const scaleH = availH / maxH;
    const fitScale = Math.min(scaleW, scaleH);

    return Math.min(1.0, fitScale);
  }

  /**
   * 渲染对齐工作台/播放器视口 (包含洋葱皮、自适应缩放、地面参考线与锚点准星)
   * @param {HTMLCanvasElement} canvas 目标视口 Canvas
   * @param {Object|null} currentFrame 当前帧对象
   * @param {Array<Object>} allFrames 全部帧列表
   * @param {number} currentIndex 当前帧索引
   * @param {HTMLImageElement|null} sourceImage 原始大图
   * @param {Object} displayConfig 显示配置 { showGround, onionSkin, showPivot, onionSkinOpacity, zoom }
   */
  renderAlignmentStage(canvas, currentFrame, allFrames = [], currentIndex = 0, sourceImage = null, displayConfig = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 清空背景
    ctx.clearRect(0, 0, width, height);

    // 计算地面与锚点基准坐标：水平居中，脚底基准线位于画布高 82% 处
    const targetBaseX = Math.round(width / 2);
    const targetBaseY = Math.round(height * 0.82);

    // 计算视口缩放比
    const scale = this.calculateStageScale(width, height, allFrames, currentFrame, displayConfig.zoom);
    this.lastRenderScale = scale;
    this.lastTargetBaseX = targetBaseX;
    this.lastTargetBaseY = targetBaseY;

    const showGround = displayConfig.showGround !== false;
    const showPivot = displayConfig.showPivot !== false;
    const showOnion = Boolean(displayConfig.onionSkin);

    // 1. 绘制地面基准参考线 (穿过锚点基准)
    if (showGround) {
      ctx.save();
      ctx.strokeStyle = '#3a86ff';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, targetBaseY);
      ctx.lineTo(width, targetBaseY);
      ctx.stroke();

      // 地面中心小竖标
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(58, 134, 255, 0.4)';
      ctx.beginPath();
      ctx.moveTo(targetBaseX, targetBaseY - 6);
      ctx.lineTo(targetBaseX, targetBaseY + 6);
      ctx.stroke();
      ctx.restore();
    }

    // 2 & 3. 绘制洋葱皮残影与当前主体帧 (应用缩放变换)
    ctx.save();
    ctx.translate(targetBaseX, targetBaseY);
    ctx.scale(scale, scale);

    // 洋葱皮残影 (在局部坐标系以 (0, 0) 为脚底基准对齐)
    if (showOnion && allFrames.length > 1) {
      const onionList = this.getOnionSkinFrames(allFrames, currentIndex, 1, 1);
      const userAlpha = typeof displayConfig.onionSkinOpacity === 'number' ? displayConfig.onionSkinOpacity : 0.30;

      onionList.forEach(item => {
        this.renderFrameToContext(ctx, item.frame, sourceImage, 0, 0, {
          alpha: userAlpha,
          tint: item.color
        });
      });
    }

    // 当前主体帧 (在局部坐标系以 (0, 0) 为脚底基准对齐)
    if (currentFrame) {
      this.renderFrameToContext(ctx, currentFrame, sourceImage, 0, 0, {
        alpha: 1.0,
        tint: null
      });
    }
    ctx.restore();

    // 4. 绘制当前帧的锚点十字准星 (在屏幕绝对像素空间，保持准星清晰度)
    if (currentFrame && showPivot) {
      ctx.save();
      const ox = currentFrame.offset ? (currentFrame.offset.x || 0) : 0;
      const oy = currentFrame.offset ? (currentFrame.offset.y || 0) : 0;
      const pivotScreenX = targetBaseX + ox * scale;
      const pivotScreenY = targetBaseY + oy * scale;

      // 准星红色外圆
      ctx.strokeStyle = '#ff006e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pivotScreenX, pivotScreenY, 6, 0, Math.PI * 2);
      ctx.stroke();

      // 准星十字交叉线
      ctx.beginPath();
      ctx.moveTo(pivotScreenX - 10, pivotScreenY);
      ctx.lineTo(pivotScreenX + 10, pivotScreenY);
      ctx.moveTo(pivotScreenX, pivotScreenY - 10);
      ctx.lineTo(pivotScreenX, pivotScreenY + 10);
      ctx.stroke();

      // 准星中心白点
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pivotScreenX, pivotScreenY, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }
}

// 导出单例与实例方法
export const frameAlignment = new FrameAlignment();
export default frameAlignment;
