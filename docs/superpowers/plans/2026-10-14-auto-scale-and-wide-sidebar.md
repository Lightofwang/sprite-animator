# 智能自动身量对齐与宽屏大视口工作台实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现智能角色身高扫描与一键自动缩放对齐（Auto Scale），并将右侧工作面板升级为可自由拖拽拉宽的大面板、超大播放器预览视口与大缩略图卡片。

**Architecture:** 
1. 在 `FrameAlignment` 中构建角色有效身高分析与比例归一化算法（`detectCharacterBodyBounds`, `autoNormalizeFrameScale`, `autoNormalizeAllScales`）；
2. 在界面增加可左右拖拽调整宽度的侧边栏把手（`#sidebar-resizer`），默认宽 480px，支持 380~750px 自由拉伸；
3. 将播放器视口画布分辨率由 288×288 提升至 440×360+ 自适应高清大舞台，并将动作帧列表卡片扩大至 105px+；
4. 侧边栏集成「🎯 全部自动对齐身量」与「📏 当前帧身高校准」按钮并全链路状态响应；
5. 构建独立单文件 `SpriteAnimator.html` 并通过全量回归测试。

**Tech Stack:** 原生 HTML5 Canvas, Vanilla ES6+ JS, CSS3 Flexbox/Grid, Node.js 单元测试, Python 构建脚本。

---

### Task 1: 角色真实身高检测与自动缩放算法 (TDD)

**Files:**
- Create: `tests/test_auto_scale.js`
- Modify: `js/core/frame-alignment.js`

- [ ] **Step 1: 编写失败的单元测试 `tests/test_auto_scale.js`**
  - 验证 `detectCharacterBodyBounds` 能够准确识别角色像素头部顶端 $Y_{head}$、脚底 $Y_{ground}$ 与身高 $H_{body}$；
  - 验证对偏大帧（如 240px）相对基准帧（200px）计算出正确的缩放比（0.833）；
  - 验证 `autoNormalizeAllScales` 能够批量将全图所有帧的角色身高统一校准；
  - 验证面对全透明或异常帧时的安全边界回退。

- [ ] **Step 2: 运行测试验证失败**
  - 运行：`node tests/test_auto_scale.js`
  - 预期：FAIL（方法未定义）

- [ ] **Step 3: 实现 `js/core/frame-alignment.js` 算法**
  - 实现 `detectCharacterBodyBounds(frame, sourceImage, options)`；
  - 实现 `autoNormalizeFrameScale(targetFrame, referenceFrame, sourceImage)`；
  - 实现 `autoNormalizeAllScales(frames, sourceImage, referenceIndex = 0)`。

- [ ] **Step 4: 运行测试验证通过**
  - 运行：`node tests/test_auto_scale.js`
  - 预期：PASS

- [ ] **Step 5: 提交 Commit**
  - `git add tests/test_auto_scale.js js/core/frame-alignment.js && git commit -m "feat(alignment): implement character body height detection and auto-scaling normalization algorithms"`

---

### Task 2: 侧边栏自由拖拽拉伸宽度 (Resizer) 与排版加宽

**Files:**
- Modify: `index.html`
- Modify: `css/style.css`
- Modify: `js/app.js`

- [ ] **Step 1: 在 `index.html` 与 `css/style.css` 增加拖拽把手**
  - 在侧边栏左边缘增加 `<div id="sidebar-resizer" class="sidebar-resizer"></div>`；
  - 设置默认宽度 480px，最小宽度 380px，最大宽度 800px；
  - 优化把手 hover/active 高亮蓝色指示条与 `col-resize` 光标。

- [ ] **Step 2: 在 `js/app.js` 绑定鼠标拖拽拉伸事件**
  - 监听 `mousedown`, `mousemove`, `mouseup` 事件；
  - 拖拽时平滑更新侧边栏宽度并触发主画布自适应重绘；
  - 将宽度存入 `localStorage`，页面刷新后自动保持用户偏好的宽度。

- [ ] **Step 3: 提交 Commit**
  - `git add index.html css/style.css js/app.js && git commit -m "feat(ui): add draggable sidebar resizer with wide panel default"`

---

### Task 3: 播放器视口加倍放大与动作帧大卡片网格

**Files:**
- Modify: `index.html`
- Modify: `css/style.css`
- Modify: `js/app.js`

- [ ] **Step 1: 升级播放器视口 Canvas 分辨率与样式**
  - 将 `player-canvas` 默认尺寸由 288×288 提升至 440×360+；
  - `.player-stage-wrapper` 最小高度提升至 360px；
  - 提供动态自适应尺寸逻辑，窗口拉宽拉高时视口同比例舒展。

- [ ] **Step 2: 升级动作帧缩略图列表为大卡片**
  - 将 `.frame-list-wrapper` 的网格列宽由 `minmax(78px, 1fr)` 扩大至 `minmax(105px, 1fr)`；
  - 缩略图 Canvas 渲染尺寸提升至 96×96，清晰展现每个动作的铠甲和兵器轮廓；
  - 卡片右上角添加角标显示当前帧序号与缩放百分比。

- [ ] **Step 3: 提交 Commit**
  - `git add index.html css/style.css js/app.js && git commit -m "feat(ui): enlarge player viewport and frame list thumbnail cards"`

---

### Task 4: UI 按钮集成：一键「全部自动对齐身量」与「当前帧身高校准」

**Files:**
- Modify: `index.html`
- Modify: `js/app.js`

- [ ] **Step 1: 在侧边栏「人物缩放」面板添加操作按钮**
  - 增加 `🎯 全部自动对齐身量` 按钮；
  - 增加 `📏 当前帧身高校准` 按钮。

- [ ] **Step 2: 在 `js/app.js` 绑定按钮与批量校准逻辑**
  - 点击「全部自动对齐身量」：调用 `frameAlignment.autoNormalizeAllScales`，批量校准所有帧的 `scale`；
  - 自动联动刷新侧边栏滑块、输入框与实时播放器视口；
  - 弹出成功 Toast 通知，提示各帧缩放比例与统一后的身高像素。

- [ ] **Step 3: 提交 Commit**
  - `git add index.html js/app.js && git commit -m "feat(alignment): integrate auto-scale normalization buttons in sidebar"`

---

### Task 5: 全量测试回归与单文件构建

**Files:**
- Modify: `SpriteAnimator.html`

- [ ] **Step 1: 运行全量单元测试套件**
  - 运行全部 11 个单元测试文件，确保 100% 绿灯。

- [ ] **Step 2: 重新打包构建单文件**
  - 运行 `python build_single_file.py`，更新 `SpriteAnimator.html`。

- [ ] **Step 3: 提交并推送到远端 GitHub**
  - `git push origin main`
