/**
 * @file test_image_processor.js
 * @description ImageProcessor 单元测试套件 (可直接通过 node tests/test_image_processor.js 运行)
 */

import { ImageProcessor, createImageDataObject } from '../js/core/image-processor.js';

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

function assertDeepEqual(actual, expected, message) {
  const isMatch = JSON.stringify(actual) === JSON.stringify(expected);
  if (isMatch) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${message}`);
    passed++;
  } else {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${message}\n      期望: ${JSON.stringify(expected)}\n      实际: ${JSON.stringify(actual)}`);
    failed++;
  }
}

/**
 * 辅助函数：在 ImageData 上绘制一个矩形色块
 */
function fillRect(imageData, rx, ry, rw, rh, r, g, b, a = 255) {
  const { width, height, data } = imageData;
  for (let y = ry; y < ry + rh; y++) {
    for (let x = rx; x < rx + rw; x++) {
      if (x >= 0 && x < width && y >= 0 && y < height) {
        const offset = (y * width + x) * 4;
        data[offset] = r;
        data[offset + 1] = g;
        data[offset + 2] = b;
        data[offset + 3] = a;
      }
    }
  }
}

console.log('\n======================================================');
console.log('🧪 开始运行 ImageProcessor 单元测试套件');
console.log('======================================================\n');

// ----------------------------------------------------
// 测试组 1: removeColorBackground 纯色背景透明化
// ----------------------------------------------------
console.log('▶ [测试组 1] removeColorBackground 背景抠除与容差测试:');

// 测试 1.1: 白色纯色背景扣除
{
  const width = 10;
  const height = 10;
  const imgData = createImageDataObject(width, height);

  // 全图填满纯白背景 (255, 255, 255, 255)
  fillRect(imgData, 0, 0, width, height, 255, 255, 255, 255);

  // 中间绘制一个 4x4 的红色前景角色 (255, 0, 0, 255)
  fillRect(imgData, 3, 3, 4, 4, 255, 0, 0, 255);

  // 执行去白底，容差 10
  ImageProcessor.removeColorBackground(imgData, { r: 255, g: 255, b: 255 }, 10);

  // 验证背景 (0, 0) 是否已透明 (A=0)
  const bgSample = ImageProcessor.sampleColor(imgData, 0, 0);
  assert(bgSample.a === 0, '白色背景像素被成功转换为透明通道 (Alpha = 0)');

  // 验证前景 (4, 4) 红色角色是否保留不透明且颜色未变
  const fgSample = ImageProcessor.sampleColor(imgData, 4, 4);
  assert(
    fgSample.a === 255 && fgSample.r === 255 && fgSample.g === 0 && fgSample.b === 0,
    '前景非背景色角色像素完全保留，Alpha = 255 且 RGB 正常'
  );
}

// 测试 1.2: 绿幕扣除与容差波动处理
{
  const width = 20;
  const height = 20;
  const imgData = createImageDataObject(width, height);

  // 填满纯绿幕 (0, 255, 0, 255)
  fillRect(imgData, 0, 0, width, height, 0, 255, 0, 255);

  // 在左上角添加有色彩波动的轻微噪点绿幕 (15, 245, 10, 255)
  fillRect(imgData, 1, 1, 3, 3, 15, 245, 10, 255);

  // 在右下角添加一个蓝色角色 (0, 50, 220, 255)
  fillRect(imgData, 10, 10, 6, 6, 0, 50, 220, 255);

  // 绿幕扣除，容差 30
  ImageProcessor.removeColorBackground(imgData, [0, 255, 0], 30);

  const pureGreen = ImageProcessor.sampleColor(imgData, 0, 0);
  const noisyGreen = ImageProcessor.sampleColor(imgData, 2, 2);
  const blueCharacter = ImageProcessor.sampleColor(imgData, 12, 12);

  assert(pureGreen.a === 0, '纯绿幕 (0, 255, 0) 成功透明化');
  assert(noisyGreen.a === 0, '容差范围内的轻微波动绿幕 (15, 245, 10) 成功透明化');
  assert(blueCharacter.a === 255 && blueCharacter.b === 220, '蓝色角色 (0, 50, 220) 不受影响保留不透明');
}

// 测试 1.3: 容差边界测试
{
  const width = 4;
  const height = 4;
  const imgData = createImageDataObject(width, height);

  // 填充基准色 (100, 100, 100)
  fillRect(imgData, 0, 0, 4, 4, 100, 100, 100, 255);

  // 坐标 (0, 0): 偏差 8 (在容差 10 内) -> (108, 96, 100)
  const off1 = 0;
  imgData.data[off1] = 108;
  imgData.data[off1 + 1] = 96;
  imgData.data[off1 + 2] = 100;

  // 坐标 (1, 1): 偏差 15 (超过容差 10) -> (115, 100, 100)
  const off2 = (1 * 4 + 1) * 4;
  imgData.data[off2] = 115;
  imgData.data[off2 + 1] = 100;
  imgData.data[off2 + 2] = 100;

  ImageProcessor.removeColorBackground(imgData, '#646464', 10);

  assert(imgData.data[off1 + 3] === 0, '偏差 8 在容差 10 内被正确扣除 (Alpha = 0)');
  assert(imgData.data[off2 + 3] === 255, '偏差 15 超过容差 10 被正确保留 (Alpha = 255)');
}

