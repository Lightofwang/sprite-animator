/**
 * @file test_canvas_workspace.js
 * @description CanvasWorkspace 单元测试与交互逻辑验证套件
 * 可通过 node tests/test_canvas_workspace.js 运行
 */

// 1. 设置轻量 Mock DOM 环境以便在 Node.js 中执行
const listeners = new Map();
globalThis.window = {
  addEventListener(event, handler) {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event).push(handler);
  },
  removeEventListener(event, handler) {
    if (listeners.has(event)) {
      listeners.set(event, listeners.get(event).filter(h => h !== handler));
    }
  },
  dispatchEvent(event) {
    const handlers = listeners.get(event.type) || [];
    handlers.forEach(h => h(event));
  }
};

globalThis.document = {
  getElementById(id) {
    return {
      id,
      textContent: '',
      style: {}
    };
  }
};

globalThis.requestAnimationFrame = (callback) => {
  return setTimeout(callback, 0);
};

// 模拟 Canvas 元素与 2D 上下文
class MockCanvasContext {
  clearRect() {}
  save() {}
  restore() {}
  drawImage() {}
  translate() {}
  scale() {}
  strokeRect() {}
  fillRect() {}
  beginPath() {}
  arc() {}
  stroke() {}
  moveTo() {}
  lineTo() {}
  setLineDash() {}
  fillText() {}
  measureText(text) {
    return { width: text.length * 7 };
  }
}

class MockElement {
  constructor(width = 800, height = 600) {
    this.clientWidth = width;
    this.clientHeight = height;
    this.width = width;
    this.height = height;
    this.style = {};
    this.eventListeners = new Map();
  }

  getContext(type) {
    return new MockCanvasContext();
  }

  getBoundingClientRect() {
    return {
      left: 100,
      top: 50,
      width: this.width,
      height: this.height,
      right: 100 + this.width,
      bottom: 50 + this.height
    };
  }

  addEventListener(event, handler) {
    if (!this.eventListeners.has(event)) this.eventListeners.set(event, []);
    this.eventListeners.get(event).push(handler);
  }

  removeEventListener(event, handler) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.set(event, this.eventListeners.get(event).filter(h => h !== handler));
    }
  }

  trigger(event, data = {}) {
    const handlers = this.eventListeners.get(event) || [];
    const eventObj = {
      type: event,
      clientX: (data.x || 0) + 100,
      clientY: (data.y || 0) + 50,
      button: data.button ?? 0,
      deltaY: data.deltaY ?? 0,
      preventDefault: () => {},
      stopPropagation: () => {},
      ...data
    };
    handlers.forEach(h => h(eventObj));
  }
}

