/**
 * @file test_frame_alignment.js
 * @description FrameAlignment 核心对齐与洋葱皮残影算法单元测试套件
 * 可通过 node tests/test_frame_alignment.js 独立运行
 */

import { FrameAlignment, frameAlignment, PIVOT_PRESETS } from '../js/core/frame-alignment.js';

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
console.log('🧪 开始运行 FrameAlignment 单元测试套件');
console.log('======================================================\n');

// ----------------------------------------------------
// 测试组 1: 九宫格 9 个预设锚点比例与别名检索
// ----------------------------------------------------
console.log('▶ [测试组 1] 九宫格 9 个预设锚点比例与别名验证:');

{
  const expectedPresets = [
    { key: 'tl', x: 0.0, y: 0.0, aliases: ['top-left', 'tl'] },
    { key: 'tc', x: 0.5, y: 0.0, aliases: ['top-center', 'tc'] },
    { key: 'tr', x: 1.0, y: 0.0, aliases: ['top-right', 'tr'] },
    { key: 'ml', x: 0.0, y: 0.5, aliases: ['center-left', 'mid-left', 'ml'] },
    { key: 'c',  x: 0.5, y: 0.5, aliases: ['center', 'c'] },
    { key: 'mr', x: 1.0, y: 0.5, aliases: ['center-right', 'mid-right', 'mr'] },
    { key: 'bl', x: 0.0, y: 1.0, aliases: ['bottom-left', 'bl'] },
    { key: 'bc', x: 0.5, y: 1.0, aliases: ['bottom-center', 'bc'] },
    { key: 'br', x: 1.0, y: 1.0, aliases: ['bottom-right', 'br'] },
  ];

  for (const exp of expectedPresets) {
    const p = PIVOT_PRESETS[exp.key];
    assert(p !== undefined, `预设字典中存在 ${exp.key}`);
    assertClose(p.x, exp.x, `${exp.key} 的归一化 X 坐标为 ${exp.x}`);
    assertClose(p.y, exp.y, `${exp.key} 的归一化 Y 坐标为 ${exp.y}`);

    // 测试别名检索
    for (const alias of exp.aliases) {
      const resolved = frameAlignment.resolvePreset(alias);
      assert(resolved && resolved.key === exp.key, `通过别名 '${alias}' 成功解析为 ${exp.key}`);
    }
  }

  // 测试 setPivotPreset 更新
  const mockFrame = {
    id: 'f1',
    rect: { x: 0, y: 0, w: 100, h: 200 },
    pivot: { x: 0, y: 0 },
    offset: { x: 0, y: 0 }
  };

  const updatedPivot = frameAlignment.setPivotPreset(mockFrame, 'bottom-center');
  assertClose(updatedPivot.x, 0.5, 'setPivotPreset("bottom-center") 更新 X 为 0.5');
  assertClose(updatedPivot.y, 1.0, 'setPivotPreset("bottom-center") 更新 Y 为 1.0');
  assertClose(mockFrame.pivot.x, 0.5, 'frame 对象本身的 pivot.x 同步为 0.5');
  assertClose(mockFrame.pivot.y, 1.0, 'frame 对象本身的 pivot.y 同步为 1.0');
}

// ----------------------------------------------------
// 测试组 2: 绝对像素锚点转换计算 (setCustomPivot)
// ----------------------------------------------------
console.log('\n▶ [测试组 2] 绝对像素锚点设置与归一化比例转换:');

{
  const frame = {
    rect: { x: 50, y: 60, w: 200, h: 400 },
    pivot: { x: 0.5, y: 1.0 }
  };

  // 设置像素坐标 (50, 100) -> 比例应为 (50/200, 100/400) = (0.25, 0.25)
  frameAlignment.setCustomPivot(frame, 50, 100);
  assertClose(frame.pivot.x, 0.25, '绝对像素 (50, 100) 转换为比例 X: 0.25');
  assertClose(frame.pivot.y, 0.25, '绝对像素 (50, 100) 转换为比例 Y: 0.25');

  // 设置像素坐标 (200, 400) -> 比例为 (1.0, 1.0)
  frameAlignment.setCustomPivot(frame, 200, 400);
  assertClose(frame.pivot.x, 1.0, '绝对像素右下角 (200, 400) 转换为比例 X: 1.0');
  assertClose(frame.pivot.y, 1.0, '绝对像素右下角 (200, 400) 转换为比例 Y: 1.0');

  // 边界保护：rect 为空或尺寸为 0 时不崩溃
  const zeroFrame = { rect: { x: 0, y: 0, w: 0, h: 0 }, pivot: { x: 0.5, y: 1.0 } };
  frameAlignment.setCustomPivot(zeroFrame, 10, 10);
  assert(zeroFrame.pivot.x === 0.5 && zeroFrame.pivot.y === 1.0, '零尺寸帧设置自定义像素不产生除以零 NaN');
}

