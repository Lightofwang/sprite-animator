/**
 * @file test_auto_scale.js
 * @description 智能角色身高校准与自动对齐缩放 (Auto Scale) 核心算法单元测试
 */

import assert from 'assert';
import { FrameAlignment } from '../js/core/frame-alignment.js';
import { ImageProcessor } from '../js/core/image-processor.js';

console.log('======================================================');
console.log('🧪 开始运行 Auto Scale 智能身高校准算法单元测试');
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

// 辅助函数：构造一个包含指定高度角色的 ImageData
function createMockCharacterImage(width, height, charX, charY, charW, charH, options = {}) {
  const data = new Uint8ClampedArray(width * height * 4);
  const slashHeight = options.slashHeight || 0; // 顶部刀光高度

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // 默认全透明背景
      data[idx + 3] = 0;

      // 顶部白色刀光
      if (slashHeight > 0 && y >= charY - slashHeight && y < charY && x >= charX && x < charX + charW) {
        data[idx] = 240;
        data[idx + 1] = 240;
        data[idx + 2] = 240;
        data[idx + 3] = 255;
      }

      // 角色躯干（红色盔甲）
      if (y >= charY && y < charY + charH && x >= charX && x < charX + charW) {
        data[idx] = 180;
        data[idx + 1] = 30;
        data[idx + 2] = 30;
        data[idx + 3] = 255;
      }
    }
  }

  return { width, height, data };
}

// --- 测试组 1: 角色真实身高与有效包围盒检测 ---
console.log('\n▶ [测试组 1] detectCharacterBodyBounds 角色有效身高提取:');

it('应该准确提取纯角色躯干的身高 (无刀光干扰)', () => {
  // 画布 200x200, 角色位于 (50, 40), 宽 60, 高 120 (头顶 40, 脚底 159)
  const imgData = createMockCharacterImage(200, 200, 50, 40, 60, 120);
  const frame = { rect: { x: 0, y: 0, w: 200, h: 200 }, scale: 1.0 };

  const bounds = alignment.detectCharacterBodyBounds(frame, null, { mockImageData: imgData });
  assert.ok(bounds, '应成功检测到有效内容边界');
  assert.strictEqual(bounds.bodyH, 120, `角色身高校准高度应为 120，实际为 ${bounds.bodyH}`);
  assert.strictEqual(bounds.bodyMinY, 40, '角色头顶 Y 应为 40');
  assert.strictEqual(bounds.bodyMaxY, 159, '角色脚底 Y 应为 159');
});

it('当存在向上飞溅的白色刀光时，应优先排除刀光并准确识别角色本体身高', () => {
  // 画布 200x200, 顶部有 30px 白色冲天刀光 (Y=20~49), 角色本体在 Y=50~169 (高 120)
  const imgData = createMockCharacterImage(200, 200, 50, 50, 60, 120, { slashHeight: 30 });
  const frame = { rect: { x: 0, y: 0, w: 200, h: 200 }, scale: 1.0 };

  const bounds = alignment.detectCharacterBodyBounds(frame, null, { mockImageData: imgData });
  assert.ok(bounds, '应成功检测到边界');
  assert.strictEqual(bounds.bodyH, 120, `应排除刀光干扰，准确识别出角色本体身高 120 (实际: ${bounds.bodyH})`);
});

// --- 测试组 2: autoNormalizeFrameScale 单帧身高校准 ---
console.log('\n▶ [测试组 2] autoNormalizeFrameScale 单帧自动对齐身量计算:');

