/**
 * @file test_animation_player.js
 * @description AnimationPlayer 实时动画播放器引擎单元测试套件
 * 可通过 node tests/test_animation_player.js 独立运行
 */

import { AnimationPlayer } from '../js/core/animation-player.js';

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

function assertClose(actual, expected, message, tolerance = 0.001) {
  const diff = Math.abs(actual - expected);
  if (diff <= tolerance) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${message}`);
    passed++;
  } else {
    console.error(`  \x1b[31m✘ FAIL\x1b[0m: ${message} (期望: ${expected}, 实际: ${actual}, 误差: ${diff})`);
    failed++;
  }
}

function createMockFrames(count) {
  const frames = [];
  for (let i = 0; i < count; i++) {
    frames.push({
      id: `frame_${i}`,
      name: `帧 ${i + 1}`,
      rect: { x: i * 64, y: 0, w: 64, h: 64 },
      offset: { x: 0, y: 0 },
      pivot: { x: 0.5, y: 1.0 },
      maskCanvas: null
    });
  }
  return frames;
}

console.log('======================================================');
console.log('🧪 开始运行 AnimationPlayer 单元测试套件');
console.log('======================================================\n');

// ----------------------------------------------------
// 测试组 1: FPS 间隔计算与动态修改 (1~60 FPS)
// ----------------------------------------------------
console.log('▶ [测试组 1] FPS 间隔计算与边界约束:');

{
  const player = new AnimationPlayer({ fps: 12 });
  assert(player.getFPS() === 12, '默认初始化 FPS 为 12');
  assertClose(player.getFrameDuration(), 1000 / 12, '12 FPS 的单帧持续时长约为 83.333ms');

  // 动态修改为 60 FPS
  player.setFPS(60);
  assert(player.getFPS() === 60, '动态修改 FPS 为 60 成功');
  assertClose(player.getFrameDuration(), 1000 / 60, '60 FPS 的单帧持续时长约为 16.666ms');

  // 动态修改为 1 FPS
  player.setFPS(1);
  assert(player.getFPS() === 1, '动态修改 FPS 为 1 成功');
  assertClose(player.getFrameDuration(), 1000, '1 FPS 的单帧持续时长为 1000ms');

  // 边界约束验证：下界限制为 1
  player.setFPS(0);
  assert(player.getFPS() === 1, '输入 0 时自动限制为下界 1 FPS');
  player.setFPS(-10);
  assert(player.getFPS() === 1, '输入负数时自动限制为下界 1 FPS');

  // 边界约束验证：上界限制为 60
  player.setFPS(120);
  assert(player.getFPS() === 60, '输入 120 时自动限制为上界 60 FPS');
  player.setFPS(999);
  assert(player.getFPS() === 60, '输入 999 时自动限制为上界 60 FPS');

  // 非法输入容错
  player.setFPS('abc');
  assert(player.getFPS() === 12, '非法字符串输入时安全回退至默认 12 FPS');
}

// ----------------------------------------------------
// 测试组 2: loop (默认循环) 模式下的时间驱动索引演进
// ----------------------------------------------------
console.log('\n▶ [测试组 2] loop 模式下的时间驱动索引演进:');

{
  const frames = createMockFrames(4);
  const player = new AnimationPlayer({
    fps: 10, // 100ms 一帧
    loopMode: 'loop',
    frames
  });

  player.play();
  assert(player.isPlaying === true, '启动播放后 isPlaying 为 true');
  assert(player.getCurrentFrameIndex() === 0, '初始帧索引为 0');

  // 推进 50ms (不足 100ms)
  player.advance(50);
  assert(player.getCurrentFrameIndex() === 0, '推进 50ms (不足 100ms) 保持在第 0 帧');

  // 再推进 50ms (累加满 100ms，切换至第 1 帧)
  player.advance(50);
  assert(player.getCurrentFrameIndex() === 1, '累加满 100ms 时切换至第 1 帧');

  // 推进 100ms -> 第 2 帧
  player.advance(100);
  assert(player.getCurrentFrameIndex() === 2, '再次推进 100ms 切换至第 2 帧');

  // 推进 100ms -> 第 3 帧 (末帧)
  player.advance(100);
  assert(player.getCurrentFrameIndex() === 3, '再次推进 100ms 切换至第 3 帧');

  // 推进 100ms -> 循环回第 0 帧
  player.advance(100);
  assert(player.getCurrentFrameIndex() === 0, 'loop 模式到达末尾后顺利循环回第 0 帧');

  // 一次性大跨度推进 250ms (应前进 2 帧，余 50ms)
  player.advance(250);
  assert(player.getCurrentFrameIndex() === 2, '一次性推进 250ms (2.5 帧时长) 正确前进 2 帧至索引 2');
}

// ----------------------------------------------------
// 测试组 3: once (单次播放) 模式演进与自动暂停
// ----------------------------------------------------
console.log('\n▶ [测试组 3] once 模式演进与末帧自动暂停:');

{
  const frames = createMockFrames(4); // 0, 1, 2, 3
  const player = new AnimationPlayer({
    fps: 10, // 100ms 一帧
    loopMode: 'once',
    frames
  });

  player.play();
  assert(player.isPlaying === true, 'once 模式启动播放');

  // 推进到最后一帧的过程：
  player.advance(100); // -> 1
  assert(player.getCurrentFrameIndex() === 1, '推进到第 1 帧');

  player.advance(100); // -> 2
  assert(player.getCurrentFrameIndex() === 2, '推进到第 2 帧');

  player.advance(100); // -> 3
  assert(player.getCurrentFrameIndex() === 3, '推进到最后一帧 (索引 3)');
  assert(player.isPlaying === true, '展示最后一帧期间播放器仍保持播放状态');

  // 最后一帧播放满 100ms 后，应触发自动暂停并停留在末帧
  player.advance(100);
  assert(player.getCurrentFrameIndex() === 3, 'once 模式播完后依然停留在末帧 3');
  assert(player.isPlaying === false, 'once 模式到达末尾后自动停止播放 (isPlaying === false)');

  // 处于暂停状态再次 advance 不应有任何改变
  player.advance(500);
  assert(player.getCurrentFrameIndex() === 3, '暂停状态下 advance 不会切换帧');

  // 在最后一帧再次调用 play()，应从头重新播放
  player.play();
  assert(player.isPlaying === true, '在末帧再次 play() 成功恢复播放');
  assert(player.getCurrentFrameIndex() === 0, 'once 模式在末尾再次播放自动回首帧 0');
}

// ----------------------------------------------------
// 测试组 4: pingpong (往返乒乓) 模式演进序列
// ----------------------------------------------------
console.log('\n▶ [测试组 4] pingpong 模式往返流畅序列验证:');

{
  const frames = createMockFrames(4); // 0, 1, 2, 3
  const player = new AnimationPlayer({
    fps: 10, // 100ms 一帧
    loopMode: 'pingpong',
    frames
  });

  player.play();
  const sequence = [player.getCurrentFrameIndex()];

  // 连续推进 8 帧时长 (800ms)
  for (let i = 0; i < 8; i++) {
    player.advance(100);
    sequence.push(player.getCurrentFrameIndex());
  }

  // 期望往返乒乓序列：0 -> 1 -> 2 -> 3 -> 2 -> 1 -> 0 -> 1 -> 2
  const expected = [0, 1, 2, 3, 2, 1, 0, 1, 2];
  const seqMatch = sequence.every((val, idx) => val === expected[idx]);
  assert(seqMatch, `pingpong 演进序列符合对称往返预期: [${sequence.join(', ')}]`);
}

// ----------------------------------------------------
// 测试组 5: play / pause / toggle 状态流转与单步导航
// ----------------------------------------------------
console.log('\n▶ [测试组 5] play/pause/toggle 状态流转与单步导航:');

{
  const frames = createMockFrames(4);
  let playStateLog = [];
  const player = new AnimationPlayer({
    frames,
    onPlayStateChange: (state) => playStateLog.push(state)
  });

  assert(player.isPlaying === false, '初始状态为暂停');

  // toggle: pause -> play
  player.toggle();
  assert(player.isPlaying === true, 'toggle() 从暂停切换为播放');
  assert(playStateLog[playStateLog.length - 1] === true, '触发 onPlayStateChange(true)');

  // toggle: play -> pause
  player.toggle();
  assert(player.isPlaying === false, '再次 toggle() 切换为暂停');
  assert(playStateLog[playStateLog.length - 1] === false, '触发 onPlayStateChange(false)');

  // 单步前进 nextFrame()
  player.goToFrame(0);
  player.nextFrame();
  assert(player.getCurrentFrameIndex() === 1, '单步前进 nextFrame() -> 1');
  player.nextFrame();
  assert(player.getCurrentFrameIndex() === 2, '单步前进 nextFrame() -> 2');
  player.nextFrame();
  assert(player.getCurrentFrameIndex() === 3, '单步前进 nextFrame() -> 3');
  player.nextFrame();
  assert(player.getCurrentFrameIndex() === 0, '末帧单步前进循环回第 0 帧');

  // 单步后退 prevFrame()
  player.prevFrame();
  assert(player.getCurrentFrameIndex() === 3, '首帧单步后退 prevFrame() 循环至末帧 3');
  player.prevFrame();
  assert(player.getCurrentFrameIndex() === 2, '单步后退 prevFrame() -> 2');

  // 首尾快捷跳转
  player.firstFrame();
  assert(player.getCurrentFrameIndex() === 0, 'firstFrame() 跳转至第 0 帧');
  player.lastFrame();
  assert(player.getCurrentFrameIndex() === 3, 'lastFrame() 跳转至最后一帧 3');
}

// ----------------------------------------------------
// 测试组 6: 边界场景 (空帧、单帧、越界跳转)
// ----------------------------------------------------
console.log('\n▶ [测试组 6] 边界异常防御能力测试:');

{
  // 1. 空帧列表
  const emptyPlayer = new AnimationPlayer({ frames: [] });
  assert(emptyPlayer.getCurrentFrameIndex() === 0, '空帧列表初始索引为 0');
  assert(emptyPlayer.getCurrentFrame() === null, '空帧列表 getCurrentFrame() 返回 null');
  assert(emptyPlayer.play() === false, '空帧列表 play() 安全返回 false 且不启动播放');
  assert(emptyPlayer.isPlaying === false, '空帧列表 isPlaying 为 false');

  emptyPlayer.nextFrame();
  emptyPlayer.prevFrame();
  emptyPlayer.firstFrame();
  emptyPlayer.lastFrame();
  emptyPlayer.goToFrame(5);
  emptyPlayer.advance(500);
  assert(emptyPlayer.getCurrentFrameIndex() === 0, '空帧列表中执行各类导航与推进保持安全不崩溃');

  // 2. 单帧序列
  const singlePlayer = new AnimationPlayer({
    frames: createMockFrames(1),
    loopMode: 'loop'
  });
  singlePlayer.play();
  singlePlayer.advance(200);
  assert(singlePlayer.getCurrentFrameIndex() === 0, '单帧序列循环播放索引保持 0');

  // 单帧 once 模式
  singlePlayer.setLoopMode('once');
  singlePlayer.play();
  singlePlayer.advance(200);
  assert(singlePlayer.isPlaying === false, '单帧序列 once 模式播完一周期后安全暂停');
  assert(singlePlayer.getCurrentFrameIndex() === 0, '单帧序列 once 模式暂停停留在第 0 帧');

  // 3. 超出索引范围跳转 (Clamping)
  const player = new AnimationPlayer({ frames: createMockFrames(5) }); // 0~4
  player.goToFrame(-99);
  assert(player.getCurrentFrameIndex() === 0, '负数索引安全钳制为 0');

  player.goToFrame(999);
  assert(player.getCurrentFrameIndex() === 4, '过大索引安全钳制为末帧 4');

  // 动态切换为更短的帧列表
  player.setFrames(createMockFrames(2)); // 0~1
  assert(player.getCurrentFrameIndex() <= 1, '重设更短帧列表时当前索引自动收敛至新范围');
}

// ----------------------------------------------------
// 测试组 7: 视口 Canvas 居中渲染与回调机制
// ----------------------------------------------------
console.log('\n▶ [测试组 7] 视口 Canvas 居中平稳渲染与回调机制:');

{
  let frameChangeCount = 0;
  let lastChangedIndex = -1;
  const frames = createMockFrames(3);

  // 带有 maskCanvas 和 pivot 偏移测试
  frames[1].pivot = { x: 0.5, y: 1.0 };
  frames[1].offset = { x: 5, y: -10 };
  frames[1].maskCanvas = { type: 'MockMaskCanvas' };

  // 构造 Mock 2D Context
  const drawOps = [];
  const mockCanvas = {
    width: 256,
    height: 256,
    getContext: (type) => {
      if (type === '2d') {
        return {
          clearRect: (x, y, w, h) => drawOps.push({ op: 'clearRect', x, y, w, h }),
          save: () => drawOps.push({ op: 'save' }),
          restore: () => drawOps.push({ op: 'restore' }),
          drawImage: (...args) => drawOps.push({ op: 'drawImage', args }),
          imageSmoothingEnabled: true
        };
      }
      return null;
    }
  };

  const player = new AnimationPlayer({
    frames,
    canvas: mockCanvas,
    onFrameChange: (index, frame) => {
      frameChangeCount++;
      lastChangedIndex = index;
    }
  });

  player.goToFrame(1);
  assert(frameChangeCount === 1, '帧切换正确触发 onFrameChange 回调');
  assert(lastChangedIndex === 1, 'onFrameChange 传入正确的帧索引 1');

  // 检查渲染绘制操作
  const drawImageCall = drawOps.find(op => op.op === 'drawImage');
  assert(drawImageCall !== undefined, '渲染调用了 drawImage');
  assert(drawImageCall.args[0] === frames[1].maskCanvas, '优先使用交叉修复后的 maskCanvas 绘制');

  // 验证居中坐标计算：
  // width = 256, targetBaseX = 128; height = 256, targetBaseY = Math.round(256 * 0.82) = 210
  // w = 64, h = 64, px = 0.5, py = 1.0, ox = 5, oy = -10
  // dx = 128 - 64 * 0.5 + 5 = 128 - 32 + 5 = 101
  // dy = 210 - 64 * 1.0 - 10 = 210 - 64 - 10 = 136
  const targetBaseX = Math.round(256 / 2);
  const targetBaseY = Math.round(256 * 0.82);
  const expectedDx = targetBaseX - 64 * 0.5 + 5;
  const expectedDy = targetBaseY - 64 * 1.0 - 10;

  const actualDx = drawImageCall.args[5];
  const actualDy = drawImageCall.args[6];
  assert(actualDx === expectedDx, `基于 pivot 与 offset 居中渲染的实际 dx (${actualDx}) 符合预期 (${expectedDx})`);
  assert(actualDy === expectedDy, `基于 pivot 与 offset 居中渲染的实际 dy (${actualDy}) 符合预期 (${expectedDy})`);
}

console.log('\n======================================================');
console.log(`测试结果统计: \x1b[32m${passed} 通过\x1b[0m, \x1b[31m${failed} 失败\x1b[0m`);
console.log('======================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