// 引入被测模块
import { CanvasWorkspace } from '../js/core/canvas-workspace.js';
import { state } from '../js/core/state.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${message}`);
    passed++;
  } else {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${message}`);
    failed++;
  }
}

function assertClose(actual, expected, message, precision = 0.001) {
  if (Math.abs(actual - expected) <= precision) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${message}`);
    passed++;
  } else {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${message}\n      期望: ${expected}, 实际: ${actual}`);
    failed++;
  }
}

console.log('\n======================================================');
console.log('🧪 开始运行 CanvasWorkspace 视口与自由选框测试套件');
console.log('======================================================\n');

const mockContainer = new MockElement(800, 600);
const mockCanvas = new MockElement(800, 600);

const workspace = new CanvasWorkspace(mockCanvas, mockContainer);

// ----------------------------------------------------
// 测试组 1: 屏幕坐标与世界坐标转换 (Screen <-> World)
// ----------------------------------------------------
console.log('▶ [测试组 1] 坐标变换互逆性与平移缩放数学验证:');

{
  // 设置视口状态：zoom = 2.0, panX = 100, panY = 50
  state.setState({
    viewport: { zoom: 2.0, panX: 100, panY: 50 }
  });

  const worldPt = { x: 50, y: 30 };
  const screenPt = workspace.worldToScreen(worldPt.x, worldPt.y);
  assertClose(screenPt.x, 200, 'World (50, 30) -> Screen X 对应 50 * 2 + 100 = 200');
  assertClose(screenPt.y, 110, 'World (50, 30) -> Screen Y 对应 30 * 2 + 50 = 110');

  const backWorld = workspace.screenToWorld(screenPt.x, screenPt.y);
  assertClose(backWorld.x, 50, '反变换 Screen (200, 110) -> World X 回归 50');
  assertClose(backWorld.y, 30, '反变换 Screen (200, 110) -> World Y 回归 30');
}

// ----------------------------------------------------
// 测试组 2: 锚点缩放 (Zoom at Point)
// ----------------------------------------------------
console.log('\n▶ [测试组 2] 鼠标光标为锚点的平滑缩放验证:');

{
  state.setState({
    viewport: { zoom: 1.0, panX: 0, panY: 0 }
  });

  // 鼠标在屏幕 (200, 150) 处滚动滚轮放大 2 倍
  const mouseScreenX = 200;
  const mouseScreenY = 150;
  const targetWorldBefore = workspace.screenToWorld(mouseScreenX, mouseScreenY);

  workspace.zoomAt(mouseScreenX, mouseScreenY, 2.0);

  const vp = state.get('viewport');
  assertClose(vp.zoom, 2.0, '视口缩放比例更新为 2.0x');
  
  const targetWorldAfter = workspace.screenToWorld(mouseScreenX, mouseScreenY);
  assertClose(targetWorldAfter.x, targetWorldBefore.x, '鼠标所在屏幕点的世界 X 坐标在缩放后保持不变');
  assertClose(targetWorldAfter.y, targetWorldBefore.y, '鼠标所在屏幕点的世界 Y 坐标在缩放后保持不变');
}

// ----------------------------------------------------
// 测试组 3: 自适应屏幕居中 (fitToView) 与 重置 (resetZoom)
// ----------------------------------------------------
console.log('\n▶ [测试组 3] fitToView 与 resetZoom 视口居中算法:');

{
  // 模拟图像 400x300, 画布 800x600, 内边距 48
  state.setState({
    sourceImage: { naturalWidth: 400, naturalHeight: 300 }
  });

  workspace.fitToView();
  const vpFit = state.get('viewport');
  assert(vpFit.zoom > 0 && vpFit.zoom <= 4.0, `fitToView 缩放计算合理: ${vpFit.zoom.toFixed(2)}x`);
  assert(vpFit.panX > 0 && vpFit.panY > 0, `fitToView 画面平移居中: panX=${vpFit.panX}, panY=${vpFit.panY}`);

  workspace.resetZoom();
  const vpReset = state.get('viewport');
  assertClose(vpReset.zoom, 1.0, 'resetZoom 恢复 1.0x 原始像素');
  assertClose(vpReset.panX, (800 - 400) / 2, 'resetZoom 水平居中到 (800 - 400)/2 = 200');
  assertClose(vpReset.panY, (600 - 300) / 2, 'resetZoom 垂直居中到 (600 - 300)/2 = 150');
}

// ----------------------------------------------------
// 测试组 4: 8 个手柄的生成与碰撞命中测试 (Hit Testing)
// ----------------------------------------------------
console.log('\n▶ [测试组 4] 选框 8 个缩放手柄的计算与命中测试:');

{
  const frame = {
    id: 'test_f1',
    rect: { x: 100, y: 100, w: 200, h: 100 }
  };

  const handles = workspace.getHandles(frame);
  assert(handles.nw && handles.se && handles.n && handles.s && handles.e && handles.w, '正确生成 8 个手柄数据结构');
  assertClose(handles.nw.x, 100, 'nw 左上手柄 X 坐标正确');
  assertClose(handles.nw.y, 100, 'nw 左上手柄 Y 坐标正确');
  assertClose(handles.se.x, 300, 'se 右下手柄 X 坐标正确');
  assertClose(handles.se.y, 200, 'se 右下手柄 Y 坐标正确');
  assertClose(handles.n.x, 200, 'n 中上手柄 X 坐标正确');

  // 将视口重置为 1.0 且 pan=(0,0)
  state.setState({
    viewport: { zoom: 1.0, panX: 0, panY: 0 }
  });

  const hitNW = workspace.hitTestHandle({ x: 100, y: 100 }, frame);
  assert(hitNW === 'nw', `准确命中 nw 手柄: 实际命中=${hitNW}`);

  const hitSE = workspace.hitTestHandle({ x: 302, y: 198 }, frame);
  assert(hitSE === 'se', `容差范围内命中 se 手柄: 实际命中=${hitSE}`);

  const hitNone = workspace.hitTestHandle({ x: 50, y: 50 }, frame);
  assert(hitNone === null, '手柄外部不误判命中');

  const inBox = workspace.hitTestFrame({ x: 150, y: 150 }, frame);
  assert(inBox === true, '正确检测选框内部');

  const outBox = workspace.hitTestFrame({ x: 50, y: 50 }, frame);
  assert(outBox === false, '正确检测选框外部');
}

// ----------------------------------------------------
// 测试组 5: 8 个手柄的缩放拉伸行为验证
// ----------------------------------------------------
console.log('\n▶ [测试组 5] 拖拽 8 个手柄拉伸缩放及边界保护:');

{
  state.setState({
    sourceImage: { naturalWidth: 500, naturalHeight: 500 },
    frames: [{
      id: 'frame_resize',
      rect: { x: 100, y: 100, w: 100, h: 100 },
      pivot: { x: 0.5, y: 1.0 }
    }],
    selectedFrameId: 'frame_resize'
  });

  // 测试 5.1: 拖拽 'se' (右下角手柄) 扩大
  workspace.isResizing = true;
  workspace.activeHandle = 'se';
  workspace.dragStartRect = { x: 100, y: 100, w: 100, h: 100 };
  workspace.handleResizeMove({ x: 250, y: 260 });

  let updatedFrame = state.getSelectedFrame();
  assertClose(updatedFrame.rect.w, 150, '拖拽 se 手柄增大宽度至 150 (250 - 100)');
  assertClose(updatedFrame.rect.h, 160, '拖拽 se 手柄增大高度至 160 (260 - 100)');
  assertClose(updatedFrame.rect.x, 100, '拖拽 se 时左上角 X 保持固定在 100');
  assertClose(updatedFrame.rect.y, 100, '拖拽 se 时左上角 Y 保持固定在 100');

  // 测试 5.2: 拖拽 'nw' (左上角手柄)
  workspace.activeHandle = 'nw';
  workspace.dragStartRect = { x: 100, y: 100, w: 150, h: 160 }; // 右下角在 (250, 260)
  workspace.handleResizeMove({ x: 80, y: 70 });

  updatedFrame = state.getSelectedFrame();
  assertClose(updatedFrame.rect.x, 80, '拖拽 nw 手柄新左上角 X 为 80');
  assertClose(updatedFrame.rect.y, 70, '拖拽 nw 手柄新左上角 Y 为 70');
  assertClose(updatedFrame.rect.w, 170, '拖拽 nw 宽度自动拓展至 250 - 80 = 170');
  assertClose(updatedFrame.rect.h, 190, '拖拽 nw 高度自动拓展至 260 - 70 = 190');

  // 测试 5.3: 防止超出图片边界
  workspace.activeHandle = 'nw';
  workspace.dragStartRect = { x: 80, y: 70, w: 170, h: 190 };
  workspace.handleResizeMove({ x: -100, y: -50 }); // 鼠标拖出图像外负值

  updatedFrame = state.getSelectedFrame();
  assertClose(updatedFrame.rect.x, 0, '左边界超出时自动限制在图像内部 X = 0');
  assertClose(updatedFrame.rect.y, 0, '顶边界超出时自动限制在图像内部 Y = 0');

  workspace.isResizing = false;
  workspace.activeHandle = null;
  workspace.dragStartRect = null;
}

// ----------------------------------------------------
// 测试组 6: 移动选框 (Move Box)
// ----------------------------------------------------
console.log('\n▶ [测试组 6] 选框整体移动与边界约束:');

{
  state.setState({
    sourceImage: { naturalWidth: 400, naturalHeight: 400 },
    frames: [{
      id: 'frame_move',
      rect: { x: 50, y: 50, w: 100, h: 100 }
    }],
    selectedFrameId: 'frame_move'
  });

  workspace.isMovingBox = true;
  workspace.dragStartWorld = { x: 60, y: 60 };
  workspace.dragStartRect = { x: 50, y: 50, w: 100, h: 100 };

  // 移动 dx = 40, dy = 30
  workspace.handleBoxMove({ x: 100, y: 90 });
  let movedFrame = state.getSelectedFrame();
  assertClose(movedFrame.rect.x, 90, '选框平移后 X 坐标从 50 更新为 90 (50 + 40)');
  assertClose(movedFrame.rect.y, 80, '选框平移后 Y 坐标从 50 更新为 80 (50 + 30)');

  // 移出边界限制测试 (右边界超出 400)
  workspace.handleBoxMove({ x: 500, y: 500 });
  movedFrame = state.getSelectedFrame();
  assertClose(movedFrame.rect.x, 300, '选框移动至右边界时限制为 400 - 100 = 300');
  assertClose(movedFrame.rect.y, 300, '选框移动至底边界时限制为 400 - 100 = 300');

  workspace.isMovingBox = false;
}

// ----------------------------------------------------
// 测试组 7: 新建框选 (Create Box 模式)
// ----------------------------------------------------
console.log('\n▶ [测试组 7] create_box 模式拉框创建新帧:');

{
  state.setState({
    sourceImage: { naturalWidth: 600, naturalHeight: 600 },
    frames: [],
    selectedFrameId: null,
    currentTool: 'create_box'
  });

  // 模拟从 (120, 80) 拖拽到 (200, 160)
  workspace.createBoxStartWorld = { x: 120, y: 80 };
  workspace.createBoxCurrentWorld = { x: 200, y: 160 };
  workspace.finishCreatingBox();

  const frames = state.get('frames');
  assert(frames.length === 1, '拉框松开后成功创建 1 个新 Frame');
  assertClose(frames[0].rect.x, 120, '新建选框 X = 120');
  assertClose(frames[0].rect.y, 80, '新建选框 Y = 80');
  assertClose(frames[0].rect.w, 80, '新建选框 W = 80 (200 - 120)');
  assertClose(frames[0].rect.h, 80, '新建选框 H = 80 (160 - 80)');
  assert(state.get('selectedFrameId') === frames[0].id, '新建选框被自动设为激活选中项');

  // 误触极小框 (< 4px) 过滤测试
  workspace.createBoxStartWorld = { x: 50, y: 50 };
  workspace.createBoxCurrentWorld = { x: 52, y: 51 };
  workspace.finishCreatingBox();
  assert(state.get('frames').length === 1, '小于 4px 的误点击不会创建噪点选框');
}

// ----------------------------------------------------
// 测试组 8: 键盘快捷键微调与删除
// ----------------------------------------------------
console.log('\n▶ [测试组 8] 键盘微调方向键与 Delete/Backspace 删除:');

{
  const frameToNudge = state.get('frames')[0];
  const initialX = frameToNudge.rect.x;
  const initialY = frameToNudge.rect.y;

  // 触发方向键右移
  window.dispatchEvent({ type: 'keydown', key: 'ArrowRight', target: { tagName: 'DIV' }, preventDefault: () => {} });
  let nudged = state.getSelectedFrame();
  assertClose(nudged.rect.x, initialX + 1, 'ArrowRight 步进 1 像素右移');

  // 触发 Shift + 方向键下移 10 像素
  window.dispatchEvent({ type: 'keydown', key: 'ArrowDown', shiftKey: true, target: { tagName: 'DIV' }, preventDefault: () => {} });
  nudged = state.getSelectedFrame();
  assertClose(nudged.rect.y, initialY + 10, 'Shift + ArrowDown 快速步进 10 像素下移');

  // 触发 Delete 键删除该选框
  window.dispatchEvent({ type: 'keydown', key: 'Delete', target: { tagName: 'DIV' }, preventDefault: () => {} });
  assert(state.get('frames').length === 0, '按 Delete 键成功删除当前选中 Frame');
  assert(state.get('selectedFrameId') === null, '删除后选中 ID 清空');
}

// ----------------------------------------------------
// 测试总结汇报
// ----------------------------------------------------
console.log('\n======================================================');
console.log(`🏁 测试完成: 共通过 \x1b[32m${passed}\x1b[0m 项, 失败 \x1b[31m${failed}\x1b[0m 项`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
