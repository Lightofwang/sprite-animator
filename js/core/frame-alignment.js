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
   * 根据帧尺寸、缩放比例、归一化锚点和 offset 偏移量，计算在世界视口或播放器基准点下绘制时的左上角实际渲染坐标
   * 公式:
   *   renderW = round(w * scale)
   *   renderH = round(h * scale)
   *   dx = targetBaseX - renderW * pivotX + offset.x
   *   dy = targetBaseY - renderH * pivotY + offset.y
   * @param {Object} frame 帧对象
   * @param {number} targetBaseX 目标视口世界基准 X 坐标 (如画布中心)
   * @param {number} targetBaseY 目标视口世界基准 Y 坐标 (如地面高度)
   * @returns {{dx: number, dy: number, renderW: number, renderH: number, scale: number}} 渲染坐标与尺寸
   */
  calculateWorldRenderPos(frame, targetBaseX, targetBaseY) {
    if (!frame) return { dx: targetBaseX, dy: targetBaseY, renderW: 0, renderH: 0, scale: 1.0 };

    const s = (typeof frame.scale === 'number' && !isNaN(frame.scale) && frame.scale > 0) ? frame.scale : 1.0;
    const w = frame.rect ? frame.rect.w : 0;
    const h = frame.rect ? frame.rect.h : 0;
    const renderW = Math.round(w * s);
    const renderH = Math.round(h * s);

    const px = (frame.pivot && typeof frame.pivot.x === 'number') ? frame.pivot.x : 0.5;
    const py = (frame.pivot && typeof frame.pivot.y === 'number') ? frame.pivot.y : 1.0;
    const ox = frame.offset ? (frame.offset.x || 0) : 0;
    const oy = frame.offset ? (frame.offset.y || 0) : 0;

    const dx = targetBaseX - renderW * px + ox;
    const dy = targetBaseY - renderH * py + oy;

    return { dx, dy, renderW, renderH, scale: s };
  }

  // ================= 1.5 缩放比例微调 (Frame Scale) =================

  /**
   * 设置当前帧的缩放比例
   * @param {Object} frame 帧对象
   * @param {number|string} scale 缩放比例数值 (如 1.0, 0.85)
   * @returns {number} 规范化后的缩放值
   */
  setScale(frame, scale) {
    if (!frame) throw new Error('[FrameAlignment] frame 不能为空');
    let val = parseFloat(scale);
    if (isNaN(val) || val <= 0) val = 1.0;
    // 限制范围在 0.2 (20%) 到 3.0 (300%)
    val = Math.max(0.2, Math.min(3.0, Math.round(val * 1000) / 1000));
    frame.scale = val;
    return frame.scale;
  }

  /**
   * 增量微调帧的缩放比例
   * @param {Object} frame 帧对象
   * @param {number} delta 如 0.05 或 -0.05
   * @returns {number}
   */
  nudgeScale(frame, delta) {
    if (!frame) throw new Error('[FrameAlignment] frame 不能为空');
    const current = (typeof frame.scale === 'number') ? frame.scale : 1.0;
    return this.setScale(frame, current + delta);
  }

  /**
   * 重置帧缩放比例为 1.0 (100%)
   * @param {Object} frame 帧对象
   * @returns {number}
   */
  resetScale(frame) {
    if (!frame) throw new Error('[FrameAlignment] frame 不能为空');
    frame.scale = 1.0;
    return 1.0;
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

  /**
   * 根据检测到的角色真实内容边界，自动计算并设置帧的 offset.y（及可选 offset.x），
   * 使角色真实最低点（脚底）精准贴合到地面基准线 targetBaseY，
   * 使角色左脚 / 躯干重心 / 右脚精准对齐水平基准中心 targetBaseX
   * @param {Object} frame 帧对象
   * @param {{ localMinX: number, localMaxX: number, localMinY: number, localMaxY: number, bodyCenterX?: number, leftFootX?: number, rightFootX?: number }} bounds 角色真实像素边界
   * @param {{ alignX?: boolean, alignY?: boolean, xMode?: 'left-foot'|'body-center'|'right-foot' }} [options={}]
   * @returns {{ x: number, y: number }} 更新后的 offset
   */
  autoAlignFrameToGround(frame, bounds, options = {}) {
    if (!frame || !frame.rect || !bounds) {
      return frame?.offset || { x: 0, y: 0 };
    }
    if (!frame.offset) {
      frame.offset = { x: 0, y: 0 };
    }

    const w = frame.rect.w;
    const h = frame.rect.h;
    const px = (frame.pivot && typeof frame.pivot.x === 'number') ? frame.pivot.x : 0.5;
    const py = (frame.pivot && typeof frame.pivot.y === 'number') ? frame.pivot.y : 1.0;

    if (options.alignY !== false) {
      // 角色真实最低点在局部框内的底部坐标为 bounds.localMaxY + 1
      frame.offset.y = Math.round(h * py - (bounds.localMaxY + 1));
    }

    if (options.alignX) {
      const xMode = options.xMode || 'body-center';
      let targetLocalX;
      if (xMode === 'left-foot' && typeof bounds.leftFootX === 'number') {
        targetLocalX = bounds.leftFootX;
      } else if (xMode === 'right-foot' && typeof bounds.rightFootX === 'number') {
        targetLocalX = bounds.rightFootX;
      } else if (typeof bounds.bodyCenterX === 'number') {
        targetLocalX = bounds.bodyCenterX;
      } else {
        targetLocalX = (bounds.localMinX + bounds.localMaxX + 1) / 2;
      }

      // 若外部指定了统一的参考基准 X (如全部帧左脚的平均局部 X)，则对齐到该基准，避免整体大幅偏心导致右侧刀光出框
      const refX = (typeof options.referenceX === 'number')
        ? options.referenceX
        : (xMode === 'left-foot' ? w * 0.36 : w * px);

      frame.offset.x = Math.round(refX - targetLocalX);
    }

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

    const { dx, dy, renderW, renderH } = this.calculateWorldRenderPos(frame, targetBaseX, targetBaseY);
    const { w, h, x: sx, y: sy } = frame.rect;
    if (w <= 0 || h <= 0 || renderW <= 0 || renderH <= 0) return;

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
          tintCanvas.width = renderW;
          tintCanvas.height = renderH;
          const tctx = tintCanvas.getContext('2d');
          tctx.imageSmoothingEnabled = false;

          // 绘制原帧图像并缩放至 renderW, renderH
          if (frame.maskCanvas) {
            tctx.drawImage(frame.maskCanvas, 0, 0, w, h, 0, 0, renderW, renderH);
          } else {
            tctx.drawImage(sourceImage, sx, sy, w, h, 0, 0, renderW, renderH);
          }

          // 叠加上色模式
          tctx.globalCompositeOperation = 'source-atop';
          tctx.fillStyle = tint;
          tctx.fillRect(0, 0, renderW, renderH);

          // 绘制上色后的残影
          ctx.drawImage(tintCanvas, dx, dy);
        } catch (e) {
          // 容错降级直接绘制原图
          this._drawRawFrame(ctx, frame, sourceImage, dx, dy, renderW, renderH);
        }
      } else {
        // 无染色正常绘制
        this._drawRawFrame(ctx, frame, sourceImage, dx, dy, renderW, renderH);
      }
    }

    ctx.restore();
  }

  /**
   * 绘制原图切片
   * @private
   */
  _drawRawFrame(ctx, frame, sourceImage, dx, dy, renderW, renderH) {
    const { w, h, x, y } = frame.rect;
    const targetW = (typeof renderW === 'number' && renderW > 0) ? renderW : w;
    const targetH = (typeof renderH === 'number' && renderH > 0) ? renderH : h;

    if (frame.maskCanvas) {
      ctx.drawImage(frame.maskCanvas, 0, 0, w, h, dx, dy, targetW, targetH);
    } else if (sourceImage) {
      ctx.drawImage(sourceImage, x, y, w, h, dx, dy, targetW, targetH);
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
   * 计算全部动作帧相对于锚点基准 (0, 0) 的联合包围盒 (Union Bounding Box)
   * 确保当以左脚对齐或存在较大 offset 时，右侧长枪与大刀光依然 100% 纳入视口计算
   * @param {Array<Object>} allFrames 
   * @param {Object|null} currentFrame 
   * @returns {{ minLeft: number, maxRight: number, minTop: number, maxBottom: number, spanW: number, spanH: number }}
   */
  calculateStageBounds(allFrames = [], currentFrame = null) {
    const list = (Array.isArray(allFrames) && allFrames.length > 0)
      ? allFrames
      : (currentFrame ? [currentFrame] : []);

    let minLeft = Infinity;
    let maxRight = -Infinity;
    let minTop = Infinity;
    let maxBottom = -Infinity;

    list.forEach(f => {
      if (!f || !f.rect) return;
      const w = f.rect.w || 0;
      const h = f.rect.h || 0;
      if (w <= 0 || h <= 0) return;

      const px = (f.pivot && typeof f.pivot.x === 'number') ? f.pivot.x : 0.5;
      const py = (f.pivot && typeof f.pivot.y === 'number') ? f.pivot.y : 1.0;
      const ox = (f.offset && typeof f.offset.x === 'number') ? f.offset.x : 0;
      const oy = (f.offset && typeof f.offset.y === 'number') ? f.offset.y : 0;

      const s = (typeof f.scale === 'number' && !isNaN(f.scale) && f.scale > 0) ? f.scale : 1.0;
      const renderW = Math.round(w * s);
      const renderH = Math.round(h * s);

      const l = ox - renderW * px;
      const r = ox + renderW * (1 - px);
      const t = oy - renderH * py;
      const b = oy + renderH * (1 - py);

      if (l < minLeft) minLeft = l;
      if (r > maxRight) maxRight = r;
      if (t < minTop) minTop = t;
      if (b > maxBottom) maxBottom = b;
    });

    if (!isFinite(minLeft) || !isFinite(maxRight)) {
      return { minLeft: 0, maxRight: 0, minTop: 0, maxBottom: 0, spanW: 0, spanH: 0 };
    }

    return {
      minLeft,
      maxRight,
      minTop,
      maxBottom,
      spanW: Math.max(0, maxRight - minLeft),
      spanH: Math.max(0, maxBottom - minTop)
    };
  }

  /**
   * 计算视口舞台的恒定缩放比 (严格仅取决于选框尺寸 rect.w / rect.h，拖拽改变 offset 时绝对不改变图片大小)
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

    // 自适应 Auto Fit 逻辑：仅根据选框原始宽高计算恒定缩放比，拖拽 offset 时绝不放大缩小
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
   * 渲染对齐工作台/播放器视口 (包含洋葱皮、恒定缩放、地面参考线与锚点准星)
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

    // 固定地面与锚点基准坐标：水平居中，脚底基准线位于画布高 82% 处（拖拽人物时舞台与大小 100% 恒定不变）
    const targetBaseX = Math.round(width / 2);
    const targetBaseY = Math.round(height * 0.82);

    // 计算恒定视口缩放比
    const scale = this.calculateStageScale(width, height, allFrames, currentFrame, displayConfig.zoom);

    this.lastRenderScale = scale;
    this.lastTargetBaseX = targetBaseX;
    this.lastTargetBaseY = targetBaseY;

    const showGround = displayConfig.showGround !== false;
    const showPivot = displayConfig.showPivot !== false;
    const showOnion = Boolean(displayConfig.onionSkin);

    const curOx = currentFrame?.offset ? (currentFrame.offset.x || 0) : 0;
    const curOy = currentFrame?.offset ? (currentFrame.offset.y || 0) : 0;
    const isXZero = (curOx === 0);
    const isYZero = (curOy === 0);

    // 1. 绘制极简纯净的 XY 对齐参考线 (无任何遮挡身体或脚下的刻度与杂乱文字)
    if (showGround) {
      ctx.save();

      // (1) 水平 Y 轴地面基准线 (贯穿全宽视口)
      ctx.beginPath();
      ctx.lineWidth = isYZero ? 1.5 : 1;
      ctx.strokeStyle = isYZero ? '#06d6a0' : 'rgba(58, 134, 255, 0.45)';
      if (isYZero) {
        ctx.setLineDash([]);
      } else {
        ctx.setLineDash([4, 4]);
      }
      ctx.moveTo(0, targetBaseY);
      ctx.lineTo(width, targetBaseY);
      ctx.stroke();

      // (2) 垂直 X 轴中心线 (贯穿全高视口)
      ctx.beginPath();
      ctx.lineWidth = isXZero ? 1.5 : 1;
      ctx.strokeStyle = isXZero ? '#06d6a0' : 'rgba(58, 134, 255, 0.45)';
      if (isXZero) {
        ctx.setLineDash([]);
      } else {
        ctx.setLineDash([4, 4]);
      }
      ctx.moveTo(targetBaseX, 0);
      ctx.lineTo(targetBaseX, height);
      ctx.stroke();

      // (3) 世界基准原点 (0, 0) 极简中心微点
      ctx.setLineDash([]);
      ctx.fillStyle = '#3a86ff';
      ctx.beginPath();
      ctx.arc(targetBaseX, targetBaseY, 2.5, 0, Math.PI * 2);
      ctx.fill();

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

    // 4. 绘制当前帧极简十字准星与左上角清爽 HUD 坐标牌 (脚底彻底清爽，不遮挡任何画面)
    if (currentFrame && showPivot) {
      ctx.save();

      const fx = targetBaseX + curOx * scale;
      const fy = targetBaseY + curOy * scale;

      // 绘制当前帧锚点极简准星 (高亮荧光粉 / 若完美对齐归零则为亮绿)
      const isPerfectAligned = (curOx === 0 && curOy === 0);
      const reticleColor = isPerfectAligned ? '#06d6a0' : '#ff006e';

      // 准星外圆 (5px 紧凑小圆)
      ctx.strokeStyle = reticleColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(fx, fy, 5, 0, Math.PI * 2);
      ctx.stroke();

      // 准星十字交叉丝 (8px 紧凑臂长)
      ctx.beginPath();
      ctx.moveTo(fx - 8, fy);
      ctx.lineTo(fx + 8, fy);
      ctx.moveTo(fx, fy - 8);
      ctx.lineTo(fx, fy + 8);
      ctx.stroke();

      // 准星中心白点
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(fx, fy, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // 在视口左上角常驻清晰小巧的 HUD 对齐信息卡片 (完全不干扰脚下画面)
      if (showGround) {
        const hudX = 10;
        const hudY = 10;
        const hudW = 195;
        const hudH = 24;

        ctx.fillStyle = 'rgba(15, 17, 26, 0.85)';
        ctx.strokeStyle = isPerfectAligned ? '#06d6a0' : 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath();
          ctx.roundRect(hudX, hudY, hudW, hudH, 4);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillRect(hudX, hudY, hudW, hudH);
          ctx.strokeRect(hudX, hudY, hudW, hudH);
        }

        ctx.font = '11px monospace';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';

        // X 指示
        ctx.fillStyle = isXZero ? '#06d6a0' : '#ffb703';
        const xStr = `X:${curOx >= 0 ? '+' : ''}${curOx}`;
        ctx.fillText(xStr, hudX + 6, hudY + 12);

        // 分隔竖线 1
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(hudX + 54, hudY + 4, 1, 16);

        // Y 指示
        ctx.fillStyle = isYZero ? '#06d6a0' : '#ffb703';
        const yStr = `Y:${curOy >= 0 ? '+' : ''}${curOy}`;
        ctx.fillText(yStr, hudX + 62, hudY + 12);

        // 分隔竖线 2
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(hudX + 110, hudY + 4, 1, 16);

        // Scale 缩放指示
        const sVal = (typeof currentFrame.scale === 'number') ? currentFrame.scale : 1.0;
        const sPercent = Math.round(sVal * 100);
        ctx.fillStyle = (sPercent === 100) ? '#06d6a0' : '#3a86ff';
        const sStr = `缩放:${sPercent}%`;
        ctx.fillText(sStr, hudX + 118, hudY + 12);
      }

      ctx.restore();
    }
  }
}

// 导出单例与实例方法
export const frameAlignment = new FrameAlignment();
export default frameAlignment;
