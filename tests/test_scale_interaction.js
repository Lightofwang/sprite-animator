/**
 * 人物缩放 (Scale) 交互联动与核心算法 单元测试套件
 */

import { strict as assert } from 'assert';
import { FrameAlignment } from '../js/core/frame-alignment.js';
import { AnimationPlayer } from '../js/core/animation-player.js';
import { Exporter } from '../js/core/exporter.js';

console.log('======================================================');
console.log('🧪 开始运行 人物缩放 (Scale) 核心逻辑与防篡改测试');
console.log('======================================================\n');

let passCount = 0;
function it(desc, fn) {
  try {
    fn();
    console.log(`  ✔ PASS: ${desc}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${desc}`);
    console.error(err);
    process.exit(1);
  }
}

const frameAlignment = new FrameAlignment();

console.log('▶ [测试组 1] 人物缩放 setScale / nudgeScale / resetScale 约束验证:');

it('正常设置缩放比例 (如 0.85 = 85%)', () => {
  const frame = { id: 'f1', rect: { x: 0, y: 0, w: 100, h: 100 }, scale: 1.0 };
  const s = frameAlignment.setScale(frame, 0.85);
  assert.equal(s, 0.85);
  assert.equal(frame.scale, 0.85);
});

it('增量微调缩放比例 nudgeScale (+0.05)', () => {
  const frame = { id: 'f1', rect: { x: 0, y: 0, w: 100, h: 100 }, scale: 0.85 };
  const s = frameAlignment.nudgeScale(frame, 0.05);
  assert.equal(Math.round(s * 100), 90);
  assert.equal(Math.round(frame.scale * 100), 90);
});

it('负数与非法值自动安全限制在 0.2 ~ 3.0', () => {
  const frame = { id: 'f1', rect: { x: 0, y: 0, w: 100, h: 100 } };
  frameAlignment.setScale(frame, -0.5);
  assert.equal(frame.scale, 1.0); // 非法回退默认

  frameAlignment.setScale(frame, 0.05);
  assert.equal(frame.scale, 0.2); // 下限 0.2

  frameAlignment.setScale(frame, 5.0);
  assert.equal(frame.scale, 3.0); // 上限 3.0
});

it('重置缩放 resetScale 恢复为 1.0 (100%)', () => {
  const frame = { id: 'f1', rect: { x: 0, y: 0, w: 100, h: 100 }, scale: 0.72 };
  const s = frameAlignment.resetScale(frame);
  assert.equal(s, 1.0);
  assert.equal(frame.scale, 1.0);
});

console.log('\n▶ [测试组 2] 视口世界坐标计算 calculateWorldRenderPos:');

it('当 scale = 1.0 时渲染尺寸等于原始 rect 尺寸', () => {
  const frame = {
    id: 'f1',
    rect: { x: 0, y: 0, w: 120, h: 160 },
    pivot: { x: 0.5, y: 1.0 },
    offset: { x: 0, y: 0 },
    scale: 1.0
  };
  const res = frameAlignment.calculateWorldRenderPos(frame, 200, 300);
  assert.equal(res.renderW, 120);
  assert.equal(res.renderH, 160);
  assert.equal(res.dx, 200 - 60); // 140
  assert.equal(res.dy, 300 - 160); // 140
});

it('当 scale = 0.8 时渲染尺寸等比缩小且脚底基准对齐', () => {
  const frame = {
    id: 'f1',
    rect: { x: 0, y: 0, w: 120, h: 160 },
    pivot: { x: 0.5, y: 1.0 },
    offset: { x: 0, y: 0 },
    scale: 0.8
  };
  const res = frameAlignment.calculateWorldRenderPos(frame, 200, 300);
  assert.equal(res.renderW, 96);
  assert.equal(res.renderH, 128);
  assert.equal(res.dx, 200 - 48); // 152
  assert.equal(res.dy, 300 - 128); // 172 (脚底在 300: 172 + 128 = 300，完美贴地!)
});

it('当 scale = 1.25 时渲染尺寸等比放大且脚底基准对齐', () => {
  const frame = {
    id: 'f1',
    rect: { x: 0, y: 0, w: 100, h: 100 },
    pivot: { x: 0.5, y: 1.0 },
    offset: { x: 0, y: 0 },
    scale: 1.25
  };
  const res = frameAlignment.calculateWorldRenderPos(frame, 250, 400);
  assert.equal(res.renderW, 125);
  assert.equal(res.renderH, 125);
  assert.equal(res.dy + res.renderH, 400); // 脚底完全贴合 400 地面基准线
});

console.log('\n▶ [测试组 3] AnimationPlayer setFrames 防篡改与反向覆盖保护:');

it('setFrames 默认不触发 _notifyFrameChange 从而保护当前外部选中帧', () => {
  let changeNotifyCount = 0;
  const player = new AnimationPlayer({
    frames: [{ id: 'f1' }, { id: 'f2' }],
    onFrameChange: () => {
      changeNotifyCount++;
    }
  });

  assert.equal(changeNotifyCount, 0, '初始化时不应多余通知');

  // 更新帧数据 (比如在调节 scale 时传入更新后的 frames)
  const updatedFrames = [
    { id: 'f1', scale: 1.0 },
    { id: 'f2', scale: 0.85 }
  ];
  player.setFrames(updatedFrames);

  assert.equal(changeNotifyCount, 0, '更新 frames 数组时不应触发 frameChange 通知');
  assert.equal(player.frames[1].scale, 0.85);

  // 显式单步切换时必须正常通知
  player.nextFrame();
  assert.equal(changeNotifyCount, 1, '主动切换下一帧时应正常通知');
  assert.equal(player.currentFrameIndex, 1);
});

console.log('\n======================================================');
console.log(`📊 测试汇总: 共通过 ${passCount} 项, 失败 0 项`);
console.log('======================================================\n');
console.log('🎉 恭喜！人物缩放 (Scale) 核心逻辑与防篡改测试全部通过！\n');