// ----------------------------------------------------
// 测试组 3: 渲染坐标推导公式验证 (calculateWorldRenderPos)
// ----------------------------------------------------
console.log('\n▶ [测试组 3] 渲染坐标推导公式验证:');

{
  // 公式:
  // dx = targetBaseX - w * pivotX + offset.x
  // dy = targetBaseY - h * pivotY + offset.y

  // Case 1: 标准底部中心锚点 (0.5, 1.0), 尺寸 80x120, 无 offset, 基准 (200, 300)
  const frame1 = {
    rect: { x: 0, y: 0, w: 80, h: 120 },
    pivot: { x: 0.5, y: 1.0 },
    offset: { x: 0, y: 0 }
  };
  const pos1 = frameAlignment.calculateWorldRenderPos(frame1, 200, 300);
  // dx = 200 - 80 * 0.5 + 0 = 200 - 40 = 160
  // dy = 300 - 120 * 1.0 + 0 = 300 - 120 = 180
  assertClose(pos1.dx, 160, '底部中心锚点 dx 正确为 160 (200 - 40)');
  assertClose(pos1.dy, 180, '底部中心锚点 dy 正确为 180 (300 - 120)');

  // Case 2: 左上角锚点 (0, 0), 带 offset (15, -25)
  const frame2 = {
    rect: { x: 10, y: 20, w: 60, h: 100 },
    pivot: { x: 0.0, y: 0.0 },
    offset: { x: 15, y: -25 }
  };
  const pos2 = frameAlignment.calculateWorldRenderPos(frame2, 200, 300);
  // dx = 200 - 60 * 0 + 15 = 215
  // dy = 300 - 100 * 0 - 25 = 275
  assertClose(pos2.dx, 215, '左上角锚点带偏移 dx 正确为 215 (200 + 15)');
  assertClose(pos2.dy, 275, '左上角锚点带偏移 dy 正确为 275 (300 - 25)');

  // Case 3: 中心锚点 (0.5, 0.5), 尺寸 100x100, offset (-5, 12), 基准 (400, 400)
  const frame3 = {
    rect: { x: 0, y: 0, w: 100, h: 100 },
    pivot: { x: 0.5, y: 0.5 },
    offset: { x: -5, y: 12 }
  };
  const pos3 = frameAlignment.calculateWorldRenderPos(frame3, 400, 400);
  // dx = 400 - 100 * 0.5 - 5 = 400 - 50 - 5 = 345
  // dy = 400 - 100 * 0.5 + 12 = 400 - 50 + 12 = 362
  assertClose(pos3.dx, 345, '中心锚点 dx 正确为 345');
  assertClose(pos3.dy, 362, '中心锚点 dy 正确为 362');
}

// ----------------------------------------------------
// 测试组 4: 键盘方向键微调与重置 (nudgeOffset & resetOffset)
// ----------------------------------------------------
console.log('\n▶ [测试组 4] 键盘偏移量增量微调与重置:');

{
  const frame = {
    rect: { x: 0, y: 0, w: 64, h: 64 },
    offset: { x: 0, y: 0 }
  };

  // 1. 步进 1 像素右移
  frameAlignment.nudgeOffset(frame, 1, 0);
  assert(frame.offset.x === 1 && frame.offset.y === 0, '向右微调 1px: offset.x = 1');

  // 2. 步进 1 像素上移 (dy = -1)
  frameAlignment.nudgeOffset(frame, 0, -1);
  assert(frame.offset.x === 1 && frame.offset.y === -1, '向上微调 1px: offset.y = -1');

  // 3. Shift 快速步进 10 像素
  frameAlignment.nudgeOffset(frame, -10, 20);
  assert(frame.offset.x === -9 && frame.offset.y === 19, '大跨度微调 (-10, 20): offset = (-9, 19)');

  // 4. 重置归零
  frameAlignment.resetOffset(frame);
  assert(frame.offset.x === 0 && frame.offset.y === 0, 'resetOffset 成功将偏移量归零为 (0, 0)');

  // 5. 容错测试：若 frame.offset 为 undefined，自动安全初始化
  const uninitFrame = { rect: { x: 0, y: 0, w: 32, h: 32 } };
  frameAlignment.nudgeOffset(uninitFrame, 3, 4);
  assert(uninitFrame.offset && uninitFrame.offset.x === 3 && uninitFrame.offset.y === 4, '未初始化 offset 的 frame 自动完成初始化');
}

