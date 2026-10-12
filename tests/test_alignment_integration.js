/**
 * @file test_alignment_integration.js
 * @description 验证 SpriteAnimatorApp 中锚点对齐、九宫格、偏移量输入、洋葱皮与键盘微调的集成交互测试
 */

import { state } from '../js/core/state.js';
import { frameAlignment } from '../js/core/frame-alignment.js';

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
console.log('🧪 开始运行 Alignment & Onion Skin 界面集成逻辑测试');
console.log('======================================================\n');

// 1. 初始化测试数据
state.setState({
  frames: [
    {
      id: 'frame_1',
      name: '帧 1',
      rect: { x: 0, y: 0, w: 100, h: 100 },
      pivot: { x: 0.5, y: 1.0 },
      offset: { x: 0, y: 0 }
    },
    {
      id: 'frame_2',
      name: '帧 2',
      rect: { x: 100, y: 0, w: 100, h: 100 },
      pivot: { x: 0.0, y: 0.0 },
      offset: { x: 5, y: -8 }
    }
  ],
  selectedFrameId: 'frame_1',
  playerState: {
    isPlaying: false,
    fps: 12,
    onionSkin: false,
    showGround: true,
    showPivot: true
  }
});

// 测试 1: 九宫格点击切换与状态同步
console.log('▶ [集成测试 1] 九宫格点击切换与状态联动:');
{
  const frame = state.getSelectedFrame();
  assert(frame.id === 'frame_1', '当前选中 frame_1');
  assert(frame.pivot.x === 0.5 && frame.pivot.y === 1.0, '初始锚点为底部居中 (0.5, 1.0)');

  // 模拟点击九宫格正中心 'center'
  frameAlignment.setPivotPreset(frame, 'center');
  state.updateFrame(frame.id, { pivot: { ...frame.pivot } });

  const updated = state.getSelectedFrame();
  assert(updated.pivot.x === 0.5 && updated.pivot.y === 0.5, '点击正中心后 pivot 变为 (0.5, 0.5)');

  // 匹配对应的高亮键名
  const matchedKey = frameAlignment.getPivotPresetKey(updated);
  assert(matchedKey === 'center', '高亮键名为 "center"');
}

// 测试 2: 切换选中帧时自动恢复对应九宫格高亮
console.log('\n▶ [集成测试 2] 切换选帧时九宫格对应关系:');
{
  state.selectFrame('frame_2');
  const frame2 = state.getSelectedFrame();
  assert(frame2.id === 'frame_2', '切换选中为 frame_2');

  const key2 = frameAlignment.getPivotPresetKey(frame2);
  assert(key2 === 'top-left', 'frame_2 的锚点自动匹配为 "top-left"');
  assert(frame2.offset.x === 5 && frame2.offset.y === -8, 'frame_2 的偏移量为 (5, -8)');
}

// 测试 3: 偏移量微调与双向更新
console.log('\n▶ [集成测试 3] 偏移量方向键微调与输入同步:');
{
  state.selectFrame('frame_1');
  const frame1 = state.getSelectedFrame();

  // 模拟方向键微调
  // 1px 向右
  frameAlignment.nudgeOffset(frame1, 1, 0);
  assert(frame1.offset.x === 1, '右方向键 nudge 1px: offset.x = 1');

  // Shift + 10px 向下
  frameAlignment.nudgeOffset(frame1, 0, 10);
  assert(frame1.offset.y === 10, 'Shift + 下方向键 nudge 10px: offset.y = 10');

  // 验证世界视口渲染坐标推导
  const pos = frameAlignment.calculateWorldRenderPos(frame1, 128, 200);
  // targetBaseX = 128, w = 100, pivot.x = 0.5, offset.x = 1 -> 128 - 50 + 1 = 79
  // targetBaseY = 200, h = 100, pivot.y = 0.5, offset.y = 10 -> 200 - 50 + 10 = 160
  assert(pos.dx === 79, '实际渲染 dx = 79');
  assert(pos.dy === 160, '实际渲染 dy = 160');
}

// 测试 4: 洋葱皮与地面参考线状态驱动
console.log('\n▶ [集成测试 4] 洋葱皮残影与地面参考线状态响应:');
{
  state.setPlayerState({ onionSkin: true });
  assert(state.get('playerState').onionSkin === true, '洋葱皮开启状态同步');

  const allFrames = state.get('frames');
  const onionSkins = frameAlignment.getOnionSkinFrames(allFrames, 0, 1, 1);
  assert(onionSkins.length === 1, 'frame_1 (index 0) 成功提取相邻后帧 frame_2 作为残影');
  assert(onionSkins[0].frame.id === 'frame_2', '残影帧为 frame_2');
  assert(onionSkins[0].color === '#00b4ff', '后向残影为青蓝色 #00b4ff');

  state.setPlayerState({ showGround: false });
  assert(state.get('playerState').showGround === false, '地面参考线成功关闭');
}

console.log('\n======================================================');
console.log(`📊 测试汇总: 共通过 \x1b[32m${passed}\x1b[0m 项, 失败 \x1b[31m${failed}\x1b[0m 项`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 恭喜！集成交互逻辑验证完全通过！\n');
  process.exit(0);
}