it('面对偏大的第 2 帧 (高 150) 与基准第 1 帧 (高 120)，应计算出缩放比 0.80', () => {
  const frame1 = { id: 'f1', rect: { x: 0, y: 0, w: 200, h: 200 }, scale: 1.0 };
  const frame2 = { id: 'f2', rect: { x: 0, y: 0, w: 200, h: 200 }, scale: 1.0 };

  const imgData1 = createMockCharacterImage(200, 200, 50, 40, 60, 120); // 身高 120
  const imgData2 = createMockCharacterImage(200, 200, 40, 20, 80, 150); // 身高 150 (明显画大了 25%)

  const boundsMap = new Map();
  boundsMap.set('f1', alignment.detectCharacterBodyBounds(frame1, null, { mockImageData: imgData1 }));
  boundsMap.set('f2', alignment.detectCharacterBodyBounds(frame2, null, { mockImageData: imgData2 }));

  const res = alignment.autoNormalizeFrameScale(frame2, frame1, null, { boundsMap });
  assert.strictEqual(res.success, true);
  // 120 / 150 = 0.80
  assert.strictEqual(frame2.scale, 0.8, `第 2 帧缩放比应自动校准为 0.8，实际为 ${frame2.scale}`);
});

it('面对偏小的第 3 帧 (高 100) 与基准帧 (高 120)，应计算出缩放比 1.20', () => {
  const frame1 = { id: 'f1', rect: { x: 0, y: 0, w: 200, h: 200 }, scale: 1.0 };
  const frame3 = { id: 'f3', rect: { x: 0, y: 0, w: 200, h: 200 }, scale: 1.0 };

  const imgData1 = createMockCharacterImage(200, 200, 50, 40, 60, 120); // 身高 120
  const imgData3 = createMockCharacterImage(200, 200, 50, 60, 50, 100); // 身高 100 (画小了)

  const boundsMap = new Map();
  boundsMap.set('f1', alignment.detectCharacterBodyBounds(frame1, null, { mockImageData: imgData1 }));
  boundsMap.set('f3', alignment.detectCharacterBodyBounds(frame3, null, { mockImageData: imgData3 }));

  const res = alignment.autoNormalizeFrameScale(frame3, frame1, null, { boundsMap });
  assert.strictEqual(res.success, true);
  // 120 / 100 = 1.20
  assert.strictEqual(frame3.scale, 1.2, `第 3 帧缩放比应自动放大校准为 1.2，实际为 ${frame3.scale}`);
});

// --- 测试组 3: autoNormalizeAllScales 批量统一全帧身量 ---
console.log('\n▶ [测试组 3] autoNormalizeAllScales 全部帧一键统一身量:');

it('全序列多帧混合偏大偏小时，全部帧一键自动齐平身量', () => {
  const frames = [
    { id: 'f1', rect: { x: 0, y: 0, w: 200, h: 200 }, scale: 1.0 }, // 基准: 120 -> scale 1.0
    { id: 'f2', rect: { x: 0, y: 0, w: 200, h: 200 }, scale: 1.0 }, // 偏大: 150 -> scale 0.80
    { id: 'f3', rect: { x: 0, y: 0, w: 200, h: 200 }, scale: 1.0 }, // 偏小: 100 -> scale 1.20
    { id: 'f4', rect: { x: 0, y: 0, w: 200, h: 200 }, scale: 1.0 }  // 正常: 120 -> scale 1.0
  ];

  const boundsMap = new Map();
  boundsMap.set('f1', { bodyH: 120, bodyMinY: 40, bodyMaxY: 159 });
  boundsMap.set('f2', { bodyH: 150, bodyMinY: 20, bodyMaxY: 169 });
  boundsMap.set('f3', { bodyH: 100, bodyMinY: 60, bodyMaxY: 159 });
  boundsMap.set('f4', { bodyH: 120, bodyMinY: 40, bodyMaxY: 159 });

  const result = alignment.autoNormalizeAllScales(frames, null, 0, { boundsMap });
  assert.strictEqual(result.normalizedCount, 4);
  assert.strictEqual(frames[0].scale, 1.0);
  assert.strictEqual(frames[1].scale, 0.8);
  assert.strictEqual(frames[2].scale, 1.2);
  assert.strictEqual(frames[3].scale, 1.0);
});

console.log('\n======================================================');
console.log(`📊 测试完成: 共通过 ${passed} 项, 失败 ${failed} 项`);
console.log('======================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 恭喜！Auto Scale 算法测试全部顺利通过！\n');
}
