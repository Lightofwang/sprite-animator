/**
 * @file test_gif_decoder.js
 * @description GifDecoder 纯 JS 解码与序列帧拆分单元测试套件
 * 可通过 node tests/test_gif_decoder.js 独立运行
 */

// Node.js 兼容模拟全局环境
if (typeof globalThis.Blob === 'undefined') {
  globalThis.Blob = class MockBlob {
    constructor(parts, options = {}) {
      this.parts = parts;
      this.type = options.type || '';
      let sz = 0;
      for (const p of parts) {
        if (p) sz += (p.length !== undefined ? p.length : (p.byteLength || 0));
      }
      this.size = sz;
    }
  };
}

import { GIFEncoder } from '../js/vendor/gifshot.min.js';
import { GifDecoder } from '../js/core/gif-decoder.js';

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

console.log('======================================================');
console.log('🧪 开始运行 GifDecoder GIF动图解码与拆分单元测试套件');
console.log('======================================================\n');

// ----------------------------------------------------
// 测试组 1: isGif 校验测试
// ----------------------------------------------------
console.log('▶ [测试组 1] isGif 格式探针校验:');

{
  const gif89aHeader = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x10, 0x00]); // "GIF89a"
  assert(GifDecoder.isGif(gif89aHeader) === true, '正确识别 GIF89a 头部标识');

  const gif87aHeader = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x10, 0x00]); // "GIF87a"
  assert(GifDecoder.isGif(gif87aHeader) === true, '正确识别 GIF87a 头部标识');

  const pngHeader = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG
  assert(GifDecoder.isGif(pngHeader) === false, '正确拒绝 PNG 头部标识');

  assert(GifDecoder.isGif(null) === false, 'null 输入安全返回 false');
  assert(GifDecoder.isGif(new Uint8Array(3)) === false, '过短输入安全返回 false');
}

// ----------------------------------------------------
// 测试组 2: 真实 GIF 编码生成与纯 JS 全量解码
// ----------------------------------------------------
console.log('\n▶ [测试组 2] 真实多帧 GIF 动图编码与解码验证:');

{
  const w = 32;
  const h = 32;
  const encoder = new GIFEncoder(w, h, { loop: 0 });

  // 生成 3 帧不同色块的测试图像 (红色、绿色、蓝色)
  const colors = [
    [255, 0, 0, 255],   // 红
    [0, 255, 0, 255],   // 绿
    [0, 0, 255, 255]    // 蓝
  ];

  for (let f = 0; f < 3; f++) {
    const data = new Uint8ClampedArray(w * h * 4);
    const [r, g, b, a] = colors[f];
    for (let p = 0; p < w * h; p++) {
      data[p * 4] = r;
      data[p * 4 + 1] = g;
      data[p * 4 + 2] = b;
      data[p * 4 + 3] = a;
    }
    encoder.addFrame({ width: w, height: h, data }, 100); // 100ms
  }

  const gifBlob = encoder.toBlob();
  const gifBytes = new Uint8Array(gifBlob.parts[0]);

  assert(gifBytes.length > 50, `GIF 编码器成功生成 ${gifBytes.length} 字节 GIF 二进制数据`);
  assert(GifDecoder.isGif(gifBytes) === true, '生成的二进制数据通过 isGif 校验');

  // 调用纯 JS 解码
  const decoded = await GifDecoder.decode(gifBytes, { forcePureJs: true });

  assert(decoded.width === w && decoded.height === h, `逻辑屏幕宽高精准识别为 ${w} × ${h}`);
  assert(decoded.frameCount === 3, '成功提取出全部 3 个动作帧');
  assert(decoded.frames.length === 3, 'frames 数组包含 3 个帧对象');
  assert(decoded.durationMs === 300, `总动画时长精准累加为 ${decoded.durationMs}ms (3帧 × 100ms)`);
  assert(decoded.avgFps === 10, `平均帧率精准计算为 ${decoded.avgFps} FPS`);

  // 验证各帧属性
  for (let i = 0; i < decoded.frames.length; i++) {
    const frame = decoded.frames[i];
    assert(frame.index === i, `第 ${i + 1} 帧索引为 ${i}`);
    assert(frame.delay === 100, `第 ${i + 1} 帧延迟时间精准为 100ms`);
    assert(frame.canvas !== null, `第 ${i + 1} 帧具备合成 Canvas`);
  }

  // ----------------------------------------------------
  // 测试组 3: 拼装 Sprite Sheet 规整大图与选框元数据
  // ----------------------------------------------------
  console.log('\n▶ [测试组 3] 拼装 Sprite Sheet 与选框元数据生成测试:');

  const sheetData = GifDecoder.assembleSpriteSheet(decoded, { padding: 4, columns: 2 });
  assert(sheetData.columns === 2 && sheetData.rows === 2, '3 帧在 columns=2 下排版为 2列 2行');
  assert(sheetData.cellW === w && sheetData.cellH === h, `单元格宽高等于单帧宽高 (${w} × ${h})`);
  assert(sheetData.frames.length === 3, '生成刚好 3 个 Frame 元数据对象');

  // 校验第一帧与第二帧的选框坐标与默认对齐属性
  const f0 = sheetData.frames[0];
  const f1 = sheetData.frames[1];
  assert(f0.rect.x === 4 && f0.rect.y === 4, '第 1 帧选框坐标精准放置在 (4, 4)');
  assert(f0.rect.w === w && f0.rect.h === h, '第 1 帧选框尺寸为 32 × 32');
  assert(f0.pivot.x === 0.5 && f0.pivot.y === 1.0, '第 1 帧默认脚底中心锚点 (0.5, 1.0)');
  assert(f0.duration === 100, '第 1 帧单帧时长同步为 100ms');

  // 第二帧位于第 1 行第 2 列：x = 4 + 1 * (32 + 4) = 40, y = 4
  assert(f1.rect.x === 40 && f1.rect.y === 4, '第 2 帧选框坐标精准放置在 (40, 4)');

  // ----------------------------------------------------
  // 测试组 4: 导出 ZIP 序列帧包与 animation.json 验证
  // ----------------------------------------------------
  console.log('\n▶ [测试组 4] 导出 ZIP 序列帧包测试:');

  const zipResult = await GifDecoder.splitFramesToZip(decoded, { namePrefix: 'action' });
  assert(zipResult.count === 3, 'ZIP 导出包包含 3 帧动作');
  assert(zipResult.blob !== null, '成功生成 ZIP Blob');
}

console.log('\n======================================================');
console.log(`📊 测试结果: ${passed} 通过, ${failed} 失败`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 全部 GifDecoder 单元测试顺利通过！');
}
