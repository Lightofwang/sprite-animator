/**
 * @file test_overlap_isolator.js
 * @description OverlapIsolator 单元测试套件
 * 验证：
 * 1. Frame 独立图层初始化与尺寸响应
 * 2. applyEraser 橡皮擦在纯色图像上擦除透明圆形区域与线段插值
 * 3. applyPolygonLasso 多边形套索保留内部/外部透明化
 * 4. applyMagicWand 魔棒 Flood Fill 连续去色与容差范围
 * 5. Undo / Redo 历史栈快照保存与完整还原
 * 可通过 node tests/test_overlap_isolator.js 运行
 */

import { OverlapIsolator, overlapIsolator } from '../js/core/overlap-isolator.js';
import { createImageDataObject } from '../js/core/image-processor.js';

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

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${message}`);
    passed++;
  } else {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${message}\n      期望: ${expected}\n      实际: ${actual}`);
    failed++;
  }
}

/**
 * 辅助函数：创建并填充一个具有纯色的测试 Frame
 */
function createTestFrame(w = 20, h = 20, r = 255, g = 0, b = 0, a = 255) {
  const isolator = new OverlapIsolator();
  const frame = {
    id: 'test_frame_1',
    name: '测试帧',
    rect: { x: 0, y: 0, w, h },
    maskCanvas: null
  };

  isolator.initFrameCanvas(frame);
  const ctx = frame.maskCanvas.getContext('2d');
  const imgData = createImageDataObject(w, h);
  for (let i = 0; i < w * h; i++) {
    const off = i * 4;
    imgData.data[off] = r;
    imgData.data[off + 1] = g;
    imgData.data[off + 2] = b;
    imgData.data[off + 3] = a;
  }
  ctx.putImageData(imgData, 0, 0);

  return { isolator, frame, ctx };
}

console.log('\n======================================================');
console.log('🧪 开始运行 OverlapIsolator 核心算法单元测试套件');
console.log('======================================================\n');

// ----------------------------------------------------
// 测试组 1: Frame 独立图层初始化与获取机制
// ----------------------------------------------------
console.log('▶ [测试组 1] Frame 独立图层 maskCanvas 管理:');
{
  const isolator = new OverlapIsolator();
  const frame = {
    id: 'f1',
    rect: { x: 10, y: 20, w: 32, h: 48 },
    maskCanvas: null
  };

  const canvas = isolator.initFrameCanvas(frame);
  assert(canvas !== null, '成功为 Frame 创建 maskCanvas');
  assertEqual(canvas.width, 32, 'maskCanvas 宽度与 frame.rect.w 一致');
  assertEqual(canvas.height, 48, 'maskCanvas 高度与 frame.rect.h 一致');
  assert(frame.maskCanvas === canvas, 'frame.maskCanvas 引用已正确绑定');

  const retrieved = isolator.getFrameCanvas(frame);
  assert(retrieved === canvas, 'getFrameCanvas 返回现有实例避免重复创建');

  // 当选框尺寸发生改变时，自动重新初始化并适应新尺寸
  frame.rect.w = 64;
  frame.rect.h = 64;
  const resizedCanvas = isolator.getFrameCanvas(frame);
  assertEqual(resizedCanvas.width, 64, '尺寸改变后 getFrameCanvas 自动重新创建正确宽度');
  assertEqual(resizedCanvas.height, 64, '尺寸改变后 getFrameCanvas 自动重新创建正确高度');
}

