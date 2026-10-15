/**
 * @file state.js
 * @description 全局核心响应式状态对象与事件总线 (PubSub)
 */

class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * 订阅事件
   * @param {string} event 
   * @param {Function} handler 
   * @returns {Function} 取消订阅函数
   */
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  /**
   * 取消订阅
   * @param {string} event 
   * @param {Function} handler 
   */
  off(event, handler) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(handler);
      if (this.listeners.get(event).size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * 触发事件
   * @param {string} event 
   * @param {*} data 
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (err) {
          console.error(`[EventBus] Error in event '${event}' handler:`, err);
        }
      });
    }
  }
}

/**
 * 全局状态管理类
 */
class StateStore {
  constructor() {
    this.bus = new EventBus();

    // 状态定义
    this._state = {
      // 原始图像资源
      sourceImage: null,
      imageMetadata: {
        name: '',
        width: 0,
        height: 0,
        naturalWidth: 0,
        naturalHeight: 0
      },

      // 序列帧数组
      // Frame 对象结构:
      // {
      //   id: string,
      //   name: string,
      //   rect: { x: number, y: number, w: number, h: number },
      //   offset: { x: number, y: number },
      //   pivot: { x: number, y: number }, // 相对自身尺寸的归一化锚点 (0~1)
      //   maskCanvas: HTMLCanvasElement | null,
      //   customPixels: ImageData | Uint8ClampedArray | null,
      //   duration: number
      // }
      frames: [],

      // 当前选中的帧 ID
      selectedFrameId: null,

      // 当前激活工具
      // 'select' | 'create_box' | 'eraser' | 'lasso' | 'wand' | 'pan'
      currentTool: 'select',

      // 橡皮擦笔刷粗细 (像素)
      brushSize: 10,

      // 魔棒/抠图容差 (0~255)
      tolerance: 20,

      // 工作区画布视口变换
      viewport: {
        zoom: 1.0,
        panX: 0,
        panY: 0
      },

      // 实时动画播放器状态
      playerState: {
        isPlaying: false,
        fps: 12,
        currentFrameIndex: 0,
        loopMode: 'loop', // 'loop' | 'once' | 'pingpong'
        onionSkin: false,
        onionSkinOpacity: 0.30,
        ghostOverlay: false,
        showGround: true,
        showPivot: true,
        zoom: 'auto',
        viewportScaleMode: 'auto'
      }
    };
  }

  /**
   * 获取当前状态快照（只读浅副本）
   */
  getState() {
    return this._state;
  }

  /**
   * 获取指定 key 的状态
   * @param {string} key 
   */
  get(key) {
    return this._state[key];
  }

  /**
   * 订阅状态变化
   * @param {string} key 字段名，或 '*' 监听所有变更
   * @param {Function} callback (newValue, oldValue, key) => void
   * @returns {Function} 取消订阅函数
   */
  subscribe(key, callback) {
    return this.bus.on(`state:${key}`, callback);
  }

  /**
   * 更新局部状态并通知订阅者
   * @param {Object} partialState 
   */
  setState(partialState) {
    if (!partialState || typeof partialState !== 'object') return;

    const changes = {};
    for (const key of Object.keys(partialState)) {
      const oldValue = this._state[key];
      const newValue = partialState[key];

      // 特殊处理嵌套对象如 playerState, viewport, imageMetadata 的浅合并
      if (
        typeof newValue === 'object' && 
        newValue !== null && 
        !Array.isArray(newValue) && 
        !(typeof HTMLElement !== 'undefined' && newValue instanceof HTMLElement) &&
        typeof oldValue === 'object' && 
        oldValue !== null
      ) {
        this._state[key] = { ...oldValue, ...newValue };
      } else {
        this._state[key] = newValue;
      }

      changes[key] = { oldValue, newValue: this._state[key] };
      this.bus.emit(`state:${key}`, this._state[key], oldValue);
    }

    // 触发全局通配符变更通知
    this.bus.emit('state:*', this._state, changes);
  }

  // ================= 快捷辅助方法 =================

