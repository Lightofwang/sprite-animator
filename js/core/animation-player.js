/**
 * @file animation-player.js
 * @description 实时动画播放器引擎核心模块 (Animation Player Engine)
 * 驱动对齐后的序列帧以精确帧率流畅、无抖动地播放成 2D 动作动画
 */

export class AnimationPlayer {
  /**
   * 构造函数
   * @param {Object} options 配置参数
   * @param {number} [options.fps=12] 播放帧率 (1~60)
   * @param {'loop'|'once'|'pingpong'} [options.loopMode='loop'] 循环播放模式
   * @param {Array<Object>} [options.frames=[]] 序列帧数组
   * @param {number} [options.initialFrame=0] 初始帧索引
   * @param {HTMLCanvasElement|null} [options.canvas=null] 渲染目标 Canvas
   * @param {HTMLImageElement|HTMLCanvasElement|null} [options.sourceImage=null] 原始大图资源
   * @param {Function|null} [options.onFrameChange=null] 帧切换回调 (frameIndex, frame) => void
   * @param {Function|null} [options.onPlayStateChange=null] 播放状态回调 (isPlaying) => void
   * @param {Function|null} [options.renderCustom=null] 自定义外部视口渲染函数
   */
  constructor(options = {}) {
    this.fps = this._clampFPS(options.fps !== undefined ? options.fps : 12);
    this.loopMode = this._validateLoopMode(options.loopMode || 'loop');
    this.frames = Array.isArray(options.frames) ? [...options.frames] : [];
    
    // 当前播放帧索引
    this.currentFrameIndex = this._sanitizeIndex(
      options.initialFrame !== undefined ? options.initialFrame : 0
    );

    // 播放状态与方向
    this.isPlaying = false;
    this.direction = 1; // 1: 正向, -1: 反向 (用于 pingpong 往返)

    // 视口与图像资源
    this.canvas = options.canvas || null;
    this.sourceImage = options.sourceImage || null;

    // 回调钩子
    this.onFrameChange = typeof options.onFrameChange === 'function' ? options.onFrameChange : null;
    this.onPlayStateChange = typeof options.onPlayStateChange === 'function' ? options.onPlayStateChange : null;
    this.renderCustom = typeof options.renderCustom === 'function' ? options.renderCustom : null;

    // 时间驱动引擎内部累加器与调度状态
    this._accumulator = 0;
    this._lastTime = 0;
    this._rafId = null;
    this._boundTick = this._tick.bind(this);
  }

  // ================= 1. 帧率与时间参数 (FPS & Timing) =================

  /**
   * 安全约束 FPS 在 1~60 之间
   * @private
   */
  _clampFPS(fps) {
    const num = Number(fps);
    if (isNaN(num)) return 12;
    return Math.max(1, Math.min(60, Math.round(num)));
  }

  /**
   * 校验并规范化循环模式
   * @private
   */
  _validateLoopMode(mode) {
    if (mode === 'once' || mode === 'pingpong' || mode === 'loop') {
      return mode;
    }
    return 'loop';
  }

  /**
   * 安全规范化当前帧索引
   * @private
   */
  _sanitizeIndex(index) {
    if (!this.frames || this.frames.length === 0) return 0;
    const num = Number(index);
    if (isNaN(num)) return 0;
    return Math.max(0, Math.min(this.frames.length - 1, Math.round(num)));
  }

  /**
   * 获取当前设置的帧率
   * @returns {number}
   */
  getFPS() {
    return this.fps;
  }

  /**
   * 动态设置播放帧率 (支持 1~60 FPS，即时生效)
   * @param {number} fps 
   * @returns {number} 生效的 FPS 数值
   */
  setFPS(fps) {
    this.fps = this._clampFPS(fps);
    return this.fps;
  }

  /**
   * 计算单帧理论持续时长 (毫秒)
   * @returns {number}
   */
  getFrameDuration() {
    return 1000 / this.fps;
  }

  /**
   * 获取当前播放循环模式
   * @returns {'loop'|'once'|'pingpong'}
   */
  getLoopMode() {
    return this.loopMode;
  }