// ----------------------------------------------------
// 测试组 2: applyEraser 橡皮擦消除测试
// ----------------------------------------------------
console.log('\n▶ [测试组 2] applyEraser 橡皮擦透明化与插值验证:');
{
  const { isolator, frame, ctx } = createTestFrame(30, 30, 255, 0, 0, 255);

  // 在中心 (15, 15) 使用直径为 10 (半径 5) 的橡皮擦执行擦除
  isolator.applyEraser(frame, 15, 15, 10);

  const imgData = ctx.getImageData(0, 0, 30, 30);
  const getAlpha = (x, y) => imgData.data[(y * 30 + x) * 4 + 3];

  // 1. 中心点应当被擦除为透明 (Alpha = 0)
  assertEqual(getAlpha(15, 15), 0, '橡皮擦圆心位置像素完全透明 (Alpha = 0)');
  assertEqual(getAlpha(15, 12), 0, '半径内部 (15, 12) 像素完全透明 (Alpha = 0)');
  assertEqual(getAlpha(12, 15), 0, '半径内部 (12, 15) 像素完全透明 (Alpha = 0)');

  // 2. 距离圆心远的点不受影响 (保持 Alpha = 255)
  assertEqual(getAlpha(2, 2), 255, '圆心外侧边缘点 (2, 2) 保留不透明 (Alpha = 255)');
  assertEqual(getAlpha(28, 28), 255, '圆心外侧边缘点 (28, 28) 保留不透明 (Alpha = 255)');

  // 3. 线段插值擦除测试 (模拟快速鼠标拖拽从 5,5 到 25,5)
  const frame2 = createTestFrame(30, 30, 0, 255, 0, 255);
  frame2.isolator.applyEraser(frame2.frame, 25, 5, 6, 5, 5);

  const imgData2 = frame2.ctx.getImageData(0, 0, 30, 30);
  const getAlpha2 = (x, y) => imgData2.data[(y * 30 + x) * 4 + 3];

  assertEqual(getAlpha2(5, 5), 0, '线段起点 (5, 5) 擦除透明');
  assertEqual(getAlpha2(15, 5), 0, '线段中间插值点 (15, 5) 消除拖拽断点，成功擦除透明');
  assertEqual(getAlpha2(25, 5), 0, '线段终点 (25, 5) 擦除透明');
  assertEqual(getAlpha2(15, 15), 255, '距离线段较远位置 (15, 15) 未受影响 (Alpha = 255)');
}

// ----------------------------------------------------
// 测试组 3: applyPolygonLasso 多边形套索测试
// ----------------------------------------------------
console.log('\n▶ [测试组 3] applyPolygonLasso 多边形套索裁切:');
{
  const { isolator, frame, ctx } = createTestFrame(30, 30, 0, 0, 255, 255);

  // 定义一个覆盖中心 (10,10) 到 (20,20) 的矩形多边形顶点
  const polyPoints = [
    { x: 10, y: 10 },
    { x: 20, y: 10 },
    { x: 20, y: 20 },
    { x: 10, y: 20 }
  ];

  // 测试 3.1: keepInside = true (保留多边形内部，外部全部透明化)
  const ok = isolator.applyPolygonLasso(frame, polyPoints, true);
  assert(ok, '多边形套索执行成功');

  const imgData = ctx.getImageData(0, 0, 30, 30);
  const getAlpha = (x, y) => imgData.data[(y * 30 + x) * 4 + 3];

  // 多边形内部点 (15, 15) 应该保留蓝色不透明
  assertEqual(getAlpha(15, 15), 255, '多边形内部像素 (15, 15) 完整保留 (Alpha = 255)');
  assertEqual(imgData.data[(15 * 30 + 15) * 4 + 2], 255, '多边形内部颜色依然为原蓝色 (Blue = 255)');

  // 多边形外部点 (5, 5), (25, 25) 应该被清除为透明
  assertEqual(getAlpha(5, 5), 0, '多边形外部左上角 (5, 5) 已被扣除为完全透明');
  assertEqual(getAlpha(25, 25), 0, '多边形外部右下角 (25, 25) 已被扣除为完全透明');
  assertEqual(getAlpha(2, 15), 0, '多边形外部左侧 (2, 15) 已被扣除为完全透明');

  // 测试 3.2: keepInside = false (清除多边形内部，保留外部)
  const frameReverse = createTestFrame(30, 30, 255, 255, 0, 255);
  frameReverse.isolator.applyPolygonLasso(frameReverse.frame, polyPoints, false);
  const revData = frameReverse.ctx.getImageData(0, 0, 30, 30);
  const getRevAlpha = (x, y) => revData.data[(y * 30 + x) * 4 + 3];

  assertEqual(getRevAlpha(15, 15), 0, 'keepInside=false 时多边形内部像素被清除为透明');
  assertEqual(getRevAlpha(5, 5), 255, 'keepInside=false 时外部像素完整保留');
}

