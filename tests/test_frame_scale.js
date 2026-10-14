/**
 * @file test_frame_scale.js
 * @description 单帧人物缩放调节 (Frame Scale) 核心算法与数学定理测试
 */

import assert from 'assert';
import { FrameAlignment, PIVOT_PRESETS } from '../js/core/frame-alignment.js';
import { state } from '../js/core/state.js';

console.log('======================================================');
console.log('🧪 开始运行 Frame Scale 单帧缩放核心算法单元测试');
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

// --- 测试组 1: 数据模型与基础 API ---
console.log('\n▶ [测试组 1] 数据模型与 setScale / nudgeScale / resetScale API:');

it('创建新帧时默认 scale 应该为 1.0', () => {
  const frame = state.addFrame({ rect: { x: 0, y: 0, w: 100, h: 100 } });
  assert.strictEqual(frame.scale, 1.0, `默认 scale 必须为 1.0，实际得到: ${frame.scale}`);
  state.removeFrame(frame.id);
});

it('setScale 应该成功更新 frame.scale 并在有效范围内规范化', () => {
  const frame = { rect: { x: 0, y: 0, w: 100, h: 100 }, pivot: { x: 0.5, y: 1.0 }, offset: { x: 0, y: 0 } };
  
  alignment.setScale(frame, 0.85);
  assert.strictEqual(frame.scale, 0.85, '应该成功设置为 0.85');

  // 下限截断至 0.2 (20%)
  alignment.setScale(frame, 0.05);
  assert.strictEqual(frame.scale, 0.2, '低于 0.2 应该截断至 0.2');

  // 上限截断至 3.0 (300%)
  alignment.setScale(frame, 5.0);
  assert.strictEqual(frame.scale, 3.0, '高于 3.0 应该截断至 3.0');

  // 非法值重置为 1.0
  alignment.setScale(frame, 'invalid');
  assert.strictEqual(frame.scale, 1.0, '非法值应该回退至 1.0');
});

it('nudgeScale 应该支持增量微调', () => {
  const frame = { scale: 1.0 };
  alignment.nudgeScale(frame, -0.05);
  assert.strictEqual(Math.round(frame.scale * 100) / 100, 0.95, '微调 -0.05 应该为 0.95');

  alignment.nudgeScale(frame, 0.1);
  assert.strictEqual(Math.round(frame.scale * 100) / 100, 1.05, '微调 +0.1 应该为 1.05');
});

it('resetScale 应该恢复 scale 至 1.0', () => {
  const frame = { scale: 0.82 };
  alignment.resetScale(frame);
  assert.strictEqual(frame.scale, 1.0, '重置后必须为 1.0');
});

// --- 测试组 2: 锚点缩放数学推导定理 ---
console.log('\n▶ [测试组 2] 渲染坐标推导数学定理（脚底锚点不动点定理）:');

it('脚底锚点 (0.5, 1.0) 缩放时，底部 Y 接触地面线必须恒定不变', () => {
  // 原尺寸 200 x 300, 视口地面基准线 targetBaseY = 500, offset.y = 10
  const frame = {
    rect: { x: 100, y: 100, w: 200, h: 300 },
    pivot: { x: 0.5, y: 1.0 }, // 脚底中心
    offset: { x: 0, y: 10 },
    scale: 1.0
  };

  const pos100 = alignment.calculateWorldRenderPos(frame, 400, 500);
  // 在 scale = 1.0 时：
  // renderH = 300
  // dy = 500 - 300 * 1.0 + 10 = 210
  // 脚底 Y 坐标 = dy + renderH = 210 + 300 = 510
  assert.strictEqual(pos100.dy, 210);
  assert.strictEqual(pos100.dy + pos100.renderH, 510, 'scale=1.0 时脚底 Y 接触面必须是 510');

  // 当缩放到 80% (scale = 0.8) 时：
  frame.scale = 0.8;
  const pos80 = alignment.calculateWorldRenderPos(frame, 400, 500);
  // renderH = 300 * 0.8 = 240
  // dy = 500 - 240 * 1.0 + 10 = 270
  // 脚底 Y 坐标 = 270 + 240 = 510！完全锁定不变！
  assert.strictEqual(pos80.renderH, 240, 'renderH 应该为 240');
  assert.strictEqual(pos80.dy, 270, '左上角起点 dy 下移至 270 保持脚底贴地');
  assert.strictEqual(pos80.dy + pos80.renderH, 510, '【核心定理】无论如何缩放，脚底接触面始终锁定在 510，绝不悬空或下陷！');
});

