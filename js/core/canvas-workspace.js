/**
 * @file canvas-workspace.js
 * @description 交互式主工作区画布与自由选框控制器
 * 包含视口变换 (平移/缩放)、选框选中、8个手柄拉伸缩放、自由框选与键盘微调
 */

import { state, eventBus } from './state.js';
import { overlapIsolator } from './overlap-isolator.js';

export class CanvasWorkspace {
  /**
   * @param {HTMLCanvasElement} canvasElement 
   * @param {HTMLElement} containerElement 
   */
  constructor(canvasElement, containerElement) {
    this.canvas = canvasElement;
    this.container = containerElement;
    this.ctx = canvasElement.getContext('2d');

    // 交互操作状态
    this.isPanning = false;
    this.isResizing = false;
    this.isMovingBox = false;
    this.isCreatingBox = false;
    this.spacePressed = false;

    // 交叉消除专属工具交互状态
    this.isErasing = false;
    this.lastEraserLocalPos = null;
    this.lassoPoints = []; // 局部坐标 [{ x, y }]
    this.hoverScreenPos = null;
    this.hoverWorldPos = null;

    // 当前激活的缩放手柄 ('nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w')
    this.activeHandle = null;

    // 拖拽初始数据记录
    this.dragStartScreen = { x: 0, y: 0 };
    this.dragStartWorld = { x: 0, y: 0 };
    this.dragStartRect = null;
    this.createBoxStartWorld = { x: 0, y: 0 };
    this.createBoxCurrentWorld = { x: 0, y: 0 };

    // 手柄尺寸与碰撞阈值 (屏幕像素)
    this.handleSize = 8;
    this.handleHitRadius = 7;
    this.minBoxSize = 4;

    // 渲染调度控制
    this.renderRequested = false;

    // 监听回调
    this.onFrameRectChange = null; // (frameId, rect) => void
    this.onFrameModified = null; // (frameId) => void

    // 是否启用默认选框 rect 键盘微调 (上层应用可置 false 接管为帧 offset 对齐微调)
    this.enableRectNudge = true;

    this.init();
  }

  /**
   * 初始化画布与事件监听
   */
  init() {
    this.initResizeObserver();
    this.bindMouseEvents();
    this.bindKeyboardEvents();
    this.bindStateSubscriptions();

    // 首次渲染调度
    this.requestRender();
  }