  /**
   * 添加新帧
   * @param {Object} frameData 
   * @returns {Object} 添加的完整帧对象
   */
  addFrame(frameData = {}) {
    const id = frameData.id || `frame_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const index = this._state.frames.length + 1;
    const newFrame = {
      id,
      name: frameData.name || `帧 ${index}`,
      rect: frameData.rect ? { ...frameData.rect } : { x: 0, y: 0, w: 64, h: 64 },
      offset: frameData.offset ? { ...frameData.offset } : { x: 0, y: 0 },
      pivot: frameData.pivot ? { ...frameData.pivot } : { x: 0.5, y: 1.0 }, // 默认脚底水平居中
      scale: (typeof frameData.scale === 'number' && !isNaN(frameData.scale) && frameData.scale > 0) ? frameData.scale : 1.0, // 缩放比例，默认 1.0
      maskCanvas: frameData.maskCanvas || null,
      customPixels: frameData.customPixels || null,
      duration: frameData.duration || Math.round(1000 / this._state.playerState.fps)
    };

    const newFrames = [...this._state.frames, newFrame];
    this.setState({
      frames: newFrames,
      selectedFrameId: newFrame.id
    });
    this.bus.emit('frames:add', newFrame);
    return newFrame;
  }

  /**
   * 更新指定帧
   * @param {string} id 
   * @param {Object} partialFrame 
   */
  updateFrame(id, partialFrame) {
    const frameIndex = this._state.frames.findIndex(f => f.id === id);
    if (frameIndex === -1) return null;

    const oldFrame = this._state.frames[frameIndex];
    const updatedFrame = { ...oldFrame, ...partialFrame };
    const newFrames = [...this._state.frames];
    newFrames[frameIndex] = updatedFrame;

    this.setState({ frames: newFrames });
    this.bus.emit('frames:update', updatedFrame);
    return updatedFrame;
  }

  /**
   * 删除指定帧
   * @param {string} id 
   */
  removeFrame(id) {
    const frameIndex = this._state.frames.findIndex(f => f.id === id);
    if (frameIndex === -1) return;

    const removed = this._state.frames[frameIndex];
    const newFrames = this._state.frames.filter(f => f.id !== id);

    let nextSelectedId = this._state.selectedFrameId;
    if (this._state.selectedFrameId === id) {
      if (newFrames.length > 0) {
        const nextIndex = Math.min(frameIndex, newFrames.length - 1);
        nextSelectedId = newFrames[nextIndex].id;
      } else {
        nextSelectedId = null;
      }
    }

    this.setState({
      frames: newFrames,
      selectedFrameId: nextSelectedId
    });
    this.bus.emit('frames:remove', removed);
  }

  /**
   * 交换/重排序帧
   * @param {number} fromIndex 
   * @param {number} toIndex 
   */
  reorderFrames(fromIndex, toIndex) {
    const frames = [...this._state.frames];
    if (
      fromIndex < 0 || fromIndex >= frames.length ||
      toIndex < 0 || toIndex >= frames.length
    ) {
      return;
    }
    const [moved] = frames.splice(fromIndex, 1);
    frames.splice(toIndex, 0, moved);
    this.setState({ frames });
    this.bus.emit('frames:reorder', frames);
  }

  /**
   * 选中指定帧
   * @param {string|null} id 
   */
  selectFrame(id) {
    if (this._state.selectedFrameId !== id) {
      this.setState({ selectedFrameId: id });
      this.bus.emit('frames:select', id);
    }
  }

  /**
   * 获取当前选中的帧对象
   */
  getSelectedFrame() {
    if (!this._state.selectedFrameId) return null;
    return this._state.frames.find(f => f.id === this._state.selectedFrameId) || null;
  }

  /**
   * 设置当前选框工具
   * @param {string} tool 
   */
  setCurrentTool(tool) {
    this.setState({ currentTool: tool });
    this.bus.emit('tool:change', tool);
  }

  /**
   * 更新播放器状态
   * @param {Object} partialPlayerState 
   */
  setPlayerState(partialPlayerState) {
    this.setState({
      playerState: {
        ...this._state.playerState,
        ...partialPlayerState
      }
    });
  }
}

// 导出单例
export const state = new StateStore();
export const eventBus = state.bus;
export default state;