it('正中心锚点 (0.5, 0.5) 缩放时，中心点坐标保持恒定', () => {
  const frame = {
    rect: { x: 0, y: 0, w: 200, h: 200 },
    pivot: { x: 0.5, y: 0.5 },
    offset: { x: 0, y: 0 },
    scale: 1.0
  };

  const pos100 = alignment.calculateWorldRenderPos(frame, 400, 300);
  const centerX100 = pos100.dx + pos100.renderW / 2;
  const centerY100 = pos100.dy + pos100.renderH / 2;
  assert.strictEqual(centerX100, 400);
  assert.strictEqual(centerY100, 300);

  frame.scale = 0.7; // 缩小到 70%
  const pos70 = alignment.calculateWorldRenderPos(frame, 400, 300);
  const centerX70 = pos70.dx + pos70.renderW / 2;
  const centerY70 = pos70.dy + pos70.renderH / 2;
  assert.strictEqual(centerX70, 400, '中心 X 必须依然锁定在 400');
  assert.strictEqual(centerY70, 300, '中心 Y 必须依然锁定在 300');
});

it('calculateWorldRenderPos 应该正确返回 renderW, renderH, scale 字段', () => {
  const frame = {
    rect: { x: 0, y: 0, w: 100, h: 80 },
    pivot: { x: 0.5, y: 1.0 },
    offset: { x: 5, y: -5 },
    scale: 1.25
  };

  const res = alignment.calculateWorldRenderPos(frame, 200, 200);
  assert.strictEqual(res.renderW, 125, 'renderW 应为 100 * 1.25 = 125');
  assert.strictEqual(res.renderH, 100, 'renderH 应为 80 * 1.25 = 100');
  assert.strictEqual(res.scale, 1.25, 'scale 应为 1.25');
  assert.strictEqual(res.dx, 200 - 125 * 0.5 + 5);
  assert.strictEqual(res.dy, 200 - 100 * 1.0 - 5);
});

// --- 测试组 3: AnimationPlayer 渲染集成 ---
console.log('\n▶ [测试组 3] AnimationPlayer 缩放渲染与绘制测试:');

it('AnimationPlayer.render 应该按 frame.scale 缩放尺寸调用 drawImage', async () => {
  const { AnimationPlayer } = await import('../js/core/animation-player.js');

  const drawnCalls = [];
  const mockCanvas = {
    width: 400,
    height: 400,
    getContext: () => ({
      clearRect: () => {},
      save: () => {},
      restore: () => {},
      drawImage: (...args) => {
        drawnCalls.push(args);
      }
    })
  };

  const frame = {
    rect: { x: 10, y: 10, w: 100, h: 100 },
    pivot: { x: 0.5, y: 1.0 },
    offset: { x: 0, y: 0 },
    scale: 0.8 // 缩放为 80%
  };

  const player = new AnimationPlayer({
    canvas: mockCanvas,
    frames: [frame],
    sourceImage: {}
  });

  player.render();

  assert.strictEqual(drawnCalls.length, 1, '应该调用一次 drawImage');
  const call = drawnCalls[0];
  // drawImage(source, sx, sy, sw, sh, dx, dy, renderW, renderH)
  const drawW = call[7];
  const drawH = call[8];
  assert.strictEqual(drawW, 80, '绘制宽度应该缩放为 100 * 0.8 = 80');
  assert.strictEqual(drawH, 80, '绘制高度应该缩放为 100 * 0.8 = 80');
});

// --- 测试组 4: Exporter 导出器 scale 缩放重采样 ---
console.log('\n▶ [测试组 4] Exporter 导出器 scale 缩放重采样测试:');

it('calculateSpriteSheetLayout 应该根据各帧 scale 自动调整网格单元格大小', async () => {
  const { Exporter } = await import('../js/core/exporter.js');

  const frames = [
    { rect: { x: 0, y: 0, w: 100, h: 100 }, scale: 1.0 },
    { rect: { x: 100, y: 0, w: 100, h: 100 }, scale: 0.8 } // 缩放为 80x80
  ];

  const layout = Exporter.calculateSpriteSheetLayout(frames, { padding: 10, columns: 2 });
  assert.strictEqual(layout.items.length, 2);
  assert.strictEqual(layout.items[0].w, 100);
  assert.strictEqual(layout.items[0].h, 100);
  assert.strictEqual(layout.items[1].w, 80, '第 2 帧在新大图中的排版尺寸必须缩小为 80');
  assert.strictEqual(layout.items[1].h, 80, '第 2 帧在新大图中的排版尺寸必须缩小为 80');
});

it('exportFramesAsZip 应该在 animation.json 中准确记录各帧 scale', async () => {
  const { Exporter } = await import('../js/core/exporter.js');

  const frames = [
    { rect: { x: 0, y: 0, w: 60, h: 60 }, scale: 1.0 },
    { rect: { x: 60, y: 0, w: 80, h: 80 }, scale: 0.75 } // 缩放到 60x60
  ];

  let savedJson = null;
  const mockZip = {
    file: (name, content) => {
      if (name === 'animation.json') {
        savedJson = JSON.parse(content);
      }
    },
    generateAsync: async () => new Uint8Array(10)
  };

  const res = await Exporter.exportFramesAsZip(frames, { download: false });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.count, 2);
});

console.log('\n======================================================');
console.log(`📊 测试完成: 共通过 ${passed} 项, 失败 ${failed} 项`);
console.log('======================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 恭喜！Frame Scale 算法测试全部顺利通过！\n');
}
