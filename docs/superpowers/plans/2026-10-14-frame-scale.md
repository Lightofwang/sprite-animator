# 单帧人物缩放调节 (Frame Scale) 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为动画精灵帧引入独立的单帧角色缩放（Scale）调节功能，配合洋葱皮残影实时对照对齐，并在播放器、ZIP 导出、新大图规整排版与 GIF 动图全链路应用缩放重采样。

**Architecture:** 
1. 在 `Frame` 对象上扩展 `scale`（默认 1.0，范围 0.2~3.0）；
2. 在 `FrameAlignment` 与 `AnimationPlayer` 中实现基于脚底锚点（Pivot）的不动点数学推导缩放渲染算法；
3. 在 `index.html` 与 `js/app.js` 增加侧边栏控制面板（滑块、输入框、步进按钮、重置按钮），与播放器视口和洋葱皮实时双向绑定；
4. 在 `Exporter` 中将缩放重采样贯穿透明 PNG 序列帧 ZIP、规整精灵大图与 GIF 导出；
5. 构建脱机单文件 `SpriteAnimator.html` 并通过全量测试。

**Tech Stack:** 原生 HTML5 Canvas, Vanilla JavaScript (ES6+), CSS3 Flexbox/Grid, Node.js 单元测试, Python 构建脚本。

---

### Task 1: 核心数学与对齐算法扩展（TDD）

**Files:**
- Create: `tests/test_frame_scale.js`
- Modify: `js/core/frame-alignment.js`
- Modify: `js/core/state.js`

- [ ] **Step 1: 编写失败的单元测试 `tests/test_frame_scale.js`**
  - 验证 `Frame` 创建时默认 `scale = 1.0`；
  - 验证 `FrameAlignment.setScale(frame, scale)` 与 `nudgeScale(frame, delta)`、`resetScale(frame)` 边界限制；
  - 验证脚底锚点 $(0.5, 1.0)$ 时，缩放前后底部 $dy + H' = \text{targetBaseY} + \text{offset.y}$ 恒成立（双脚紧贴地面不动）；
  - 验证中心锚点 $(0.5, 0.5)$ 时，中心坐标不变。

- [ ] **Step 2: 运行测试验证失败**
  - 运行：`node tests/test_frame_scale.js`
  - 预期：FAIL（缺少 `setScale` / `calculateWorldRenderPos` 未适配 scale）

- [ ] **Step 3: 实现 `js/core/frame-alignment.js` 与 `js/core/state.js` 扩展**
  - 在 `createFrame` 中增加 `scale: 1.0`；
  - 在 `calculateWorldRenderPos(frame, targetBaseX, targetBaseY)` 中读取 `s = frame.scale || 1.0`，计算 `renderW = frame.rect.w * s`, `renderH = frame.rect.h * s`，推导：
    $$dx = targetBaseX - renderW \times frame.pivot.x + frame.offset.x$$
    $$dy = targetBaseY - renderH \times frame.pivot.y + frame.offset.y$$
    返回 `{ dx, dy, renderW, renderH, scale: s }`；
  - 添加 `setScale(frame, val)`, `nudgeScale(frame, delta)`, `resetScale(frame)`。

- [ ] **Step 4: 运行测试验证通过**
  - 运行：`node tests/test_frame_scale.js`
  - 预期：PASS

- [ ] **Step 5: 提交 Commit**
  - `git add tests/test_frame_scale.js js/core/frame-alignment.js js/core/state.js && git commit -m "feat(alignment): add frame scale math and alignment algorithms with TDD"`

---

### Task 2: 侧边栏 UI 界面与交互控制

**Files:**
- Modify: `index.html`
- Modify: `css/style.css`
- Modify: `js/app.js`

- [ ] **Step 1: 在 `index.html` 侧边栏添加「人物缩放」面板**
  - 在「偏移微调」下方新增：
    - 标题与当前百分比：`人物缩放 (Scale): <span id="frame-scale-display">100%</span>`；
    - 滑动条：`<input type="range" id="frame-scale-slider" min="50" max="150" value="100">`；
    - 输入框：`<input type="number" id="frame-scale-input" min="20" max="300" value="100"> %`；
    - 步进与重置按钮：`[-5%]`, `[+5%]`, `↺ 100%`。