// ----------------------------------------------------
// 测试组 4: applyMagicWand 魔棒去色与泛洪填充
// ----------------------------------------------------
console.log('\n▶ [测试组 4] applyMagicWand 魔棒 Flood Fill 算法:');
{
  const isolator = new OverlapIsolator();
  const w = 20, h = 20;
  const frame = {
    id: 'f_wand',
    rect: { x: 0, y: 0, w, h },
    maskCanvas: null
  };
  isolator.initFrameCanvas(frame);
  const ctx = frame.maskCanvas.getContext('2d');

  // 构建一个测试图案：
  // 全图默认白色 (255, 255, 255, 255)
  // 中间放一个红色色块 (255, 0, 0, 255) 在 (5,5) 到 (14,14)
  // 红色色块内部挖一个 2x2 的小绿点 (0, 255, 0, 255) 在 (8,8) 到 (9,9)
  // 右上角 (16,0) 到 (19,3) 放一个孤立的红色色块 (与中间红色不连通)
  const imgData = createImageDataObject(w, h);
  const setPixel = (x, y, r, g, b, a = 255) => {
    const off = (y * w + x) * 4;
    imgData.data[off] = r;
    imgData.data[off + 1] = g;
    imgData.data[off + 2] = b;
    imgData.data[off + 3] = a;
  };

  // 全图填白
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      setPixel(x, y, 255, 255, 255);
    }
  }
  // 中间大红块
  for (let y = 5; y <= 14; y++) {
    for (let x = 5; x <= 14; x++) {
      setPixel(x, y, 255, 0, 0);
    }
  }
  // 内部绿点
  setPixel(8, 8, 0, 255, 0);
  setPixel(9, 8, 0, 255, 0);
  setPixel(8, 9, 0, 255, 0);
  setPixel(9, 9, 0, 255, 0);

  // 孤立红块
  for (let y = 0; y < 4; y++) {
    for (let x = 16; x < 20; x++) {
      setPixel(x, y, 255, 0, 0);
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // 点击中间大红块 (10, 10)，contiguous = true，容差 tolerance = 10
  const wandRes = isolator.applyMagicWand(frame, 10, 10, 10, true);
  assert(wandRes, '魔棒点击成功触发并修改');

  const afterData = ctx.getImageData(0, 0, w, h);
  const getA = (x, y) => afterData.data[(y * w + x) * 4 + 3];
  const getR = (x, y) => afterData.data[(y * w + x) * 4];

  // 1. 中间连通的红块应该被擦除为透明
  assertEqual(getA(10, 10), 0, '点击的红色起点 (10, 10) 变为完全透明');
  assertEqual(getA(5, 5), 0, '中间红色区域角点 (5, 5) 连通泛洪擦除为透明');
  assertEqual(getA(14, 14), 0, '中间红色区域角点 (14, 14) 连通泛洪擦除为透明');

  // 2. 内部的绿点由于颜色不同，不应该被擦除
  assertEqual(getA(8, 8), 255, '红色块内部的绿色像素 (8, 8) 未被消除 (Alpha = 255)');

  // 3. 外部白色背景不受影响
  assertEqual(getA(0, 0), 255, '白色背景像素 (0, 0) 未受影响 (Alpha = 255)');

  // 4. 孤立的右上角红块：因为 contiguous = true，不连通，所以不应该被消除！
  assertEqual(getA(18, 2), 255, '非连通的孤立红块 (18, 2) 在 contiguous=true 下保持保留 (Alpha = 255)');

  // 5. 容差测试：再次测试带微小颜色偏差在容差内被消除
  setPixel(3, 3, 250, 5, 5); // 接近红色 (偏差 5)
  ctx.putImageData(imgData, 0, 0);
  isolator.applyMagicWand(frame, 3, 3, 10, true);
  const tolData = ctx.getImageData(0, 0, w, h);
  assertEqual(tolData.data[(3 * w + 3) * 4 + 3], 0, '偏差 5 在容差 10 范围内被魔棒成功识别并透明化');
}

// ----------------------------------------------------
// 测试组 5: 历史撤销与重做 (Undo / Redo) 栈验证
// ----------------------------------------------------
console.log('\n▶ [测试组 5] 历史栈 Undo / Redo 快照恢复机制:');
{
  const { isolator, frame, ctx } = createTestFrame(20, 20, 255, 0, 0, 255);

  assert(!isolator.canUndo(frame), '初始状态不可撤销 (canUndo = false)');
  assert(!isolator.canRedo(frame), '初始状态不可重做 (canRedo = false)');

  // 1. 记录快照并执行第一笔擦除
  isolator.saveSnapshot(frame);
  isolator.applyEraser(frame, 5, 5, 6);

  assert(isolator.canUndo(frame), '擦除后可以撤销 (canUndo = true)');
  let currA = ctx.getImageData(0, 0, 20, 20).data[(5 * 20 + 5) * 4 + 3];
  assertEqual(currA, 0, '第一笔擦除后 (5, 5) 像素透明');

  // 2. 记录快照并执行第二笔擦除
  isolator.saveSnapshot(frame);
  isolator.applyEraser(frame, 15, 15, 6);
  let currB = ctx.getImageData(0, 0, 20, 20).data[(15 * 20 + 15) * 4 + 3];
  assertEqual(currB, 0, '第二笔擦除后 (15, 15) 像素透明');

  // 3. 执行第一次撤销 (还原第二笔)
  const undo1 = isolator.undo(frame);
  assert(undo1, '第一次撤销执行成功');
  const afterUndo1 = ctx.getImageData(0, 0, 20, 20);
  assertEqual(afterUndo1.data[(15 * 20 + 15) * 4 + 3], 255, '撤销后 (15, 15) 恢复为不透明红色 (Alpha = 255)');
  assertEqual(afterUndo1.data[(5 * 20 + 5) * 4 + 3], 0, '第一笔 (5, 5) 依然保持透明');
  assert(isolator.canRedo(frame), '撤销后可以重做 (canRedo = true)');

  // 4. 执行第二次撤销 (还原第一笔，回到完全初始纯红)
  const undo2 = isolator.undo(frame);
  assert(undo2, '第二次撤销执行成功');
  const afterUndo2 = ctx.getImageData(0, 0, 20, 20);
  assertEqual(afterUndo2.data[(5 * 20 + 5) * 4 + 3], 255, '再次撤销后 (5, 5) 也恢复为不透明红色');
  assert(!isolator.canUndo(frame), '已撤销到底，无法继续撤销');

  // 5. 执行重做 (Redo) 恢复第一笔
  const redo1 = isolator.redo(frame);
  assert(redo1, '重做第一笔成功');
  const afterRedo1 = ctx.getImageData(0, 0, 20, 20);
  assertEqual(afterRedo1.data[(5 * 20 + 5) * 4 + 3], 0, '重做后 (5, 5) 重新变回透明');

  // 6. 验证上限 20 步
  for (let i = 0; i < 25; i++) {
    isolator.saveSnapshot(frame);
    isolator.applyEraser(frame, i % 20, i % 20, 2);
  }
  const hist = isolator._getHistory(frame);
  assertEqual(hist.undoStack.length, 20, 'undoStack 快照数量严格限制在 20 步上限');
}

console.log('\n======================================================');
console.log(`📊 测试汇总: 共通过 ${passed} 项, 失败 ${failed} 项`);
console.log('======================================================\n');

if (failed === 0) {
  console.log('🎉 恭喜！OverlapIsolator 所有算法与历史栈测试全部顺利通过！\n');
  process.exit(0);
} else {
  console.error('❌ 存在失败项，请检查相关逻辑。\n');
  process.exit(1);
}