  /**
   * 监听容器尺寸变化自适应物理分辨率
   */
  initResizeObserver() {
    if (!this.container) return;

    const resize = () => {
      const width = this.container.clientWidth;
      const height = this.container.clientHeight;
      if (width > 0 && height > 0) {
        if (this.canvas.width !== width || this.canvas.height !== height) {
          this.canvas.width = width;
          this.canvas.height = height;
          this.requestRender();
        }
      }
    };

    resize();

    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => resize());
      this.resizeObserver.observe(this.container);
    } else {
      window.addEventListener('resize', resize);
    }
  }

  /**
   * 绑定状态总线监听
   */
  bindStateSubscriptions() {
    state.subscribe('sourceImage', () => {
      this.fitToView();
    });

    state.subscribe('frames', () => {
      this.requestRender();
    });

    state.subscribe('selectedFrameId', () => {
      this.requestRender();
    });

    state.subscribe('currentTool', () => {
      this.updateCursor();
      this.requestRender();
    });

    state.subscribe('viewport', () => {
      this.requestRender();
    });
  }

  // ================= 坐标系统转换 =================

  /**
   * 屏幕坐标 (相对于 Canvas 元素左上角) 转换为 图像世界坐标
   * @param {number} sx 
   * @param {number} sy 
   * @returns {{x: number, y: number}}
   */
  screenToWorld(sx, sy) {
    const vp = state.get('viewport');
    return {
      x: (sx - vp.panX) / vp.zoom,
      y: (sy - vp.panY) / vp.zoom
    };
  }

  /**
   * 图像世界坐标转换为屏幕像素坐标
   * @param {number} wx 
   * @param {number} wy 
   * @returns {{x: number, y: number}}
   */
  worldToScreen(wx, wy) {
    const vp = state.get('viewport');
    return {
      x: wx * vp.zoom + vp.panX,
      y: wy * vp.zoom + vp.panY
    };
  }

  /**
   * 获取鼠标事件相对于画布的屏幕坐标
   * @param {MouseEvent} e 
   * @returns {{x: number, y: number}}
   */
  getEventScreenPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  // ================= 视口平移与缩放 (Pan & Zoom) =================

  /**
   * 以指定屏幕坐标为锚点进行缩放
   * @param {number} screenX 
   * @param {number} screenY 
   * @param {number} factor 缩放因子
   */
  zoomAt(screenX, screenY, factor) {
    const vp = state.get('viewport');
    const oldZoom = vp.zoom;
    const newZoom = Math.min(10.0, Math.max(0.05, oldZoom * factor));
    if (Math.abs(newZoom - oldZoom) < 0.0001) return;

    // 锚点对应的世界坐标保持屏幕位置不变
    const wx = (screenX - vp.panX) / oldZoom;
    const wy = (screenY - vp.panY) / oldZoom;

    const newPanX = screenX - wx * newZoom;
    const newPanY = screenY - wy * newZoom;

    state.setState({
      viewport: {
        zoom: newZoom,
        panX: newPanX,
        panY: newPanY
      }
    });
  }

  /**
   * 设置绝对缩放比例 (以画布中央为锚点)
   * @param {number} targetZoom 
   */
  setZoom(targetZoom) {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const vp = state.get('viewport');
    const factor = targetZoom / vp.zoom;
    this.zoomAt(cx, cy, factor);
  }

  /**
   * 放大视口 (以中心为锚点)
   * @param {number} ratio 
   */
  zoomIn(ratio = 1.25) {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    this.zoomAt(cx, cy, ratio);
  }

  /**
   * 缩小视口 (以中心为锚点)
   * @param {number} ratio 
   */
  zoomOut(ratio = 0.8) {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    this.zoomAt(cx, cy, ratio);
  }

  /**
   * 自适应居中视口 (Fit to View)
   */
  fitToView() {
    const img = state.get('sourceImage');
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    if (!img || !img.naturalWidth || !img.naturalHeight) {
      state.setState({
        viewport: { zoom: 1.0, panX: 0, panY: 0 }
      });
      return;
    }

    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const pad = 48; // 保留四周呼吸感内边距

    const scaleX = (cw - pad * 2) / iw;
    const scaleY = (ch - pad * 2) / ih;
    let targetZoom = Math.min(scaleX, scaleY);

    // 限制自适应时的初值范围
    targetZoom = Math.min(4.0, Math.max(0.1, targetZoom));

    const panX = Math.round((cw - iw * targetZoom) / 2);
    const panY = Math.round((ch - ih * targetZoom) / 2);

    state.setState({
      viewport: {
        zoom: targetZoom,
        panX,
        panY
      }
    });
  }

  /**
   * 重置缩放到 1:1 实际像素 (居中显示)
   */
  resetZoom() {
    const img = state.get('sourceImage');
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const iw = img ? img.naturalWidth : 0;
    const ih = img ? img.naturalHeight : 0;

    const panX = iw > 0 ? Math.round((cw - iw) / 2) : 0;
    const panY = ih > 0 ? Math.round((ch - ih) / 2) : 0;

    state.setState({
      viewport: {
        zoom: 1.0,
        panX,
        panY
      }
    });
  }

  // ================= 选框手柄与命中判定 =================

  /**
   * 获取某帧的 8 个缩放手柄世界坐标与光标类型
   * @param {Object} frame 
   * @returns {Object}
   */
  getHandles(frame) {
    const { x, y, w, h } = frame.rect;
    return {
      nw: { x, y, cursor: 'nwse-resize' },
      n:  { x: x + w / 2, y, cursor: 'ns-resize' },
      ne: { x: x + w, y, cursor: 'nesw-resize' },
      e:  { x: x + w, y: y + h / 2, cursor: 'ew-resize' },
      se: { x: x + w, y: y + h, cursor: 'nwse-resize' },
      s:  { x: x + w / 2, y: y + h, cursor: 'ns-resize' },
      sw: { x, y: y + h, cursor: 'nesw-resize' },
      w:  { x, y: y + h / 2, cursor: 'ew-resize' }
    };
  }

  /**
   * 检测屏幕坐标是否命中选中帧的手柄
   * @param {{x: number, y: number}} screenPos 
   * @param {Object} frame 
   * @returns {string|null} 命中的手柄标识符，若未命中则为 null
   */
  hitTestHandle(screenPos, frame) {
    if (!frame) return null;
    const handles = this.getHandles(frame);
    const radius = this.handleHitRadius;

    for (const [key, handle] of Object.entries(handles)) {
      const sp = this.worldToScreen(handle.x, handle.y);
      if (Math.abs(screenPos.x - sp.x) <= radius && Math.abs(screenPos.y - sp.y) <= radius) {
        return key;
      }
    }
    return null;
  }

  /**
   * 检测世界坐标是否在选框矩形内部
   * @param {{x: number, y: number}} worldPos 
   * @param {Object} frame 
   * @returns {boolean}
   */
  hitTestFrame(worldPos, frame) {
    if (!frame || !frame.rect) return false;
    const { x, y, w, h } = frame.rect;
    return (
      worldPos.x >= x &&
      worldPos.x <= x + w &&
      worldPos.y >= y &&
      worldPos.y <= y + h
    );
  }

  /**
   * 查找命中的选框（优先当前选中的选框，其次逆序寻找最上层选框）
   * @param {{x: number, y: number}} worldPos 
   * @returns {Object|null}
   */
  findHitFrame(worldPos) {
    const selectedFrame = state.getSelectedFrame();
    if (selectedFrame && this.hitTestFrame(worldPos, selectedFrame)) {
      return selectedFrame;
    }

    const frames = state.get('frames') || [];
    for (let i = frames.length - 1; i >= 0; i--) {
      if (this.hitTestFrame(worldPos, frames[i])) {
        return frames[i];
      }
    }
    return null;
  }

  // ================= 鼠标与交互事件绑定 =================

  bindMouseEvents() {
    // 滚轮无级缩放
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const pos = this.getEventScreenPos(e);
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      this.zoomAt(pos.x, pos.y, factor);
    }, { passive: false });

    // 鼠标按下
    this.canvas.addEventListener('mousedown', (e) => {
      this.handleMouseDown(e);
    });

    // 双击快速闭合套索
    this.canvas.addEventListener('dblclick', (e) => {
      this.handleDoubleClick(e);
    });

    // 全局鼠标移动与松开（防止移出画布时断开拖拽）
    window.addEventListener('mousemove', (e) => {
      this.handleMouseMove(e);
    });

    window.addEventListener('mouseup', (e) => {
      this.handleMouseUp(e);
    });

    // 右键菜单禁用防止遮挡
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  handleDoubleClick(e) {
    const currentTool = state.get('currentTool');
    const selectedFrame = state.getSelectedFrame();

    // 双击自动闭合多边形套索并执行裁切
    if (currentTool === 'lasso' && selectedFrame && this.lassoPoints.length >= 3) {
      overlapIsolator.initFrameCanvas(selectedFrame, state.get('sourceImage'));
      overlapIsolator.saveSnapshot(selectedFrame);
      overlapIsolator.applyPolygonLasso(selectedFrame, this.lassoPoints, true);
      this.lassoPoints = [];
      this.requestRender();
      if (this.onFrameModified) {
        this.onFrameModified(selectedFrame.id);
      }
    }
  }

  handleMouseDown(e) {
    const screenPos = this.getEventScreenPos(e);
    const worldPos = this.screenToWorld(screenPos.x, screenPos.y);
    const currentTool = state.get('currentTool');
    const selectedFrame = state.getSelectedFrame();

    // 1. 平移判断：按住鼠标中键 (button 1) 或 空格键 + 任意键 或 当前为 pan 工具
    if (e.button === 1 || this.spacePressed || currentTool === 'pan') {
      this.isPanning = true;
      this.dragStartScreen = { x: e.clientX, y: e.clientY };
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    // 只处理左键
    if (e.button !== 0) return;

    // 2. 当前处于创建选框模式 (create_box)
    if (currentTool === 'create_box') {
      this.isCreatingBox = true;
      this.createBoxStartWorld = { ...worldPos };
      this.createBoxCurrentWorld = { ...worldPos };
      this.requestRender();
      return;
    }

    // 3. 当前处于选择模式 (select)
    if (currentTool === 'select') {
      // 检查是否命中了当前激活选框的缩放手柄
      if (selectedFrame) {
        const hitHandle = this.hitTestHandle(screenPos, selectedFrame);
        if (hitHandle) {
          this.isResizing = true;
          this.activeHandle = hitHandle;
          this.dragStartWorld = { ...worldPos };
          this.dragStartRect = { ...selectedFrame.rect };
          return;
        }
      }

      // 检查是否命中了某个选框整体
      const hitFrame = this.findHitFrame(worldPos);
      if (hitFrame) {
        if (selectedFrame?.id !== hitFrame.id) {
          state.selectFrame(hitFrame.id);
        }
        this.isMovingBox = true;
        this.dragStartWorld = { ...worldPos };
        this.dragStartRect = { ...hitFrame.rect };
        this.canvas.style.cursor = 'move';
      } else {
        // 点击空白处取消当前选择
        state.selectFrame(null);
      }
      return;
    }

    // 4. 当前处于橡皮擦模式 (eraser)
    if (currentTool === 'eraser') {
      let targetFrame = selectedFrame;
      if (!targetFrame || !this.hitTestFrame(worldPos, targetFrame)) {
        const hitFrame = this.findHitFrame(worldPos);
        if (hitFrame) {
          state.selectFrame(hitFrame.id);
          targetFrame = hitFrame;
        }
      }

      if (targetFrame && this.hitTestFrame(worldPos, targetFrame)) {
        overlapIsolator.initFrameCanvas(targetFrame, state.get('sourceImage'));
        overlapIsolator.saveSnapshot(targetFrame);

        const lx = worldPos.x - targetFrame.rect.x;
        const ly = worldPos.y - targetFrame.rect.y;
        const brushSize = state.get('brushSize') || 10;

        overlapIsolator.applyEraser(targetFrame, lx, ly, brushSize, null, null);
        this.isErasing = true;
        this.lastEraserLocalPos = { x: lx, y: ly };
        this.requestRender();
        if (this.onFrameModified) {
          this.onFrameModified(targetFrame.id);
        }
      }
      return;
    }

    // 5. 当前处于多边形套索模式 (lasso)
    if (currentTool === 'lasso') {
      let targetFrame = selectedFrame;
      if (!targetFrame || !this.hitTestFrame(worldPos, targetFrame)) {
        const hitFrame = this.findHitFrame(worldPos);
        if (hitFrame) {
          state.selectFrame(hitFrame.id);
          targetFrame = hitFrame;
          this.lassoPoints = [];
        }
      }

      if (targetFrame && this.hitTestFrame(worldPos, targetFrame)) {
        overlapIsolator.initFrameCanvas(targetFrame, state.get('sourceImage'));
        const lx = worldPos.x - targetFrame.rect.x;
        const ly = worldPos.y - targetFrame.rect.y;
        this.lassoPoints.push({ x: lx, y: ly });
        this.requestRender();
      }
      return;
    }

    // 6. 当前处于魔棒去色模式 (wand)
    if (currentTool === 'wand') {
      let targetFrame = selectedFrame;
      if (!targetFrame || !this.hitTestFrame(worldPos, targetFrame)) {
        const hitFrame = this.findHitFrame(worldPos);
        if (hitFrame) {
          state.selectFrame(hitFrame.id);
          targetFrame = hitFrame;
        }
      }

      if (targetFrame && this.hitTestFrame(worldPos, targetFrame)) {
        overlapIsolator.initFrameCanvas(targetFrame, state.get('sourceImage'));
        overlapIsolator.saveSnapshot(targetFrame);

        const lx = worldPos.x - targetFrame.rect.x;
        const ly = worldPos.y - targetFrame.rect.y;
        const tolerance = state.get('tolerance') ?? 20;

        const modified = overlapIsolator.applyMagicWand(targetFrame, lx, ly, tolerance, true);
        if (modified) {
          this.requestRender();
          if (this.onFrameModified) {
            this.onFrameModified(targetFrame.id);
          }
        }
      }
      return;
    }
  }

  handleMouseMove(e) {
    const screenPos = this.getEventScreenPos(e);
    const worldPos = this.screenToWorld(screenPos.x, screenPos.y);

    this.hoverScreenPos = screenPos;
    this.hoverWorldPos = worldPos;

    // 1. 正在平移视口
    if (this.isPanning) {
      const dx = e.clientX - this.dragStartScreen.x;
      const dy = e.clientY - this.dragStartScreen.y;
      this.dragStartScreen = { x: e.clientX, y: e.clientY };

      const vp = state.get('viewport');
      state.setState({
        viewport: {
          ...vp,
          panX: vp.panX + dx,
          panY: vp.panY + dy
        }
      });
      return;
    }

    // 2. 正在调整手柄大小 (Resizing)
    if (this.isResizing && this.dragStartRect && this.activeHandle) {
      this.handleResizeMove(worldPos);
      return;
    }

    // 3. 正在移动选框 (Moving Box)
    if (this.isMovingBox && this.dragStartRect) {
      this.handleBoxMove(worldPos);
      return;
    }

    // 4. 正在新建拉框 (Creating Box)
    if (this.isCreatingBox) {
      this.createBoxCurrentWorld = { ...worldPos };
      this.requestRender();
      return;
    }

    // 5. 正在使用橡皮擦连续涂抹 (Erasing)
    if (this.isErasing && this.lastEraserLocalPos) {
      const selectedFrame = state.getSelectedFrame();
      if (selectedFrame) {
        const lx = worldPos.x - selectedFrame.rect.x;
        const ly = worldPos.y - selectedFrame.rect.y;
        const brushSize = state.get('brushSize') || 10;

        overlapIsolator.applyEraser(
          selectedFrame,
          lx,
          ly,
          brushSize,
          this.lastEraserLocalPos.x,
          this.lastEraserLocalPos.y
        );
        this.lastEraserLocalPos = { x: lx, y: ly };
        this.requestRender();
      }
      return;
    }

    // 6. 悬停状态：更新光标样式与底部坐标
    this.updateHoverState(screenPos, worldPos);

    // 若当前为橡皮擦或套索模式，请求重绘以刷新光圈/参考线
    const curTool = state.get('currentTool');
    if (curTool === 'eraser' || (curTool === 'lasso' && this.lassoPoints.length > 0)) {
      this.requestRender();
    }
  }

  handleMouseUp(e) {
    if (this.isPanning) {
      this.isPanning = false;
      this.updateCursor();
    }

    if (this.isResizing) {
      this.isResizing = false;
      this.activeHandle = null;
      this.dragStartRect = null;
      this.updateCursor();
    }

    if (this.isMovingBox) {
      this.isMovingBox = false;
      this.dragStartRect = null;
      this.updateCursor();
    }

    if (this.isCreatingBox) {
      this.isCreatingBox = false;
      this.finishCreatingBox();
      this.updateCursor();
    }

    if (this.isErasing) {
      this.isErasing = false;
      this.lastEraserLocalPos = null;
      const selectedFrame = state.getSelectedFrame();
      if (selectedFrame && this.onFrameModified) {
        this.onFrameModified(selectedFrame.id);
      }
      this.updateCursor();
    }
  }

  /**
   * 处理拖拽手柄缩放选框
   * @param {{x: number, y: number}} worldPos 
   */
  handleResizeMove(worldPos) {
    const selectedFrame = state.getSelectedFrame();
    if (!selectedFrame || !this.dragStartRect) return;

    const img = state.get('sourceImage');
    const imgW = img ? img.naturalWidth : Infinity;
    const imgH = img ? img.naturalHeight : Infinity;

    const startRect = this.dragStartRect;
    const initLeft = startRect.x;
    const initTop = startRect.y;
    const initRight = startRect.x + startRect.w;
    const initBottom = startRect.y + startRect.h;
    const minSize = this.minBoxSize;

    let l = initLeft;
    let t = initTop;
    let r = initRight;
    let b = initBottom;

    const curX = worldPos.x;
    const curY = worldPos.y;

    switch (this.activeHandle) {
      case 'nw':
        l = Math.max(0, Math.min(curX, initRight - minSize));
        t = Math.max(0, Math.min(curY, initBottom - minSize));
        break;
      case 'n':
        t = Math.max(0, Math.min(curY, initBottom - minSize));
        break;
      case 'ne':
        r = Math.min(imgW, Math.max(curX, initLeft + minSize));
        t = Math.max(0, Math.min(curY, initBottom - minSize));
        break;
      case 'e':
        r = Math.min(imgW, Math.max(curX, initLeft + minSize));
        break;
      case 'se':
        r = Math.min(imgW, Math.max(curX, initLeft + minSize));
        b = Math.min(imgH, Math.max(curY, initTop + minSize));
        break;
      case 's':
        b = Math.min(imgH, Math.max(curY, initTop + minSize));
        break;
      case 'sw':
        l = Math.max(0, Math.min(curX, initRight - minSize));
        b = Math.min(imgH, Math.max(curY, initTop + minSize));
        break;
      case 'w':
        l = Math.max(0, Math.min(curX, initRight - minSize));
        break;
    }

    const newRect = {
      x: Math.round(l),
      y: Math.round(t),
      w: Math.round(Math.max(minSize, r - l)),
      h: Math.round(Math.max(minSize, b - t))
    };

    state.updateFrame(selectedFrame.id, { rect: newRect });
    if (this.onFrameRectChange) {
      this.onFrameRectChange(selectedFrame.id, newRect);
    }
  }

  /**
   * 处理拖拽移动选框
   * @param {{x: number, y: number}} worldPos 
   */
  handleBoxMove(worldPos) {
    const selectedFrame = state.getSelectedFrame();
    if (!selectedFrame || !this.dragStartRect) return;

    const img = state.get('sourceImage');
    const imgW = img ? img.naturalWidth : Infinity;
    const imgH = img ? img.naturalHeight : Infinity;

    const dx = worldPos.x - this.dragStartWorld.x;
    const dy = worldPos.y - this.dragStartWorld.y;

    const targetX = this.dragStartRect.x + dx;
    const targetY = this.dragStartRect.y + dy;

    // 限制在原图内部
    const maxX = Math.max(0, imgW - this.dragStartRect.w);
    const maxY = Math.max(0, imgH - this.dragStartRect.h);

    const clampedX = Math.round(Math.max(0, Math.min(maxX, targetX)));
    const clampedY = Math.round(Math.max(0, Math.min(maxY, targetY)));

    const newRect = {
      ...this.dragStartRect,
      x: clampedX,
      y: clampedY
    };

    state.updateFrame(selectedFrame.id, { rect: newRect });
    if (this.onFrameRectChange) {
      this.onFrameRectChange(selectedFrame.id, newRect);
    }
  }

  /**
   * 结束拉框创建新 Frame
   */
  finishCreatingBox() {
    const img = state.get('sourceImage');
    const imgW = img ? img.naturalWidth : Infinity;
    const imgH = img ? img.naturalHeight : Infinity;

    const x1 = this.createBoxStartWorld.x;
    const y1 = this.createBoxStartWorld.y;
    const x2 = this.createBoxCurrentWorld.x;
    const y2 = this.createBoxCurrentWorld.y;

    const left = Math.round(Math.max(0, Math.min(x1, x2)));
    const top = Math.round(Math.max(0, Math.min(y1, y2)));
    const right = Math.round(Math.min(imgW, Math.max(x1, x2)));
    const bottom = Math.round(Math.min(imgH, Math.max(y1, y2)));

    const w = right - left;
    const h = bottom - top;

    // 过滤太小的无效误点击 (小于 4 像素)
    if (w >= this.minBoxSize && h >= this.minBoxSize) {
      state.addFrame({
        rect: { x: left, y: top, w, h }
      });
    }

    this.requestRender();
  }

  /**
   * 悬停光标与坐标提示更新
   * @param {{x: number, y: number}} screenPos 
   * @param {{x: number, y: number}} worldPos 
   */
  updateHoverState(screenPos, worldPos) {
    // 同步底部坐标指示
    const cursorPosEl = document.getElementById('cursor-pos-badge');
    if (cursorPosEl) {
      const img = state.get('sourceImage');
      const inBounds = img
        ? worldPos.x >= 0 && worldPos.x <= img.naturalWidth && worldPos.y >= 0 && worldPos.y <= img.naturalHeight
        : true;

      const px = Math.floor(worldPos.x);
      const py = Math.floor(worldPos.y);
      cursorPosEl.textContent = inBounds ? `X: ${px}, Y: ${py}` : `X: ${px}, Y: ${py} (超出)`;
    }

    this.updateCursor(screenPos, worldPos);
  }

  /**
   * 根据当前悬停位置与激活工具设置 Canvas 光标样式
   * @param {{x: number, y: number}} [screenPos] 
   * @param {{x: number, y: number}} [worldPos] 
   */
  updateCursor(screenPos, worldPos) {
    if (this.spacePressed || state.get('currentTool') === 'pan') {
      this.canvas.style.cursor = this.isPanning ? 'grabbing' : 'grab';
      return;
    }

    const currentTool = state.get('currentTool');
    if (currentTool === 'create_box' || currentTool === 'lasso' || currentTool === 'wand') {
      this.canvas.style.cursor = 'crosshair';
      return;
    }

    if (currentTool === 'eraser') {
      this.canvas.style.cursor = 'crosshair';
      return;
    }

    if (currentTool !== 'select') {
      this.canvas.style.cursor = 'default';
      return;
    }

    if (!screenPos || !worldPos) {
      this.canvas.style.cursor = 'default';
      return;
    }

    // select 模式下检测手柄
    const selectedFrame = state.getSelectedFrame();
    if (selectedFrame) {
      const hitHandle = this.hitTestHandle(screenPos, selectedFrame);
      if (hitHandle) {
        const handles = this.getHandles(selectedFrame);
        this.canvas.style.cursor = handles[hitHandle].cursor;
        return;
      }
    }

    // 检测当前选框内部移动光标
    if (selectedFrame && this.hitTestFrame(worldPos, selectedFrame)) {
      this.canvas.style.cursor = 'move';
      return;
    }

    // 检测其他选框手型光标
    if (this.findHitFrame(worldPos)) {
      this.canvas.style.cursor = 'pointer';
      return;
    }

    this.canvas.style.cursor = 'default';
  }

  // ================= 键盘快捷键监听 =================

  bindKeyboardEvents() {
    window.addEventListener('keydown', (e) => {
      // 忽略输入框内的快捷键
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // 1. 空格键抓手平移
      if (e.code === 'Space' && !this.spacePressed) {
        this.spacePressed = true;
        this.updateCursor();
        e.preventDefault();
        return;
      }

      // 2. 撤销 (Ctrl+Z) 与 重做 (Ctrl+Y / Ctrl+Shift+Z)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        const selectedFrame = state.getSelectedFrame();
        if (selectedFrame && overlapIsolator.canUndo(selectedFrame)) {
          e.preventDefault();
          overlapIsolator.undo(selectedFrame);
          this.requestRender();
          if (this.onFrameModified) {
            this.onFrameModified(selectedFrame.id);
          }
        }
        return;
      }

      if (
        ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z'))
      ) {
        const selectedFrame = state.getSelectedFrame();
        if (selectedFrame && overlapIsolator.canRedo(selectedFrame)) {
          e.preventDefault();
          overlapIsolator.redo(selectedFrame);
          this.requestRender();
          if (this.onFrameModified) {
            this.onFrameModified(selectedFrame.id);
          }
        }
        return;
      }

      // 3. 套索回车 (Enter) 闭合裁切与 Esc 取消
      if (e.key === 'Enter') {
        const currentTool = state.get('currentTool');
        const selectedFrame = state.getSelectedFrame();
        if (currentTool === 'lasso' && selectedFrame && this.lassoPoints.length >= 3) {
          e.preventDefault();
          overlapIsolator.initFrameCanvas(selectedFrame, state.get('sourceImage'));
          overlapIsolator.saveSnapshot(selectedFrame);
          overlapIsolator.applyPolygonLasso(selectedFrame, this.lassoPoints, true);
          this.lassoPoints = [];
          this.requestRender();
          if (this.onFrameModified) {
            this.onFrameModified(selectedFrame.id);
          }
        }
        return;
      }

      if (e.key === 'Escape') {
        if (this.lassoPoints.length > 0) {
          e.preventDefault();
          this.lassoPoints = [];
          this.requestRender();
        }
        return;
      }

      // 4. 删除选中帧 (Delete 或 Backspace)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selectedId = state.get('selectedFrameId');
        if (selectedId) {
          e.preventDefault();
          state.removeFrame(selectedId);
        }
        return;
      }

      // 5. 方向键微调位置 (↑ ↓ ← →)
      if (this.enableRectNudge && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const selectedFrame = state.getSelectedFrame();
        if (selectedFrame) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          const { x, y, w, h } = selectedFrame.rect;
          const img = state.get('sourceImage');
          const maxW = img ? img.naturalWidth : Infinity;
          const maxH = img ? img.naturalHeight : Infinity;

          let nx = x;
          let ny = y;

          if (e.key === 'ArrowLeft') nx -= step;
          if (e.key === 'ArrowRight') nx += step;
          if (e.key === 'ArrowUp') ny -= step;
          if (e.key === 'ArrowDown') ny += step;

          nx = Math.max(0, Math.min(maxW - w, nx));
          ny = Math.max(0, Math.min(maxH - h, ny));

          state.updateFrame(selectedFrame.id, {
            rect: { x: nx, y: ny, w, h }
          });
        }
        return;
      }

      // 6. 工具切换快捷键
      if (e.key === 'v' || e.key === 'V') {
        state.setCurrentTool('select');
      } else if (e.key === 'b' || e.key === 'B') {
        state.setCurrentTool('create_box');
      } else if (e.key === 'e' || e.key === 'E') {
        state.setCurrentTool('eraser');
      } else if (e.key === 'l' || e.key === 'L') {
        state.setCurrentTool('lasso');
      } else if (e.key === 'w' || e.key === 'W') {
        state.setCurrentTool('wand');
      } else if (e.key === '0') {
        this.fitToView();
      } else if (e.key === '1') {
        this.resetZoom();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.spacePressed = false;
        this.updateCursor();
      }
    });
  }

  // ================= 渲染系统 (Render Pipeline) =================

  /**
   * 触发重绘调度 (rAF 节流)
   */
  requestRender() {
    if (this.renderRequested) return;
    this.renderRequested = true;
    requestAnimationFrame(() => {
      this.renderRequested = false;
      this.render();
    });
  }

  /**
   * 绘制主视口内容
   */
  render() {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    if (!ctx || width <= 0 || height <= 0) return;

    // 清空画布
    ctx.clearRect(0, 0, width, height);

    const sourceImage = state.get('sourceImage');
    const vp = state.get('viewport');
    const { zoom, panX, panY } = vp;

    // 1. 绘制源精灵大图 (世界坐标系变换)
    if (sourceImage) {
      ctx.save();
      ctx.imageSmoothingEnabled = false; // 像素画保持边缘清晰
      ctx.translate(panX, panY);
      ctx.scale(zoom, zoom);

      ctx.drawImage(sourceImage, 0, 0);

      // 绘制已修整独立图层的棋盘格底板与修整后像素
      const allFrames = state.get('frames') || [];
      allFrames.forEach(frame => {
        if (frame.maskCanvas && frame.rect) {
          this.renderIsolatedFrameLayer(ctx, frame);
        }
      });

      // 绘制大图外轮廓边界虚线
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1 / zoom;
      ctx.strokeRect(0, 0, sourceImage.naturalWidth, sourceImage.naturalHeight);

      ctx.restore();
    }

    const frames = state.get('frames') || [];
    const selectedId = state.get('selectedFrameId');

    // 2. 绘制未选中的选框 (半透明浅蓝框)
    frames.forEach((frame, idx) => {
      if (frame.id === selectedId) return; // 选中的帧最后绘制在顶层
      this.renderUnselectedFrame(frame, idx);
    });

    // 3. 绘制当前选中的选框 (金黄色高亮与 8 个缩放手柄)
    const selectedFrame = frames.find(f => f.id === selectedId);
    if (selectedFrame) {
      const selectedIndex = frames.indexOf(selectedFrame);
      this.renderSelectedFrame(selectedFrame, selectedIndex);
    }

    // 4. 绘制正在拉取的新建选框预览
    if (this.isCreatingBox) {
      this.renderCreatingBoxPreview();
    }

    // 5. 绘制套索多边形正在编辑中的折线路径
    if (state.get('currentTool') === 'lasso' && this.lassoPoints.length > 0 && selectedFrame) {
      this.renderLassoPreview(selectedFrame);
    }

    // 6. 绘制橡皮擦圆形光圈光标
    if (state.get('currentTool') === 'eraser' && this.hoverScreenPos) {
      this.renderEraserCursorPreview();
    }
  }

  /**
   * 绘制已隔离图层的棋盘格透明底板与修整后像素
   * @param {CanvasRenderingContext2D} ctx 
   * @param {Object} frame 
   */
  renderIsolatedFrameLayer(ctx, frame) {
    const { x, y, w, h } = frame.rect;
    if (w <= 0 || h <= 0) return;

    ctx.save();
    // 绘制微型棋盘格
    const tileSize = 6;
    for (let py = y; py < y + h; py += tileSize) {
      for (let px = x; px < x + w; px += tileSize) {
        const tw = Math.min(tileSize, x + w - px);
        const th = Math.min(tileSize, y + h - py);
        const isDark = (Math.floor(px / tileSize) + Math.floor(py / tileSize)) % 2 === 0;
        ctx.fillStyle = isDark ? '#23262d' : '#2b2f38';
        ctx.fillRect(px, py, tw, th);
      }
    }

    // 绘制当前帧修整后的 maskCanvas
    try {
      ctx.drawImage(frame.maskCanvas, x, y, w, h);
    } catch (err) {}
    ctx.restore();
  }

  /**
   * 绘制套索折线参考线与顶点
   * @param {Object} frame 
   */
  renderLassoPreview(frame) {
    const ctx = this.ctx;
    if (!ctx || this.lassoPoints.length === 0) return;

    ctx.save();
    ctx.strokeStyle = '#4cc9f0';
    ctx.fillStyle = '#4cc9f0';
    ctx.lineWidth = 1.8;

    ctx.beginPath();
    this.lassoPoints.forEach((pt, index) => {
      const worldX = frame.rect.x + pt.x;
      const worldY = frame.rect.y + pt.y;
      const sp = this.worldToScreen(worldX, worldY);
      if (index === 0) {
        ctx.moveTo(sp.x, sp.y);
      } else {
        ctx.lineTo(sp.x, sp.y);
      }
    });

    if (this.hoverScreenPos) {
      ctx.lineTo(this.hoverScreenPos.x, this.hoverScreenPos.y);
    }
    ctx.stroke();

    // 绘制顶点圆点
    this.lassoPoints.forEach(pt => {
      const worldX = frame.rect.x + pt.x;
      const worldY = frame.rect.y + pt.y;
      const sp = this.worldToScreen(worldX, worldY);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    ctx.restore();
  }

  /**
   * 绘制橡皮擦圆形光圈光标
   */
  renderEraserCursorPreview() {
    const ctx = this.ctx;
    if (!ctx || !this.hoverScreenPos) return;

    const vp = state.get('viewport');
    const brushSize = state.get('brushSize') || 10;
    const screenRadius = Math.max(1, (brushSize * vp.zoom) / 2);

    ctx.save();
    ctx.beginPath();
    ctx.arc(this.hoverScreenPos.x, this.hoverScreenPos.y, screenRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(this.hoverScreenPos.x, this.hoverScreenPos.y, screenRadius, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * 绘制未选中的普通选框
   * @param {Object} frame 
   * @param {number} idx 
   */
  renderUnselectedFrame(frame, idx) {
    const ctx = this.ctx;
    const { x, y, w, h } = frame.rect;
    const sp = this.worldToScreen(x, y);
    const vp = state.get('viewport');
    const sw = w * vp.zoom;
    const sh = h * vp.zoom;

    ctx.save();
    // 半透明蓝色填充
    ctx.fillStyle = 'rgba(58, 134, 255, 0.08)';
    ctx.fillRect(sp.x, sp.y, sw, sh);

    // 边框
    ctx.strokeStyle = 'rgba(58, 134, 255, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sp.x, sp.y, sw, sh);

    // 序号角标
    const badgeText = `${idx + 1}`;
    ctx.font = '10px monospace';
    const textWidth = ctx.measureText(badgeText).width;
    const badgeH = 14;
    const badgeW = textWidth + 8;
    const badgeY = Math.max(0, sp.y - badgeH);

    ctx.fillStyle = 'rgba(58, 134, 255, 0.85)';
    ctx.fillRect(sp.x, badgeY, badgeW, badgeH);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(badgeText, sp.x + 4, badgeY + 10);

    // 绘制该帧内部对应的地面基准线与小锚点 (直观展示 Y 轴对齐高度)
    const pivot = frame.pivot || { x: 0.5, y: 1.0 };
    const ox = frame.offset?.x || 0;
    const oy = frame.offset?.y || 0;
    const pWorldX = x + w * pivot.x - ox;
    const pWorldY = y + h * pivot.y - oy;
    const pScreen = this.worldToScreen(pWorldX, pWorldY);

    if (pScreen.y >= sp.y && pScreen.y <= sp.y + sh) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 245, 212, 0.55)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(sp.x, pScreen.y);
      ctx.lineTo(sp.x + sw, pScreen.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#00f5d4';
      ctx.beginPath();
      ctx.arc(pScreen.x, pScreen.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * 绘制选中的活动选框 (高亮、准星与 8 个手柄)
   * @param {Object} frame 
   * @param {number} idx 
   */
  renderSelectedFrame(frame, idx) {
    const ctx = this.ctx;
    const { x, y, w, h } = frame.rect;
    const sp = this.worldToScreen(x, y);
    const vp = state.get('viewport');
    const sw = w * vp.zoom;
    const sh = h * vp.zoom;

    ctx.save();

    // 1. 金黄半透明高亮填充
    ctx.fillStyle = 'rgba(255, 209, 102, 0.16)';
    ctx.fillRect(sp.x, sp.y, sw, sh);

    // 2. 双色对比高亮边框 (确保在亮暗背景均清晰)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 3;
    ctx.strokeRect(sp.x, sp.y, sw, sh);

    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.strokeRect(sp.x, sp.y, sw, sh);

    // 3. 序号与尺寸标签
    const badgeText = `#${idx + 1} (${w}×${h})`;
    ctx.font = '11px monospace';
    const textWidth = ctx.measureText(badgeText).width;
    const badgeH = 16;
    const badgeW = textWidth + 10;
    const badgeY = Math.max(0, sp.y - badgeH);

    ctx.fillStyle = '#ffd166';
    ctx.fillRect(sp.x, badgeY, badgeW, badgeH);

    ctx.fillStyle = '#181820';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(badgeText, sp.x + 5, badgeY + 12);

    // 4. 锚点 (Pivot) 与地面基准线 (联动 offset.x / offset.y 实时反映脚底基准位置)
    const pivot = frame.pivot || { x: 0.5, y: 1.0 };
    const ox = frame.offset?.x || 0;
    const oy = frame.offset?.y || 0;
    const pWorldX = x + w * pivot.x - ox;
    const pWorldY = y + h * pivot.y - oy;
    const pScreen = this.worldToScreen(pWorldX, pWorldY);

    // 绘制穿过锚点的粉红色水平地面虚线
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 0, 110, 0.75)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(sp.x, pScreen.y);
    ctx.lineTo(sp.x + sw, pScreen.y);
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = '#ff006e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pScreen.x, pScreen.y, 5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(pScreen.x - 9, pScreen.y);
    ctx.lineTo(pScreen.x + 9, pScreen.y);
    ctx.moveTo(pScreen.x, pScreen.y - 9);
    ctx.lineTo(pScreen.x, pScreen.y + 9);
    ctx.stroke();

    // 5. 绘制 8 个缩放手柄
    const handles = this.getHandles(frame);
    const size = this.handleSize;
    const half = size / 2;

    for (const [key, handle] of Object.entries(handles)) {
      const hScreen = this.worldToScreen(handle.x, handle.y);

      // 白色实心正方形手柄，深色描边
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(hScreen.x - half, hScreen.y - half, size, size);

      ctx.strokeStyle = '#181820';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(hScreen.x - half, hScreen.y - half, size, size);
    }

    ctx.restore();
  }

  /**
   * 绘制拉框创建过程中的预览矩形
   */
  renderCreatingBoxPreview() {
    const ctx = this.ctx;
    const x1 = this.createBoxStartWorld.x;
    const y1 = this.createBoxStartWorld.y;
    const x2 = this.createBoxCurrentWorld.x;
    const y2 = this.createBoxCurrentWorld.y;

    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);

    const sp = this.worldToScreen(left, top);
    const vp = state.get('viewport');
    const sw = w * vp.zoom;
    const sh = h * vp.zoom;

    ctx.save();
    // 青蓝色虚线边框与半透明填充
    ctx.fillStyle = 'rgba(76, 201, 240, 0.15)';
    ctx.fillRect(sp.x, sp.y, sw, sh);

    ctx.strokeStyle = '#4cc9f0';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(sp.x, sp.y, sw, sh);
    ctx.setLineDash([]);

    // 尺寸信息提示
    const infoText = `${Math.round(w)} × ${Math.round(h)}`;
    ctx.font = '10px monospace';
    const tw = ctx.measureText(infoText).width;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(sp.x + sw + 4, sp.y + sh - 16, tw + 8, 16);
    ctx.fillStyle = '#4cc9f0';
    ctx.fillText(infoText, sp.x + sw + 8, sp.y + sh - 4);

    ctx.restore();
  }
}

export default CanvasWorkspace;
