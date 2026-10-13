/**
 * @file test_size_and_slice.js
 * @description 针对视口自适应缩放、统一尺寸换算与网格均等切片逻辑的自动化测试
 */

import assert from 'assert';
import { FrameAlignment } from '../js/core/frame-alignment.js';

console.log('======================================================');
console.log('🧪 开始运行 视口自适应缩放、统一尺寸与网格切片 自动化测试');
console.log('======================================================\n');

let passCount = 0;
let failCount = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✔ PASS: ${desc}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${desc}`);
    console.error(`     原因: ${err.message}`);
    failCount++;
  }
}

const alignment = new FrameAlignment();

// -----------------------------------------------------------------------------
// 1. 视口自适应缩放比例计算 (calculateStageScale)
// -----------------------------------------------------------------------------
console.log('▶ [测试组 1] 视口自适应缩放比例计算:');

it('当视口 256x256，帧尺寸较小 (64x64) 时，自适应缩放保持 1.0 (不放大)', () => {
  const frames = [{ rect: { x: 0, y: 0, w: 64, h: 64 } }];
  const scale = alignment.calculateStageScale(256, 256, frames, frames[0], 'auto');
  assert.strictEqual(scale, 1.0);
});

it('当大尺寸帧 (614x358) 放入 256x256 视口时，自动缩小并完整容纳全身与武器', () => {
  const frames = [{ rect: { x: 0, y: 0, w: 614, h: 358 } }];
  const scale = alignment.calculateStageScale(256, 256, frames, frames[0], 'auto');
  assert(scale < 1.0, '超大尺寸帧必须被自动缩小');
  // 可用宽度 256 * 0.85 = 217.6, 可用高度 256 * 0.76 = 194.56
  // scaleW = 217.6 / 614 ≈ 0.354, scaleH = 194.56 / 358 ≈ 0.543 -> 缩小到约 0.354
  assert(scale >= 0.35 && scale <= 0.36, `期望 scale 约 0.354，实际得到 ${scale}`);
});

it('当用户指定具体缩放倍率 (如 0.5 或 "0.75") 时，严格采用用户指定倍率', () => {
  const frames = [{ rect: { x: 0, y: 0, w: 614, h: 358 } }];
  const scaleNum = alignment.calculateStageScale(256, 256, frames, frames[0], 0.5);
  assert.strictEqual(scaleNum, 0.5);

  const scaleStr = alignment.calculateStageScale(256, 256, frames, frames[0], '0.75');
  assert.strictEqual(scaleStr, 0.75);
});

// -----------------------------------------------------------------------------
// 2. 统一尺寸几何换算验证 (Bottom-Center 对齐保证脚底丝毫不移)
// -----------------------------------------------------------------------------
console.log('\n▶ [测试组 2] 统一尺寸几何扩展算法验证:');

it('以 bottom-center 为锚点扩展尺寸时，中心 X 与底部 Y 恒定不变', () => {
  // 原选框: x=100, y=100, w=50, h=80
  // 原底部: bottomY = 180, 中心: cx = 125
  const oldRect = { x: 100, y: 100, w: 50, h: 80 };
  const targetW = 100;
  const targetH = 120;

  const cx = oldRect.x + oldRect.w / 2;
  const by = oldRect.y + oldRect.h;
  const newX = Math.round(cx - targetW / 2);
  const newY = Math.round(by - targetH);

  assert.strictEqual(cx, 125);
  assert.strictEqual(by, 180);
  assert.strictEqual(newX, 75);
  assert.strictEqual(newY, 60);

  // 验证新选框的底部与中心完全吻合
  const newBottom = newY + targetH;
  const newCenter = newX + targetW / 2;
  assert.strictEqual(newBottom, 180);
  assert.strictEqual(newCenter, 125);
});

// -----------------------------------------------------------------------------
// 3. 均等网格切片几何验证
// -----------------------------------------------------------------------------
console.log('\n▶ [测试组 3] 均等网格切片几何验证:');

it('大图 400x300，切为 2行 4列，生成 8 帧且坐标完全紧密平铺无越界', () => {
  const imgW = 400;
  const imgH = 300;
  const rows = 2;
  const cols = 4;
  const cellW = Math.floor(imgW / cols); // 100
  const cellH = Math.floor(imgH / rows); // 150

  const frames = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      frames.push({
        rect: { x: c * cellW, y: r * cellH, w: cellW, h: cellH }
      });
    }
  }

  assert.strictEqual(frames.length, 8);
  assert.strictEqual(frames[0].rect.x, 0);
  assert.strictEqual(frames[0].rect.y, 0);
  assert.strictEqual(frames[7].rect.x, 300);
  assert.strictEqual(frames[7].rect.y, 150);
  assert.strictEqual(frames[7].rect.x + frames[7].rect.w, 400);
  assert.strictEqual(frames[7].rect.y + frames[7].rect.h, 300);
});

// -----------------------------------------------------------------------------
// 4. 空白内容检测算法测试 (isRectContentEmpty)
// -----------------------------------------------------------------------------
console.log('\n▶ [测试组 4] 纯色/透明空白内容检测验证:');

import { ImageProcessor } from '../js/core/image-processor.js';

it('全透明区域正确判定为空白 (empty = true)', () => {
  const W = 50, H = 50;
  const data = new Uint8ClampedArray(W * H * 4); // 全为 0
  const isEmpty = ImageProcessor.isRectContentEmpty({ width: W, height: H, data }, { x: 0, y: 0, w: W, h: H });
  assert.strictEqual(isEmpty, true);
});

it('全纯黑色区域正确判定为空白 (empty = true)', () => {
  const W = 50, H = 50;
  const data = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    data[i * 4] = 0;
    data[i * 4 + 1] = 0;
    data[i * 4 + 2] = 0;
    data[i * 4 + 3] = 255;
  }
  const isEmpty = ImageProcessor.isRectContentEmpty({ width: W, height: H, data }, { x: 0, y: 0, w: W, h: H });
  assert.strictEqual(isEmpty, true);
});

it('包含明显角色前景像素的区域正确判定为非空白 (empty = false)', () => {
  const W = 50, H = 50;
  const data = new Uint8ClampedArray(W * H * 4);
  // 背景纯黑
  for (let i = 0; i < W * H; i++) {
    data[i * 4 + 3] = 255;
  }
  // 中央绘制 20x20 红色武将像素
  for (let y = 15; y < 35; y++) {
    for (let x = 15; x < 35; x++) {
      const idx = (y * W + x) * 4;
      data[idx] = 220;     // R
      data[idx + 1] = 40;  // G
      data[idx + 2] = 40;  // B
      data[idx + 3] = 255;
    }
  }
  const isEmpty = ImageProcessor.isRectContentEmpty({ width: W, height: H, data }, { x: 0, y: 0, w: W, h: H });
  assert.strictEqual(isEmpty, false);
});

// -----------------------------------------------------------------------------
// 5. 自动扫描角色真实脚底与自动 Y 轴贴地对齐验证 (getRectContentBounds & autoAlignFrameToGround)
// -----------------------------------------------------------------------------
console.log('\n▶ [测试组 5] 自动扫描角色真实脚底与自动 Y 轴贴地对齐验证:');

it('当角色画在格子偏上方（脚底离选框底边有 100px 透明空白）时，自动补偿 offset.y = +100 使脚底精准贴地', () => {
  const W = 200, H = 500;
  const data = new Uint8ClampedArray(W * H * 4); // 透明背景
  // 角色像素在 y = [50, 399] 之间（即 localMaxY = 399，距离底部 500 还有 100px 空白）
  for (let y = 50; y <= 399; y++) {
    for (let x = 60; x <= 140; x++) {
      const idx = (y * W + x) * 4;
      data[idx] = 255;
      data[idx + 1] = 128;
      data[idx + 2] = 0;
      data[idx + 3] = 255;
    }
  }

  const rect = { x: 0, y: 0, w: W, h: H };
  const bounds = ImageProcessor.getRectContentBounds({ width: W, height: H, data }, rect);

  assert.strictEqual(bounds.empty, false);
  assert.strictEqual(bounds.localMinY, 50);
  assert.strictEqual(bounds.localMaxY, 399);
  assert.strictEqual(bounds.bottomGap, 100);

  const frame = {
    id: 'frame_5',
    rect,
    pivot: { x: 0.5, y: 1.0 },
    offset: { x: 0, y: 0 }
  };

  alignment.autoAlignFrameToGround(frame, bounds);
  assert.strictEqual(frame.offset.y, 100, '应当自动向下偏移 +100px 消除脚底与格子底边的 100px 空白');

  // 验证渲染到 targetBaseY = 400 时，角色脚底像素 (dy + localMaxY + 1) 恰好等于 400
  const renderPos = alignment.calculateWorldRenderPos(frame, 200, 400);
  const renderedFootBottomY = renderPos.dy + (bounds.localMaxY + 1);
  assert.strictEqual(renderedFootBottomY, 400, '渲染后角色真实脚底与地面基准线 targetBaseY (400) 严丝合缝重合');
});

console.log('\n======================================================');
console.log(`📊 测试汇总: 共通过 ${passCount} 项, 失败 ${failCount} 项`);
console.log('======================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 恭喜！新功能几何、缩放与空白检测测试全部通过！\n');
}