  /**
   * 动态设置播放循环模式
   * @param {'loop'|'once'|'pingpong'} mode 
   */
  setLoopMode(mode) {
    this.loopMode = this._validateLoopMode(mode);
    if (this.loopMode === 'pingpong') {
      // 保持当前方向或默认正向
      if (this.direction !== 1 && this.direction !== -1) {
        this.direction = 1;
      }
    }
    return this.loopMode;
  }

  // ================= 2. 帧数据管理 (Frame Management) =================

  /**
   * 更新序列帧列表
   * @param {Array<Object>} frames 
   */
  setFrames(frames) {
    this.frames = Array.isArray(frames) ? [...frames] : [];
    this.currentFrameIndex = this._sanitizeIndex(this.currentFrameIndex);
    this._notifyFrameChange();
    this.render();
  }

  /**
   * 获取当前帧列表
   * @returns {Array<Object>}
   */
  getFrames() {
    return this.frames;
  }

  /**
   * 获取当前激活的帧对象
   * @returns {Object|null}
   */
  getCurrentFrame() {
    if (!this.frames || this.frames.length === 0) return null;
    return this.frames[this.currentFrameIndex] || null;
  }

  /**
   * 获取当前帧索引 (0-based)
   * @returns {number}
   */
  getCurrentFrameIndex() {
    return this.currentFrameIndex;
  }

  /**
   * 设置目标视口 Canvas
   * @param {HTMLCanvasElement|null} canvas 
   */
  setCanvas(canvas) {
    this.canvas = canvas;
    this.render();
  }

  /**
   * 设置原始图片资源
   * @param {HTMLImageElement|HTMLCanvasElement|null} img 
   */
  setSourceImage(img) {
    this.sourceImage = img;
    this.render();
  }

  // ================= 3. 播放控制引擎 (Play / Pause / Toggle) =================

  /**
   * 开始播放
   * @returns {boolean} 是否成功进入播放状态
   */
  play() {
    if (this.isPlaying) return true;
    if (!this.frames || this.frames.length === 0) return false;

    // 若当前为 once 模式且停在最后一帧，再次按播放则从头开始
    if (this.loopMode === 'once' && this.currentFrameIndex >= this.frames.length - 1) {
      this.currentFrameIndex = 0;
      this._notifyFrameChange();
      this.render();
    }

    // 若为 pingpong 模式且在边缘，设置正确的初始步进方向
    if (this.loopMode === 'pingpong') {
      if (this.currentFrameIndex >= this.frames.length - 1) {
        this.direction = -1;
      } else if (this.currentFrameIndex <= 0) {
        this.direction = 1;
      }
    }

    this.isPlaying = true;
    this._accumulator = 0;
    this._lastTime = this._now();

    if (this.onPlayStateChange) {
      this.onPlayStateChange(true);
    }

    this._startRAF();
    return true;
  }

  /**
   * 暂停播放
   * @returns {boolean} 暂停后的 isPlaying 状态 (false)
   */
  pause() {
    if (!this.isPlaying) return false;

    this.isPlaying = false;
    this._stopRAF();

    if (this.onPlayStateChange) {
      this.onPlayStateChange(false);
    }
    return false;
  }

  /**
   * 播放 / 暂停切换
   * @returns {boolean} 切换后的 isPlaying 状态
   */
  toggle() {
    return this.isPlaying ? this.pause() : this.play();
  }

  // ================= 4. 单步导航 (Step Navigation) =================

  /**
   * 步进至下一帧（若暂停则单步预览）
   */
  nextFrame() {
    if (!this.frames || this.frames.length === 0) return;
    const total = this.frames.length;
    if (total <= 1) {
      this.goToFrame(0);
      return;
    }

    if (this.loopMode === 'pingpong') {
      let next = this.currentFrameIndex + this.direction;
      if (next >= total) {
        this.direction = -1;
        next = Math.max(0, total - 2);
      } else if (next < 0) {
        this.direction = 1;
        next = Math.min(total - 1, 1);
      }
      this.goToFrame(next);
      return;
    }

    // loop 或 once 模式在单步手动操作时均支持顺向单步，到末尾循环回 0
    const nextIndex = (this.currentFrameIndex + 1) % total;
    this.goToFrame(nextIndex);
  }

