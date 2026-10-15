/**
 * @file test_snap_guides.js
 * @description 选框横纵对齐吸附与智能参考线计算引擎单元测试套件
 */

import { SnapGuides } from '../js/core/snap-guides.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✔ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✘ FAIL: ${message}`);
    failed++;
  }
}

function assertClose(actual, expected, message, tol = 0.001) {
  assert(Math.abs(actual - expected) <= tol, `${message} (实际: ${actual}, 期望: ${expected})`);
}

console.log('======================================================');
console.log('🧪 开始运行 SnapGuides 选框横纵对齐吸附 单元测试');
console.log('======================================================\n');

// ----------------------------------------------------
// 测试组 1: X 轴对齐吸附测试 (Left, Right, Center, Adjacent)
// ----------------------------------------------------
console.log('▶ [测试组 1] X 轴对齐吸附测试:');

const frame1 = { id: 'f1', rect: { x: 100, y: 100, w: 200, h: 150 } };
const otherFrames = [frame1];

// 1.1 左边缘对齐: 目标在 103 (偏差 3 <= threshold 8)，应吸附至 100
{
  const activeRect = { x: 103, y: 300, w: 200, h: 150 };
  const res = SnapGuides.calculateBoxSnap(activeRect, otherFrames, { threshold: 8 });
  assert(res.snappedX === 100, `左边缘对齐: x 从 103 吸附到 100`);
  assert(res.snappedY === 300, `Y轴无吸附保持 300`);
  assert(res.guides.some(g => g.axis === 'x' && g.pos === 100 && g.alignType === 'left-left'), `生成 x=100 的左-左对齐参考线`);
}

// 1.2 右边缘对齐: 参考框右边缘为 100+200=300；当前框宽 180，若 x=118 则右边为 298，偏差 2 <= 8，应吸附至 300-180=120
{
  const activeRect = { x: 118, y: 300, w: 180, h: 150 };
  const res = SnapGuides.calculateBoxSnap(activeRect, otherFrames, { threshold: 8 });
  assert(res.snappedX === 120, `右边缘对齐: x 从 118 吸附到 120 (右边缘对齐在 300)`);
  assert(res.guides.some(g => g.axis === 'x' && g.pos === 300 && g.alignType === 'right-right'), `生成 x=300 的右-右对齐参考线`);
}

// 1.3 中心对齐: 参考框中心 100 + 100 = 200；当前框宽 120，中心若在 202 (x=142)，偏差 2 <= 8，应吸附至 x = 200 - 60 = 140
{
  const activeRect = { x: 142, y: 300, w: 120, h: 150 };
  const res = SnapGuides.calculateBoxSnap(activeRect, otherFrames, { threshold: 8 });
  assert(res.snappedX === 140, `中心对齐: x 从 142 吸附到 140 (中心对齐在 200)`);
  assert(res.guides.some(g => g.axis === 'x' && g.pos === 200 && g.alignType === 'center-center'), `生成 x=200 的中心对齐参考线`);
}

// 1.4 相邻拼接贴靠 (Left to Right): 当前框左边缘贴在参考框右边缘 300 处，当前 x=305 (偏差 5 <= 8)
{
  const activeRect = { x: 305, y: 100, w: 200, h: 150 };
  const res = SnapGuides.calculateBoxSnap(activeRect, otherFrames, { threshold: 8 });
  assert(res.snappedX === 300, `相邻横向拼接: x 从 305 吸附到 300 (紧贴在 f1 右侧)`);
  assert(res.guides.some(g => g.axis === 'x' && g.pos === 300 && g.alignType === 'adjacent'), `生成 x=300 的相邻拼接对齐线`);
}

// 1.5 超出阈值不吸附: 偏差 15 > threshold 8
{
  const activeRect = { x: 115, y: 300, w: 200, h: 150 };
  const res = SnapGuides.calculateBoxSnap(activeRect, otherFrames, { threshold: 8 });
  assert(res.snappedX === 115, `超出阈值保持原样 x=115`);
  assert(!res.guides.some(g => g.axis === 'x'), `无 X 轴参考线`);
}

// ----------------------------------------------------
// 测试组 2: Y 轴对齐吸附测试 (Top, Bottom, Middle, Adjacent)
// ----------------------------------------------------
console.log('\n▶ [测试组 2] Y 轴对齐吸附测试:');

// 2.1 顶边缘对齐: 参考框顶边缘 100，当前 y=97 (偏差 3 <= 8)，吸附至 100
{
  const activeRect = { x: 400, y: 97, w: 200, h: 150 };
  const res = SnapGuides.calculateBoxSnap(activeRect, otherFrames, { threshold: 8 });
  assert(res.snappedY === 100, `顶边缘对齐: y 从 97 吸附到 100`);
  assert(res.guides.some(g => g.axis === 'y' && g.pos === 100 && g.alignType === 'top-top'), `生成 y=100 的顶-顶对齐参考线`);
}