// ----------------------------------------------------
// 测试组 2: detectBoundingBoxes 连通域包围盒提取
// ----------------------------------------------------
console.log('\n▶ [测试组 2] detectBoundingBoxes 连通域分析与包围盒提取测试:');

// 测试 2.1: 单一独立精灵提取
{
  const width = 64;
  const height = 64;
  const imgData = createImageDataObject(width, height); // 默认全透明

  // 在 (12, 16) 绘制宽 14, 高 20 的不透明精灵
  fillRect(imgData, 12, 16, 14, 20, 200, 100, 50, 255);

  const boxes = ImageProcessor.detectBoundingBoxes(imgData, 5, 2);
  assert(boxes.length === 1, '准确识别出 1 个独立精灵');
  assertDeepEqual(
    boxes[0],
    { x: 12, y: 16, width: 14, height: 20 },
    '单一精灵外接矩形 (x, y, width, height) 边界完全精准'
  );
}

// 测试 2.2: 多个分离精灵帧排版识别与排序
{
  const width = 120;
  const height = 100;
  const imgData = createImageDataObject(width, height);

  // 第一行：精灵 A (10, 10, 20, 20)，精灵 B (60, 10, 20, 20)
  fillRect(imgData, 10, 10, 20, 20, 255, 0, 0, 255);
  fillRect(imgData, 60, 10, 20, 20, 0, 255, 0, 255);

  // 第二行：精灵 C (10, 60, 20, 20)，精灵 D (60, 60, 20, 20)
  fillRect(imgData, 10, 60, 20, 20, 0, 0, 255, 255);
  fillRect(imgData, 60, 60, 20, 20, 255, 255, 0, 255);

  const boxes = ImageProcessor.detectBoundingBoxes(imgData, 5, 4);
  assert(boxes.length === 4, '识别出全图全部 4 个分离精灵帧');
  assertDeepEqual(
    boxes.map(b => ({ x: b.x, y: b.y })),
    [
      { x: 10, y: 10 },
      { x: 60, y: 10 },
      { x: 10, y: 60 },
      { x: 60, y: 60 }
    ],
    '排版自然阅读顺序排序正确（先按行，同按列）'
  );
}

// 测试 2.3: 过滤噪声孤岛 (minSize)
{
  const width = 80;
  const height = 80;
  const imgData = createImageDataObject(width, height);

  // 正常精灵：位于 (20, 20)，尺寸 16x16
  fillRect(imgData, 20, 20, 16, 16, 255, 255, 255, 255);

  // 噪声 1: (5, 5) 处 2x2 的孤立杂点
  fillRect(imgData, 5, 5, 2, 2, 255, 255, 255, 255);

  // 噪声 2: (60, 60) 处 3x3 的孤立杂点
  fillRect(imgData, 60, 60, 3, 3, 255, 255, 255, 255);

  // 噪声 3: (40, 5) 处 1 个孤立单像素
  fillRect(imgData, 40, 5, 1, 1, 255, 255, 255, 255);

  // minSize 设置为 8
  const boxes = ImageProcessor.detectBoundingBoxes(imgData, 8, 2);
  assert(boxes.length === 1, '成功过滤所有小于 minSize 的噪声孤岛，仅提取有效精灵');
  assertDeepEqual(
    boxes[0],
    { x: 20, y: 20, width: 16, height: 16 },
    '正常精灵外接矩形保留完整无损'
  );
}

// 测试 2.4: 相邻过近连通块合并 (mergeDistance)
{
  const width = 80;
  const height = 80;
  const imgData = createImageDataObject(width, height);

  // 角色头部：(20, 10)，宽 16，高 8
  fillRect(imgData, 20, 10, 16, 8, 255, 100, 100, 255);

  // 角色身体：(20, 21)，宽 16，高 20 （垂直间距为 21 - (10 + 8) = 3 像素）
  fillRect(imgData, 20, 21, 16, 20, 100, 100, 255, 255);

  // 情况 A: mergeDistance = 4 (>= 3)，头部与身体应合并为一个完整角色外接矩形
  const mergedBoxes = ImageProcessor.detectBoundingBoxes(imgData, 5, 4);
  assert(mergedBoxes.length === 1, 'mergeDistance = 4 时，相邻部件成功合并为 1 个整体');
  assertDeepEqual(
    mergedBoxes[0],
    { x: 20, y: 10, width: 16, height: 31 },
    '合并后外接矩形准确覆盖头部与身体 (高 31)'
  );

  // 情况 B: mergeDistance = 1 (< 3)，不发生合并，应保留两个独立矩形
  const separateBoxes = ImageProcessor.detectBoundingBoxes(imgData, 5, 1);
  assert(separateBoxes.length === 2, 'mergeDistance = 1 时，保持为 2 个独立部件不合并');
}

// ----------------------------------------------------
// 测试总结
// ----------------------------------------------------
console.log('\n======================================================');
console.log(`📊 测试结果: ${passed} 通过, ${failed} 失败`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\x1b[32m🎉 全部测试通过！\x1b[0m\n');
  process.exit(0);
}