  /**
   * 步退至上一帧
   */
  prevFrame() {
    if (!this.frames || this.frames.length === 0) return;
    const total = this.frames.length;
    if (total <= 1) {
      this.goToFrame(0);
      return;
    }

    if (this.loopMode === 'pingpong') {
      let prev = this.currentFrameIndex - this.direction;
      if (prev < 0) {
        this.direction = 1;
        prev = Math.min(total - 1, 1);
      } else if (prev >= total) {
        this.direction = -1;
        prev = Math.max(0, total - 2);
      }
      this.goToFrame(prev);
      return;
    }

    const prevIndex = (this.currentFrameIndex - 1 + total) % total;
    this.goToFrame(prevIndex);
  }

  /**
   * 快速定位至首帧
   */
  firstFrame() {
    this.direction = 1;
    this.goToFrame(0);
  }

  /**
   * 快速定位至最后一帧
   */
  lastFrame() {
    if (!this.frames || this.frames.length === 0) return;
    this.direction = -1;
    this.goToFrame(this.frames.length - 1);
  }

  /**
   * 跳转至指定索引帧 (安全钳制在合法范围内)
   * @param {number} index 
   */
  goToFrame(index) {
    if (!this.frames || this.frames.length === 0) {
      this.currentFrameIndex = 0;
      return;
    }

    const safeIndex = this._sanitizeIndex(index);
    if (this.currentFrameIndex !== safeIndex) {
      this.currentFrameIndex = safeIndex;
      this._notifyFrameChange();
      this.render();
    }
  }

  // ================= 5. 时间驱动引擎内部运作 (Time Accumulator) =================

  /**
   * 获取当前高精度时间戳 (ms)
   * @private
   */
  _now() {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
    return Date.now();
  }

  /**
   * 启动 requestAnimationFrame 调度
   * @private
   */
  _startRAF() {
    if (this._rafId) return;
    if (typeof requestAnimationFrame === 'function') {
      this._rafId = requestAnimationFrame(this._boundTick);
    }
  }