// 2.2 底边缘对齐: 参考框底边缘 100+150=250，当前高 160，若 y=88 (底边 248，偏差 2 <= 8)，吸附至 y=90 (底边 250)
{
  const activeRect = { x: 400, y: 88, w: 200, h: 160 };
  const res = SnapGuides.calculateBoxSnap(activeRect, otherFrames, { threshold: 8 });
  assert(res.snappedY === 90, `底边缘对齐: y 从 88 吸附到 90 (底边对齐在 250)`);
  assert(res.guides.some(g => g.axis === 'y' && g.pos === 250 && g.alignType === 'bottom-bottom'), `生成 y=250 的底-底对齐参考线`);
}

// 2.3 相邻纵向拼接贴靠 (Top to Bottom): 当前框贴在参考框下方，y=253 吸附至 250
{
  const activeRect = { x: 100, y: 253, w: 200, h: 150 };
  const res = SnapGuides.calculateBoxSnap(activeRect, otherFrames, { threshold: 8 });
  assert(res.snappedY === 250, `相邻纵向拼接: y 从 253 吸附到 250 (紧贴在 f1 下方)`);
  assert(res.guides.some(g => g.axis === 'y' && g.pos === 250 && g.alignType === 'adjacent'), `生成 y=250 的纵向拼接对齐线`);
}

// ----------------------------------------------------
// 测试组 3: 同时横纵双向吸附 (X & Y 同时吸附)
// ----------------------------------------------------
console.log('\n▶ [测试组 3] 横纵双向同时吸附测试:');

{
  // 参考框在 (100, 100, 200, 150)
  // 当前框在 (304, 98, 200, 150)
  // 预期：X 吸附到 300 (右侧紧贴)，Y 吸附到 100 (顶边对齐)
  const activeRect = { x: 304, y: 98, w: 200, h: 150 };
  const res = SnapGuides.calculateBoxSnap(activeRect, otherFrames, { threshold: 8 });
  assert(res.snappedX === 300, `X轴成功吸附到 300`);
  assert(res.snappedY === 100, `Y轴成功吸附到 100`);
  assert(res.guides.length >= 2, `生成了横纵两组参考对齐线 (实际: ${res.guides.length}条)`);
}

// ----------------------------------------------------
// 测试组 4: 大图边界吸附测试 (Image Bounds)
// ----------------------------------------------------
console.log('\n▶ [测试组 4] 大图边界吸附测试:');

{
  // 图像尺寸 1000 x 800
  // 当前框 x=4, y=5，在 threshold 8 内，吸附到原点 (0, 0)
  const activeRect = { x: 4, y: 5, w: 200, h: 150 };
  const res = SnapGuides.calculateBoxSnap(activeRect, [], {
    threshold: 8,
    imageBounds: { width: 1000, height: 800 }
  });
  assert(res.snappedX === 0, `X轴成功吸附到大图左边缘 0`);
  assert(res.snappedY === 0, `Y轴成功吸附到大图顶边缘 0`);
  assert(res.guides.some(g => g.axis === 'x' && g.pos === 0), `生成大图左边界参考线`);
  assert(res.guides.some(g => g.axis === 'y' && g.pos === 0), `生成大图顶边界参考线`);
}

// ----------------------------------------------------
// 测试组 5: 缩放手柄调整大小时的边缘吸附测试 (Handle Resize Snap)
// ----------------------------------------------------
console.log('\n▶ [测试组 5] 手柄拉伸尺寸边缘吸附测试:');

{
  // 参考框 f1 在 (100, 100, 200, 150)，右边缘 300，底边缘 250
  // 当前框在 (350, 100, 100, 150)，用户拉动左侧手柄 'w'，使 left 变为 303 (偏差 3 <= 8)
  // 预期：左边缘吸附到 300，宽度相应变大
  const activeRect = { x: 303, y: 100, w: 147, h: 150 };
  const res = SnapGuides.calculateResizeSnap(activeRect, 'w', otherFrames, { threshold: 8 });
  assert(res.snappedRect.x === 300, `拉伸左手柄 'w': x 从 303 吸附到 300`);
  assert(res.snappedRect.w === 150, `拉伸左手柄 'w': 宽度补偿增加到 150 (保持右边缘 450 不变)`);
  assert(res.guides.some(g => g.axis === 'x' && g.pos === 300), `生成 x=300 的左手柄对齐参考线`);
}

{
  // 拖动底手柄 's'：当前框 (100, 100, 200, 146)，底边 246，参考框底边 250 (偏差 4 <= 8)
  // 预期：高度从 146 吸附扩展到 150
  const activeRect = { x: 100, y: 100, w: 200, h: 146 };
  const res = SnapGuides.calculateResizeSnap(activeRect, 's', otherFrames, { threshold: 8 });
  assert(res.snappedRect.h === 150, `拉伸底手柄 's': 高度从 146 吸附扩展到 150 (底边对齐在 250)`);
  assert(res.guides.some(g => g.axis === 'y' && g.pos === 250), `生成 y=250 的底手柄对齐参考线`);
}

console.log('\n======================================================');
console.log(`📊 测试汇总: 共通过 ${passed} 项, 失败 ${failed} 项`);
console.log('======================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\n🎉 恭喜！SnapGuides 横纵对齐吸附核心算法测试全部顺利通过！\n');
}