// ----------------------------------------------------
// 测试组 5: 洋葱皮前后相邻帧提取与边界处理 (getOnionSkinFrames)
// ----------------------------------------------------
console.log('\n▶ [测试组 5] 洋葱皮前后帧提取逻辑与边界处理:');

{
  const testFrames = [
    { id: 'f0', name: 'Frame 0' },
    { id: 'f1', name: 'Frame 1' },
    { id: 'f2', name: 'Frame 2' },
    { id: 'f3', name: 'Frame 3' },
  ];

  // Case 1: 中间帧 (index = 1)，前 1 帧，后 1 帧
  const skinsMid = frameAlignment.getOnionSkinFrames(testFrames, 1, 1, 1);
  assert(skinsMid.length === 2, '中间帧包含前 1 帧与后 1 帧共 2 个残影');

  const prevItem = skinsMid.find(s => s.type === 'prev');
  assert(prevItem !== undefined, '存在前向残影 (type: prev)');
  assert(prevItem.frame.id === 'f0', '前向残影帧为 f0');
  assert(prevItem.index === 0, '前向残影索引为 0');
  assert(prevItem.color === '#ff4444', '前向残影着色为淡暖色 #ff4444');
  assertClose(prevItem.alpha, 0.35, '前向残影默认透明度为 0.35');

  const nextItem = skinsMid.find(s => s.type === 'next');
  assert(nextItem !== undefined, '存在后向残影 (type: next)');
  assert(nextItem.frame.id === 'f2', '后向残影帧为 f2');
  assert(nextItem.index === 2, '后向残影索引为 2');
  assert(nextItem.color === '#00b4ff', '后向残影着色为淡冷色 #00b4ff');
  assertClose(nextItem.alpha, 0.35, '后向残影默认透明度为 0.35');

  // Case 2: 边界处理 - 首帧 (index = 0)
  const skinsHead = frameAlignment.getOnionSkinFrames(testFrames, 0, 1, 1);
  assert(skinsHead.length === 1, '首帧无前帧，仅返回后向残影 1 帧');
  assert(skinsHead[0].type === 'next' && skinsHead[0].frame.id === 'f1', '首帧的残影仅为下一帧 f1');

  // Case 3: 边界处理 - 末帧 (index = 3)
  const skinsTail = frameAlignment.getOnionSkinFrames(testFrames, 3, 1, 1);
  assert(skinsTail.length === 1, '末帧无后帧，仅返回前向残影 1 帧');
  assert(skinsTail[0].type === 'prev' && skinsTail[0].frame.id === 'f2', '末帧的残影仅为前一帧 f2');

  // Case 4: 边界处理 - 只有单帧 (length = 1)
  const skinsSingle = frameAlignment.getOnionSkinFrames([testFrames[0]], 0, 1, 1);
  assert(skinsSingle.length === 0, '单帧序列提取前后残影结果为空数组');

  // Case 5: 边界处理 - 空数组或无效索引
  assert(frameAlignment.getOnionSkinFrames([], 0).length === 0, '空帧列表返回空数组');
  assert(frameAlignment.getOnionSkinFrames(testFrames, -1).length === 0, '越界负索引返回空数组');
  assert(frameAlignment.getOnionSkinFrames(testFrames, 10).length === 0, '越界超出索引返回空数组');
}

// ----------------------------------------------------
// 测试组 6: getPivotPresetKey 匹配九宫格高亮
// ----------------------------------------------------
console.log('\n▶ [测试组 6] getPivotPresetKey 匹配与九宫格高亮联动:');

{
  const frameBC = { pivot: { x: 0.5, y: 1.0 } };
  assert(frameAlignment.getPivotPresetKey(frameBC) === 'bottom-center', '匹配 (0.5, 1.0) 为 "bottom-center"');
  assert(frameAlignment.getPivotPresetKey(frameBC, 0.05, 'short') === 'bc', '短代码格式返回 "bc"');

  const frameTL = { pivot: { x: 0.0, y: 0.0 } };
  assert(frameAlignment.getPivotPresetKey(frameTL) === 'top-left', '匹配 (0.0, 0.0) 为 "top-left"');

  const frameCustom = { pivot: { x: 0.23, y: 0.77 } };
  assert(frameAlignment.getPivotPresetKey(frameCustom) === null, '非预设自定义坐标返回 null');
}

// ----------------------------------------------------
// 汇总统计
// ----------------------------------------------------
console.log('\n======================================================');
console.log(`📊 测试汇总: 共通过 \x1b[32m${passed}\x1b[0m 项, 失败 \x1b[31m${failed}\x1b[0m 项`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 恭喜！FrameAlignment 所有算法与对齐测试全部顺利通过！\n');
  process.exit(0);
}
