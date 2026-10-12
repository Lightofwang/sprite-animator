/**
 * @file test_exporter.js
 * @description Exporter 多格式导出与排版算法单元测试套件
 * 可通过 node tests/test_exporter.js 独立运行
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

import { Exporter } from '../js/core/exporter.js';

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

function createMockFrames(count, baseSize = 64) {
  const frames = [];
  for (let i = 0; i < count; i++) {
    const w = baseSize + (i % 3) * 8; // 64, 72, 80 动态不同尺寸
    const h = baseSize + (i % 2) * 12; // 64, 76
    frames.push({
      id: `frame_${i + 1}`,
      name: `动作帧 ${i + 1}`,
      rect: { x: i * 80, y: 0, w, h },
      offset: { x: (i % 2) * 2, y: (i % 3) * -1 },
      pivot: { x: 0.5, y: 1.0 },
      maskCanvas: null,
      duration: 100
    });
  }
  return frames;
}

console.log('======================================================');
console.log('🧪 开始运行 Exporter 导出器与无交叉排版单元测试套件');
console.log('======================================================\n');

// ----------------------------------------------------
// 测试组 1: 空帧与单帧安全拦截与边界测试
// ----------------------------------------------------
console.log('▶ [测试组 1] 空帧与单帧安全拦截与边界测试:');

{
  // 1. 空帧拦截测试
  const zipEmpty = await Exporter.exportFramesAsZip([]);
  assert(zipEmpty.success === false, 'exportFramesAsZip 在空帧时成功安全拦截');
  assert(typeof zipEmpty.error === 'string', 'exportFramesAsZip 返回友好的错误提示信息');

  const zipNull = await Exporter.exportFramesAsZip(null);
  assert(zipNull.success === false, 'exportFramesAsZip 在 null 输入时安全拦截');

  const sheetEmpty = await Exporter.exportNewSpriteSheet([]);
  assert(sheetEmpty.success === false, 'exportNewSpriteSheet 在空帧时安全拦截');

  const gifEmpty = await Exporter.exportAnimationAsGif([]);
  assert(gifEmpty.success === false, 'exportAnimationAsGif 在空帧时安全拦截');

  // 2. 单帧边界测试
  const singleFrame = createMockFrames(1, 48);
  const zipSingle = await Exporter.exportFramesAsZip(singleFrame, { download: false });
  assert(zipSingle.success === true, '单帧导出 ZIP 成功处理');
  assert(zipSingle.count === 1, '单帧导出 ZIP 文件数量为 1');
  assert(zipSingle.json.frames.length === 1, '单帧 animation.json 包含恰好 1 帧元数据');

  const sheetSingle = await Exporter.exportNewSpriteSheet(singleFrame, { download: false });
  assert(sheetSingle.success === true, '单帧导出 Sprite Sheet 成功');
  assert(sheetSingle.layout.columns === 1 && sheetSingle.layout.rows === 1, '单帧排版网格为 1x1');

  const gifSingle = await Exporter.exportAnimationAsGif(singleFrame, { download: false });
  assert(gifSingle.success === true, '单帧导出 GIF 成功');
  assert(gifSingle.count === 1, '单帧 GIF 帧数为 1');
}

// ----------------------------------------------------
// 测试组 2: 重新排版新 Sprite Sheet 的网格坐标与无重叠无交叉算法
// ----------------------------------------------------
console.log('\n▶ [测试组 2] 规整 Sprite Sheet 网格排版与无交叉重叠几何算法测试:');

{
  // 测试 6 个不同尺寸帧的排版
  const frames = createMockFrames(6, 50); // 帧尺寸各不相同
  const padding = 16;
  const layout = Exporter.calculateSpriteSheetLayout(frames, { padding, columns: 3 });

  assert(layout.columns === 3, '指定列数 columns = 3 正确应用');
  assert(layout.rows === 2, '6 帧在 3 列下正确计算为 2 行');
  assert(layout.items.length === 6, '排版结果项包含全部 6 帧');

  // 验证最大单元格尺寸
  const expectedMaxW = Math.max(...frames.map(f => f.rect.w));
  const expectedMaxH = Math.max(...frames.map(f => f.rect.h));
  assert(layout.cellW === expectedMaxW, `网格单元格宽度 (${layout.cellW}) 等于所有帧的最大宽度 (${expectedMaxW})`);
  assert(layout.cellH === expectedMaxH, `网格单元格高度 (${layout.cellH}) 等于所有帧的最大高度 (${expectedMaxH})`);

  // 验证总尺寸公式
  const expectedWidth = padding + 3 * (layout.cellW + padding);
  const expectedHeight = padding + 2 * (layout.cellH + padding);
  assert(layout.width === expectedWidth, `大图宽度计算精准 (${layout.width}px = 16 + 3 * (${layout.cellW} + 16))`);
  assert(layout.height === expectedHeight, `大图高度计算精准 (${layout.height}px = 16 + 2 * (${layout.cellH} + 16))`);

  // 核心几何无交叉验证：检查任意两个帧在新大图上的包围盒严格没有交集
  let anyOverlap = false;
  let minDistance = Infinity;

  for (let i = 0; i < layout.items.length; i++) {
    const itemA = layout.items[i];
    // 检查所有帧是否完整位于画布内部
    assert(itemA.x >= 0 && itemA.y >= 0, `第 ${i + 1} 帧坐标落在画布有效正区域内 (x=${itemA.x}, y=${itemA.y})`);
    assert(
      itemA.x + itemA.w <= layout.width && itemA.y + itemA.h <= layout.height,
      `第 ${i + 1} 帧未超出大图右下边界 (max: ${layout.width}x${layout.height})`
    );

    for (let j = i + 1; j < layout.items.length; j++) {
      const itemB = layout.items[j];
      const overlapX = !(itemA.x + itemA.w <= itemB.x || itemB.x + itemB.w <= itemA.x);
      const overlapY = !(itemA.y + itemA.h <= itemB.y || itemB.y + itemB.h <= itemA.y);
      if (overlapX && overlapY) {
        anyOverlap = true;
        console.error(`  发现重叠: 帧 ${i} 与 帧 ${j}`);
      }

      // 计算同一行相邻帧的水平间距
      if (itemA.row === itemB.row && Math.abs(itemA.col - itemB.col) === 1) {
        const left = itemA.col < itemB.col ? itemA : itemB;
        const right = itemA.col < itemB.col ? itemB : itemA;
        const dist = right.x - (left.x + left.w);
        if (dist < minDistance) minDistance = dist;
      }
    }
  }

  assert(anyOverlap === false, '所有 6 帧在新大图上的包围盒互不重叠、绝对无任何穿插交叉！');
  assert(minDistance >= padding, `同一行相邻帧之间的最小物理间距 (${minDistance}px) >= 安全间距 (${padding}px)`);

  // 验证自适应网格计算 (未指定 columns 时自动根据平方根排版)
  const layoutAuto4 = Exporter.calculateSpriteSheetLayout(createMockFrames(4));
  assert(layoutAuto4.columns === 2 && layoutAuto4.rows === 2, '4 帧自动排版为 2 列 2 行方阵');

  const layoutAuto9 = Exporter.calculateSpriteSheetLayout(createMockFrames(9));
  assert(layoutAuto9.columns === 3 && layoutAuto9.rows === 3, '9 帧自动排版为 3 列 3 行方阵');

  const layoutAuto10 = Exporter.calculateSpriteSheetLayout(createMockFrames(10));
  assert(layoutAuto10.columns === 4 && layoutAuto10.rows === 3, '10 帧自动排版为 4 列 3 行规整网格');
}

// ----------------------------------------------------
// 测试组 3: ZIP 打包数据结构与元数据 JSON 验证
// ----------------------------------------------------
console.log('\n▶ [测试组 3] ZIP 打包数据结构与 animation.json 元数据验证:');

{
  const frames = createMockFrames(4, 64);
  let progressCount = 0;

  const result = await Exporter.exportFramesAsZip(frames, {
    fps: 24,
    name: 'warrior_slash',
    download: false,
    onProgress: (cur, tot) => {
      progressCount++;
    }
  });

  assert(result.success === true, 'exportFramesAsZip 执行成功');
  assert(result.count === 4, '导出帧总数为 4');
  assert(progressCount > 0, '导出过程中成功触发了进度汇报');

  // 校验元数据 JSON 内容
  const meta = result.json;
  assert(meta.name === 'warrior_slash', 'animation.json 动画名称匹配');
  assert(meta.fps === 24, 'animation.json 帧率精准记录为 24');
  assert(meta.totalFrames === 4, 'animation.json 总帧数精准记录为 4');
  assert(meta.frameDurationMs === Math.round(1000 / 24), 'animation.json 单帧时长精准记录');
  assert(Array.isArray(meta.frames) && meta.frames.length === 4, 'animation.json 包含全部 4 帧详细元数据');

  // 校验第一帧与第二帧的命名与属性
  const f0 = meta.frames[0];
  assert(f0.name === 'frame_001.png', '第一帧规范命名为 frame_001.png');
  assert(f0.rect.w === frames[0].rect.w && f0.rect.h === frames[0].rect.h, '第一帧矩形尺寸元数据无损记录');
  assert(f0.pivot.x === 0.5 && f0.pivot.y === 1.0, '第一帧中心底部锚点正确记录');
  assert(f0.offset !== undefined, '第一帧偏移量字段存在');

  const f1 = meta.frames[1];
  assert(f1.name === 'frame_002.png', '第二帧规范命名为 frame_002.png');
}

// ----------------------------------------------------
// 测试组 4: 动图 GIF 编码与帧率/尺寸验证
// ----------------------------------------------------
console.log('\n▶ [测试组 4] 动图 GIF 编码引擎与视口对齐验证:');

{
  const frames = createMockFrames(3, 32);
  let gifProgressFired = false;

  const gifResult = await Exporter.exportAnimationAsGif(frames, {
    fps: 15,
    width: 128,
    height: 128,
    download: false,
    onProgress: (cur, tot, msg) => {
      gifProgressFired = true;
    }
  });

  assert(gifResult.success === true, 'exportAnimationAsGif 导出动图成功');
  assert(gifResult.count === 3, 'GIF 导出帧数准确为 3');
  assert(gifResult.fps === 15, 'GIF 帧率配置为 15 FPS');
  assert(gifResult.width === 128 && gifResult.height === 128, 'GIF 视口宽高设定为 128x128');
  assert(gifProgressFired === true, 'GIF 导出过程中平滑汇报进度信息');
}

console.log('\n======================================================');
console.log(`📊 测试结果: ${passed} 通过, ${failed} 失败`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 全部 Exporter 单元测试通过！');
}
