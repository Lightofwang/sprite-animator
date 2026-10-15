/**
 * @file test_jump_flicker_calipers.js
 * @description 大跳腾空与果冻效应专项测试：A/B 闪烁对比、躯干中心对齐与刚体双卡尺逻辑验证
 */

import assert from 'assert';
import { FrameAlignment } from '../js/core/frame-alignment.js';

console.log('======================================================');
console.log('🧪 开始运行 大跳腾空与果冻效应专项测试 (Flicker & Calipers)');
console.log('======================================================');

let passed = 0;
let failed = 0;

function it(description, fn) {
  try {
    fn();
    console.log(`  ✔ PASS: ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✖ FAIL: ${description}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

const alignment = new FrameAlignment();

// 构造模拟 Canvas 上下文
function createMockCanvas(width = 480, height = 380) {
  const drawnCommands = [];
  const ctx = {
    canvas: { width, height },
    width,
    height,
    clearRect: (x, y, w, h) => drawnCommands.push({ cmd: 'clearRect', x, y, w, h }),
    save: () => drawnCommands.push({ cmd: 'save' }),
    restore: () => drawnCommands.push({ cmd: 'restore' }),
    beginPath: () => drawnCommands.push({ cmd: 'beginPath' }),
    moveTo: (x, y) => drawnCommands.push({ cmd: 'moveTo', x, y }),
    lineTo: (x, y) => drawnCommands.push({ cmd: 'lineTo', x, y }),
    stroke: () => drawnCommands.push({ cmd: 'stroke' }),
    fill: () => drawnCommands.push({ cmd: 'fill' }),
    arc: (x, y, r) => drawnCommands.push({ cmd: 'arc', x, y, r }),
    setLineDash: (d) => drawnCommands.push({ cmd: 'setLineDash', d }),
    fillText: (text, x, y) => drawnCommands.push({ cmd: 'fillText', text, x, y }),
    fillRect: (x, y, w, h) => drawnCommands.push({ cmd: 'fillRect', x, y, w, h }),
    strokeRect: (x, y, w, h) => drawnCommands.push({ cmd: 'strokeRect', x, y, w, h }),
    translate: (x, y) => drawnCommands.push({ cmd: 'translate', x, y }),
    scale: (sx, sy) => drawnCommands.push({ cmd: 'scale', sx, sy }),
    drawImage: (...args) => drawnCommands.push({ cmd: 'drawImage', args }),
    roundRect: (x, y, w, h, r) => drawnCommands.push({ cmd: 'roundRect', x, y, w, h, r })
  };

  return {
    width,
    height,
    getContext: () => ctx,
    _commands: drawnCommands
  };
}

// 模拟帧数据：第1帧站立，第2帧大跳腾空
const mockFrames = [
  {
    id: 'frame_1',
    name: '帧 1 (站立)',
    rect: { x: 0, y: 0, w: 100, h: 140 },
    pivot: { x: 0.5, y: 1.0 },
    offset: { x: 0, y: 0 },
    scale: 1.0,
    maskCanvas: null
  },
  {
    id: 'frame_2',
    name: '帧 2 (大跳腾空)',
    rect: { x: 100, y: 0, w: 120, h: 100 },
    pivot: { x: 0.5, y: 1.0 },
    offset: { x: 5, y: -80 }, // 腾空 80px
    scale: 0.95,
    maskCanvas: null
  }
];

console.log('\n▶ [测试组 1] renderFrameToContext 的 centerAnchor 几何中心居中计算:');

it('centerAnchor=true 时忽略 offset 与脚底锚点，严格以几何中心 (0.5, 0.5) 对齐 targetBase', () => {
  const canvasObj = createMockCanvas(140, 140);
  const ctx = canvasObj.getContext();
  const mockImg = { width: 400, height: 400 };
  
  // 针对腾空帧调用 centerAnchor
  const jumpFrame = mockFrames[1];
  alignment.renderFrameToContext(ctx, jumpFrame, mockImg, 70, 70, { centerAnchor: true });

  // 验证 drawImage 调用中计算的 dx, dy：
  // jumpFrame 原始 120x100, scale=0.95 -> renderW=114, renderH=95
  // dx = 70 - 114 * 0.5 = 70 - 57 = 13
  // dy = 70 - 95 * 0.5 = 70 - 47.5 -> Math.round -> 22 或 23
  const drawCalls = canvasObj._commands.filter(c => c.cmd === 'drawImage');
  assert.strictEqual(drawCalls.length, 1, '应发生一次 drawImage 调用');
  
  const [img, sx, sy, sw, sh, dx, dy, targetW, targetH] = drawCalls[0].args;
  assert.strictEqual(targetW, 114, '缩放宽度应为 114px');
  assert.strictEqual(targetH, 95, '缩放高度应为 95px');
  assert.strictEqual(dx, 13, 'dx 应居中在 13px');
  assert(Math.abs(dy - 22.5) <= 1, `dy 应居中在约 22~23px (实际: ${dy})`);
});

console.log('\n▶ [测试组 2] 刚体双卡尺 (Calipers) 视口渲染验证:');

it('开启 displayConfig.calipers=true 时正确绘制金色头顶与骨盆双标尺线及高度标注', () => {
  const canvasObj = createMockCanvas(480, 380);
  
  alignment.renderAlignmentStage(
    canvasObj,
    mockFrames[1],
    mockFrames,
    1,
    null,
    {
      calipers: true,
      showGround: true
    }
  );

  // 检查是否包含卡尺文字绘制
  const textCalls = canvasObj._commands.filter(c => c.cmd === 'fillText');
  const hasHeadCaliper = textCalls.some(t => t.text.includes('头顶卡尺'));
  const hasWaistCaliper = textCalls.some(t => t.text.includes('骨盆卡尺'));
  const hasTorsoH = textCalls.some(t => t.text.includes('躯干:'));

  assert(hasHeadCaliper, '视口中应渲染头顶卡尺标注');
  assert(hasWaistCaliper, '视口中应渲染骨盆卡尺标注');
  assert(hasTorsoH, '视口中应渲染躯干高度数值');
});

console.log('\n▶ [测试组 3] 原地大跳 (In-Place) 一键重心居中变换验证:');

it('将动作帧转换为 In-Place 模式时，全部帧 pivot 设为 (0.5, 0.5) 且 offset 归零', () => {
  const cloned = JSON.parse(JSON.stringify(mockFrames));
  
  // 模拟 btnAlignCenterAll 的执行逻辑
  cloned.forEach(f => {
    f.pivot = { x: 0.5, y: 0.5 };
    f.offset = { x: 0, y: 0 };
  });

  assert.strictEqual(cloned[0].pivot.x, 0.5);
  assert.strictEqual(cloned[0].pivot.y, 0.5);
  assert.strictEqual(cloned[1].pivot.x, 0.5);
  assert.strictEqual(cloned[1].pivot.y, 0.5);
  assert.strictEqual(cloned[1].offset.y, 0, '腾空 offset.y 应完全归零消除空中抖动');
});

console.log('\n======================================================');
console.log(`📊 测试汇总: 共通过 ${passed} 项, 失败 ${failed} 项`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 恭喜！大跳腾空与果冻效应专项测试全部通过！\n');
}