  /**
   * 停止 requestAnimationFrame 调度
   * @private
   */
  _stopRAF() {
    if (this._rafId) {
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this._rafId);
      }
      this._rafId = null;
    }
  }

  /**
   * rAF 逐帧主循环
   * @private
   */
  _tick(timestamp) {
    if (!this.isPlaying) {
      this._rafId = null;
      return;
    }

    const now = typeof timestamp === 'number' ? timestamp : this._now();
    const dt = now - this._lastTime;
    this._lastTime = now;

    this.advance(dt);

    if (this.isPlaying && typeof requestAnimationFrame === 'function') {
      this._rafId = requestAnimationFrame(this._boundTick);
    } else {
      this._rafId = null;
    }
  }

  /**
   * 时间推进方法 (公开接口，支持自动化测试与时间模拟)
   * 基于累加器机制，每累加达到 1000 / fps 毫秒时驱动下一帧切换
   * @param {number} deltaTimeMs 推进的时间差增量 (毫秒)
   */
  advance(deltaTimeMs) {
    if (!this.isPlaying || !this.frames || this.frames.length === 0) return;
    if (deltaTimeMs <= 0) return;

    // 防止因浏览器后台标签挂起导致的巨额 dt 暴走，限制单次上限为 1000ms
    const safeDt = Math.min(deltaTimeMs, 1000);
    this._accumulator += safeDt;

    const frameDuration = this.getFrameDuration();

    while (this._accumulator >= frameDuration) {
      this._accumulator -= frameDuration;
      const canContinue = this._stepPlayback();
      if (!canContinue) {
        // 模式（如 once）到达终点后自动暂停播放，清空累加器并跳出
        this._accumulator = 0;
        break;
      }
    }
  }

  /**
   * 播放模式推进逻辑 (loop / once / pingpong)
   * @private
   * @returns {boolean} 是否能够继续播放 (false 表示需终止播放)
   */
  _stepPlayback() {
    const total = this.frames.length;
    if (total <= 1) {
      if (this.loopMode === 'once') {
        this.pause();
        return false;
      }
      return true;
    }

    // 1. loop (循环模式)
    if (this.loopMode === 'loop') {
      this.currentFrameIndex = (this.currentFrameIndex + 1) % total;
      this._notifyFrameChange();
      this.render();
      return true;
    }

    // 2. once (单次模式：播放至最后一帧自动暂停)
    if (this.loopMode === 'once') {
      if (this.currentFrameIndex < total - 1) {
        this.currentFrameIndex++;
        this._notifyFrameChange();
        this.render();
        return true;
      } else {
        // 当前已是最后一帧，且已经历一个完整帧时长，触发自动暂停
        this.pause();
        return false;
      }
    }

    // 3. pingpong (往返乒乓模式：正向播到底后反向倒放回首帧)
    if (this.loopMode === 'pingpong') {
      let next = this.currentFrameIndex + this.direction;
      if (next >= total) {
        this.direction = -1;
        next = Math.max(0, total - 2);
      } else if (next < 0) {
        this.direction = 1;
        next = Math.min(total - 1, 1);
      }
      this.currentFrameIndex = next;
      this._notifyFrameChange();
      this.render();
      return true;
    }

    return true;
  }

  /**
   * 触发帧变化通知
   * @private
   */
  _notifyFrameChange() {
    if (this.onFrameChange) {
      try {
        this.onFrameChange(this.currentFrameIndex, this.getCurrentFrame());
      } catch (err) {
        console.error('[AnimationPlayer] Error in onFrameChange handler:', err);
      }
    }
  }

  // ================= 6. 视口居中渲染 (Viewport Centered Rendering) =================

  /**
   * 驱动视口 Canvas 按照该帧的 pivot 锚点和 offset 偏移进行居中平稳渲染
   * 绘制时优先使用经过 Task 4 交叉修复后的 frame.maskCanvas（若无则裁剪原图 frame.rect）
   * @param {HTMLCanvasElement} [targetCanvas=this.canvas] 
   * @param {Object} [options={}] 自定义绘制选项
   */
  render(targetCanvas = this.canvas, options = {}) {
    // 优先委托外部自定义渲染器 (如 frameAlignment.renderAlignmentStage)
    if (this.renderCustom && typeof this.renderCustom === 'function') {
      this.renderCustom(targetCanvas, this.getCurrentFrame(), this.frames, this.currentFrameIndex, this.sourceImage, options);
      return;
    }

    const canvas = targetCanvas || this.canvas;
    if (!canvas) return;

    const ctx = canvas.getContext ? canvas.getContext('2d') : null;
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 清空画布
    ctx.clearRect(0, 0, width, height);

    const frame = this.getCurrentFrame();
    if (!frame) return;

    const sourceImage = options.sourceImage || this.sourceImage;
    const rect = frame.rect || { x: 0, y: 0, w: 0, h: 0 };
    const w = rect.w || 0;
    const h = rect.h || 0;

    if (w <= 0 || h <= 0) return;

    // 锚点 (归一化 0~1) 与偏移微调
    const px = (frame.pivot && typeof frame.pivot.x === 'number') ? frame.pivot.x : 0.5;
    const py = (frame.pivot && typeof frame.pivot.y === 'number') ? frame.pivot.y : 1.0;
    const ox = frame.offset ? (frame.offset.x || 0) : 0;
    const oy = frame.offset ? (frame.offset.y || 0) : 0;

    const s = (typeof frame.scale === 'number' && !isNaN(frame.scale) && frame.scale > 0) ? frame.scale : 1.0;
    const renderW = Math.round(w * s);
    const renderH = Math.round(h * s);

    // 基准对齐点：水平居中，脚底基准线默认位于视口高度 82% 处
    const targetBaseX = options.targetBaseX !== undefined ? options.targetBaseX : Math.round(width / 2);
    const targetBaseY = options.targetBaseY !== undefined ? options.targetBaseY : Math.round(height * 0.82);

    // 计算实际绘制坐标
    const dx = targetBaseX - renderW * px + ox;
    const dy = targetBaseY - renderH * py + oy;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // 优先绘制经过交叉消除修复后的局部独立蒙版画布 frame.maskCanvas
    if (frame.maskCanvas) {
      ctx.drawImage(frame.maskCanvas, 0, 0, w, h, dx, dy, renderW, renderH);
    } else if (sourceImage) {
      ctx.drawImage(sourceImage, rect.x, rect.y, w, h, dx, dy, renderW, renderH);
    }

    ctx.restore();
  }

  /**
   * 销毁并清理资源
   */
  destroy() {
    this.pause();
    this.frames = [];
    this.canvas = null;
    this.sourceImage = null;
    this.onFrameChange = null;
    this.onPlayStateChange = null;
    this.renderCustom = null;
  }
}

export default AnimationPlayer;