- [ ] **Step 2: 在 `css/style.css` 中添加美化样式**
  - 保证面板布局紧凑、高对比度、与整体深色工作台风格一致。

- [ ] **Step 3: 在 `js/app.js` 中绑定交互事件与状态同步**
  - 选取不同帧时，自动回显当前帧的 `scale` 到滑块与输入框；
  - 滑块拖拽（`input` 事件）与输入框更改（`change` 事件）时，实时调用 `frameAlignment.setScale` 并触发主视口与播放器视口重绘；
  - 绑定 `[-5%]`, `[+5%]` 与 `↺ 100%` 按钮。

- [ ] **Step 4: 提交 Commit**
  - `git add index.html css/style.css js/app.js && git commit -m "feat(ui): add frame scale control panel in sidebar with real-time sync"`

---

### Task 3: 实时播放器与洋葱皮渲染全面适配

**Files:**
- Modify: `js/core/animation-player.js`
- Modify: `js/app.js`
- Test: `tests/test_animation_player.js`

- [ ] **Step 1: 适配 `AnimationPlayer` 视口绘制与洋葱皮渲染**
  - 播放器视口 Canvas 绘制当前帧时，使用 `calculateWorldRenderPos` 返回的 `renderW` 和 `renderH`；
  - 洋葱皮残影在绘制前一帧和后一帧时，同样读取各帧的 `scale`，以确保残影大小真实准确；
  - 确保洋葱皮与当前帧叠图时，二者以脚底地面线为统一基准。

- [ ] **Step 2: 运行播放器测试**
  - 运行：`node tests/test_animation_player.js`
  - 预期：PASS

- [ ] **Step 3: 提交 Commit**
  - `git add js/core/animation-player.js js/app.js && git commit -m "feat(player): adapt animation player and onion skinning to per-frame scale"`

---

### Task 4: 导出系统全链路适配（ZIP、Sprite Sheet、GIF）

**Files:**
- Modify: `js/core/exporter.js`
- Modify: `tests/test_exporter.js`

- [ ] **Step 1: 增强 `exportFramesAsZip` 缩放重采样支持**
  - 导出单帧 PNG 时，若 `frame.scale !== 1.0`，创建尺寸为 `renderW` × `renderH` 的离屏 Canvas 进行平滑缩放重采样（`imageSmoothingQuality = 'high'`），输出尺寸统一的 PNG；
  - 在 `animation.json` 中保存 `scale`。

- [ ] **Step 2: 增强 `exportNewSpriteSheet` 规整大图排版支持**
  - 网格单元格大小按所有帧缩放后的最大宽度与高度分配；
  - 单元格内绘制各帧时按其 `scale` 重采样绘制。

- [ ] **Step 3: 增强 `exportAnimationAsGif` 动图生成支持**
  - GIF 帧生成器渲染各帧时直接采用包含缩放比例的视口尺寸绘制。

- [ ] **Step 4: 运行导出测试验证**
  - 运行：`node tests/test_exporter.js`
  - 预期：PASS

- [ ] **Step 5: 提交 Commit**
  - `git add js/core/exporter.js tests/test_exporter.js && git commit -m "feat(exporter): support frame scale resampling across zip, sprite sheet and gif exports"`

---

### Task 5: 单文件构建与端到端全面回归

**Files:**
- Modify: `SpriteAnimator.html`

- [ ] **Step 1: 运行全量单元测试套件**
  - 运行全部 10 个测试文件（含新 `test_frame_scale.js`），确保 100% 通过。

- [ ] **Step 2: 重新打包构建单文件**
  - 运行：`python build_single_file.py`
  - 验证 `SpriteAnimator.html` 成功生成且体积正常。

- [ ] **Step 3: 提交并推送到远端 GitHub**
  - `git push origin main`
