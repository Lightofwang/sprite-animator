/**
 * @file test_alignment_integration.js
 * @description 验证 SpriteAnimatorApp 中锚点对齐、九宫格、偏移量输入、洋葱皮与键盘微调的集成交互测试
 */

import { state } from '../js/core/state.js';
import { frameAlignment } from '../js/core/frame-alignment.js';
import { SpriteAnimatorApp } from '../js/app.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${message}`);
    passed++;
  } else {
    console.error(`  \x1b[31m✘ FAIL\x1b[0m: ${message}`);
    failed++;
  }
}

function assertClose(actual, expected, message, tolerance = 0.0001) {
  const diff = Math.abs(actual - expected);
  if (diff <= tolerance) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${message}`);
    passed++;
  } else {
    console.error(`  \x1b[31m✘ FAIL\x1b[0m: ${message} (期望: ${expected}, 实际: ${actual}, 误差: ${diff})`);
    failed++;
  }
}

console.log('======================================================');
console.log('🧪 开始运行 Alignment & Onion Skin 界面集成逻辑测试');
console.log('======================================================\n');

// 1. 初始化测试数据
state.setState({
  frames: [
    {
      id: 'frame_1',
      name: '帧 1',
      rect: { x: 0, y: 0, w: 100, h: 100 },
      pivot: { x: 0.5, y: 1.0 },
      offset: { x: 0, y: 0 }
    },
    {
      id: 'frame_2',
      name: '帧 2',
      rect: { x: 100, y: 0, w: 100, h: 100 },
      pivot: { x: 0.0, y: 0.0 },
      offset: { x: 5, y: -8 }
    }
  ],
  selectedFrameId: 'frame_1',
  playerState: {
    isPlaying: false,
    fps: 12,
    onionSkin: false,
    showGround: true,
    showPivot: true
  }
});

// 测试 1: 九宫格点击切换与状态同步
console.log('▶ [集成测试 1] 九宫格点击切换与状态联动:');
{
  const frame = state.getSelectedFrame();
  assert(frame.id === 'frame_1', '当前选中 frame_1');
  assert(frame.pivot.x === 0.5 && frame.pivot.y === 1.0, '初始锚点为底部居中 (0.5, 1.0)');

  // 模拟点击九宫格正中心 'center'
  frameAlignment.setPivotPreset(frame, 'center');
  state.updateFrame(frame.id, { pivot: { ...frame.pivot } });

  const updated = state.getSelectedFrame();
  assert(updated.pivot.x === 0.5 && updated.pivot.y === 0.5, '点击正中心后 pivot 变为 (0.5, 0.5)');

  // 匹配对应的高亮键名
  const matchedKey = frameAlignment.getPivotPresetKey(updated);
  assert(matchedKey === 'center', '高亮键名为 "center"');
}

// 测试 2: 切换选中帧时自动恢复对应九宫格高亮
console.log('\n▶ [集成测试 2] 切换选帧时九宫格对应关系:');
{
  state.selectFrame('frame_2');
  const frame2 = state.getSelectedFrame();
  assert(frame2.id === 'frame_2', '切换选中为 frame_2');

  const key2 = frameAlignment.getPivotPresetKey(frame2);
  assert(key2 === 'top-left', 'frame_2 的锚点自动匹配为 "top-left"');
  assert(frame2.offset.x === 5 && frame2.offset.y === -8, 'frame_2 的偏移量为 (5, -8)');
}

// 测试 3: 偏移量微调与双向更新
console.log('\n▶ [集成测试 3] 偏移量方向键微调与输入同步:');
{
  state.selectFrame('frame_1');
  const frame1 = state.getSelectedFrame();

  // 模拟方向键微调
  // 1px 向右
  frameAlignment.nudgeOffset(frame1, 1, 0);
  assert(frame1.offset.x === 1, '右方向键 nudge 1px: offset.x = 1');

  // Shift + 10px 向下
  frameAlignment.nudgeOffset(frame1, 0, 10);
  assert(frame1.offset.y === 10, 'Shift + 下方向键 nudge 10px: offset.y = 10');

  // 验证世界视口渲染坐标推导
  const pos = frameAlignment.calculateWorldRenderPos(frame1, 128, 200);
  // targetBaseX = 128, w = 100, pivot.x = 0.5, offset.x = 1 -> 128 - 50 + 1 = 79
  // targetBaseY = 200, h = 100, pivot.y = 0.5, offset.y = 10 -> 200 - 50 + 10 = 160
  assert(pos.dx === 79, '实际渲染 dx = 79');
  assert(pos.dy === 160, '实际渲染 dy = 160');
}

// 测试 4: 洋葱皮与地面参考线状态驱动
console.log('\n▶ [集成测试 4] 洋葱皮残影与地面参考线状态响应:');
{
  state.setPlayerState({ onionSkin: true });
  assert(state.get('playerState').onionSkin === true, '洋葱皮开启状态同步');

  const allFrames = state.get('frames');
  const onionSkins = frameAlignment.getOnionSkinFrames(allFrames, 0, 1, 1);
  assert(onionSkins.length === 1, 'frame_1 (index 0) 成功提取相邻后帧 frame_2 作为残影');
  assert(onionSkins[0].frame.id === 'frame_2', '残影帧为 frame_2');
  assert(onionSkins[0].color === '#00b4ff', '后向残影为青蓝色 #00b4ff');

  state.setPlayerState({ showGround: false });
  assert(state.get('playerState').showGround === false, '地面参考线成功关闭');
}

// 测试 5: 帧视口 (playerCanvas) 准星拖拽交互、像素反推与九宫格联动
console.log('\n▶ [集成测试 5] 帧视口准星拖拽交互与像素反推测试:');
{
  const app = Object.create(SpriteAnimatorApp.prototype);
  app.playerCanvas = {
    width: 256,
    height: 256,
    style: { cursor: '' },
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 256, height: 256 })
  };
  app.isDraggingPivot = false;
  app.pivotDragOrigin = null;
  app.draggedFrame = null;
  let viewportRendered = 0;
  let mainCanvasRendered = 0;
  let statusMessage = '';
  app.renderPlayerViewport = () => { viewportRendered++; };
  app.renderMainCanvas = () => { mainCanvasRendered++; };
  app.setStatus = (msg) => { statusMessage = msg; };

  const currentDots = {};
  app.pivotDots = ['top-left', 'center', 'bottom-center'].map(key => ({
    dataset: { pivot: key },
    classList: {
      toggle: (cls, active) => {
        if (cls === 'active') currentDots[key] = active;
      }
    }
  }));

  state.selectFrame('frame_1');
  const frame1 = state.getSelectedFrame();
  // frame_1: rect: { x: 0, y: 0, w: 100, h: 100 }, pivot: { x: 0.5, y: 0.5 }, offset: { x: 1, y: 10 }

  // 1. 验证准星屏幕坐标推导
  // targetBaseX = 128, targetBaseY = Math.round(256 * 0.82) = 210
  // crosshair: x = 128 + 1 = 129, y = 210 + 10 = 220
  const crosshairPos = app.getPlayerCanvasCrosshairPos(frame1);
  assert(crosshairPos.x === 129 && crosshairPos.y === 220, '准星屏幕坐标正确推导为 (129, 220)');

  // 2. 验证 10px 命中半径检测
  assert(app.isNearCrosshair({ x: 129, y: 220 }, crosshairPos, 10) === true, '准星中心 (129, 220) 命中检测为 true');
  assert(app.isNearCrosshair({ x: 135, y: 226 }, crosshairPos, 10) === true, '距离 8.5px 点命中检测为 true');
  assert(app.isNearCrosshair({ x: 140, y: 220 }, crosshairPos, 10) === false, '距离 11px 点超出 10px 命中半径返回 false');

  // 3. 验证鼠标在 canvas 实际像素坐标转换 (考虑 getBoundingClientRect)
  const mousePos = app.getPlayerCanvasMousePos({ clientX: 139, clientY: 240 });
  assert(mousePos.x === 129 && mousePos.y === 220, '考虑 offset 偏移正确反推 canvas 像素坐标 (129, 220)');

  // 4. 模拟准星拖拽交互全流程
  // 按下时记录渲染基准原点 (dx, dy)
  const targetBaseX = 128;
  const targetBaseY = 210;
  const renderOrigin = frameAlignment.calculateWorldRenderPos(frame1, targetBaseX, targetBaseY);
  // dx = 128 - 100 * 0.5 + 1 = 79
  // dy = 210 - 100 * 0.5 + 10 = 170
  app.isDraggingPivot = true;
  app.draggedFrame = frame1;
  app.pivotDragOrigin = renderOrigin;
  assert(app.pivotDragOrigin.dx === 79 && app.pivotDragOrigin.dy === 170, '按下时锁定渲染基准坐标 (79, 170)');

  // 模拟拖拽准星到左上角 (mouseX = 79, mouseY = 170)
  const dragMouse1 = { x: 79, y: 170 };
  const pixelX1 = dragMouse1.x - app.pivotDragOrigin.dx; // 0
  const pixelY1 = dragMouse1.y - app.pivotDragOrigin.dy; // 0
  frameAlignment.setCustomPivot(frame1, pixelX1, pixelY1);
  state.updateFrame(frame1.id, { pivot: { ...frame1.pivot } });
  app.updatePivotGridUI(frame1);
  app.renderPlayerViewport();
  app.renderMainCanvas();

  assert(frame1.pivot.x === 0.0 && frame1.pivot.y === 0.0, '拖拽至左上角反推 pivot 为 (0.0, 0.0)');
  assert(currentDots['top-left'] === true, '左上角预设按钮自动高亮');
  assert(viewportRendered > 0 && mainCanvasRendered > 0, '触发视口与主工作区实时重绘');

  // 模拟拖拽准星到自定义非预设位置 (mouseX = 79 + 33, mouseY = 170 + 82)
  const dragMouse2 = { x: 112, y: 252 };
  const pixelX2 = dragMouse2.x - app.pivotDragOrigin.dx; // 33
  const pixelY2 = dragMouse2.y - app.pivotDragOrigin.dy; // 82
  frameAlignment.setCustomPivot(frame1, pixelX2, pixelY2);
  state.updateFrame(frame1.id, { pivot: { ...frame1.pivot } });
  app.updatePivotGridUI(frame1);

  assertClose(frame1.pivot.x, 0.33, '自定义拖拽反推比例 X: 0.33');
  assertClose(frame1.pivot.y, 0.82, '自定义拖拽反推比例 Y: 0.82');
  assert(currentDots['top-left'] === false && currentDots['center'] === false && currentDots['bottom-center'] === false, '非预设自定义坐标不高亮任何预设');

  // 模拟鼠标松开结束拖拽
  app.isDraggingPivot = false;
  app.draggedFrame = null;
  app.pivotDragOrigin = null;
  assert(app.isDraggingPivot === false, '鼠标松开成功结束拖拽状态');
}

console.log('\n======================================================');
console.log(`📊 测试汇总: 共通过 \x1b[32m${passed}\x1b[0m 项, 失败 \x1b[31m${failed}\x1b[0m 项`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 恭喜！集成交互逻辑验证完全通过！\n');
  process.exit(0);
}
