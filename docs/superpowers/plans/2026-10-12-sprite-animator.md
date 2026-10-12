# 序列帧交叉修复与动画播放器（Sprite Animator）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个零安装、开箱即用的前端 Web 工具（HTML5 + Canvas），用于导入精灵表、自动/手动框选切片、消除序列帧之间的交叉穿插像素、设置锚点与地面位置对齐、实时播放动画并导出透明序列帧与 GIF。

**Architecture:** 纯前端 Canvas 2D 架构，采用模块化组织：数据状态中心（State）、图像算法（ImageProcessor，连通域分析与魔棒抠图）、工作区画布（FrameEditor，自由框选、橡皮擦、多边形）、动画播放器（AnimationPlayer，中心锚点与洋葱皮对齐）以及导出器（Exporter，Zip/SpriteSheet/GIF）。

**Tech Stack:** 原生 HTML5, Canvas 2D API, ES6 Modules/JS, CSS3 (Flexbox/Grid), 内嵌 JSZip (用于打包 Zip), gifshot (用于动图生成)。

---

### Task 1: 搭建项目基础结构与静态工作台骨架 (UI Skeleton)

**Files:**
- Create: `index.html`
- Create: `css/style.css`
- Create: `js/core/state.js`

- [ ] **Step 1: 创建 HTML 结构与视图骨架**
  编写包含顶部工具栏（导入、自动识别、抠背景、导出）、左侧/中间大图画布编辑区、右侧上方帧属性与锚点控制区、右侧下方动画播放器视口的布局结构。

- [ ] **Step 2: 编写 CSS 样式表**
  实现现代化深色专业工具主题（Dark Pro UI），包括棋盘格透明背景图案、工具栏图标按钮、双视口自适应布局。

- [ ] **Step 3: 编写初始数据状态管理模块 `js/core/state.js`**
  定义核心响应式状态对象：`sourceImage`, `frames` 数组, `selectedFrameId`, `currentTool`, `playerState` (fps, isPlaying, currentFrameIndex, onionSkin)。

- [ ] **Step 4: 浏览器运行验证**
  验证在浏览器中打开 `index.html` 能够正确显示深色工作台三栏布局，控制台无报错。

- [ ] **Step 5: Commit**
  `git add index.html css/style.css js/core/state.js && git commit -m "feat: setup UI skeleton and state management"`

---

### Task 2: 图像导入与预处理算法 (Image Processor & Transparency)

**Files:**
- Create: `js/core/image-processor.js`
- Test: `tests/test_image_processor.js`

- [ ] **Step 1: 编写单元测试测试纯色背景透明化与连通域包围盒算法**
  测试用例包含模拟 RGBA 像素矩阵：测试给定容差将白色背景转为透明 Alpha，以及从二值 Alpha 矩阵中提取不相交连通块的 Bounding Box。

- [ ] **Step 2: 实现 `ImageProcessor` 核心算法**
  - `removeColorBackground(imgData, targetColor, tolerance)`：基于欧氏距离色差算法批量清除背景纯色并转为透明通道；
  - `detectBoundingBoxes(imgData, minSize, mergeDistance)`：基于广度优先搜索/连通域标记算法，自动找出所有角色轮廓的最小外接矩形框。

- [ ] **Step 3: 运行算法测试确认通过**
  运行 `node tests/test_image_processor.js` 确保连通域分析和透明化计算正确。

- [ ] **Step 4: 集成文件拖拽与点击导入**
  在主界面挂载文件选择器与拖拽事件，读取 PNG/JPG 图片后渲染至大图画布并初始化状态。

- [ ] **Step 5: Commit**
  `git add js/core/image-processor.js tests/test_image_processor.js && git commit -m "feat: implement image loading, transparency and auto detection"`

---

### Task 3: 交互式工作区画布与自由框选 (Canvas Workspace & Box Selection)

**Files:**
- Create: `js/core/canvas-workspace.js`

- [ ] **Step 1: 实现画布视图变换（Pan & Zoom）**
  支持鼠标滚轮以鼠标所在坐标为中心无级缩放（0.1x ~ 10x），支持按住空格键或鼠标中键平移拖动画布，并提供“适应屏幕”重置按钮。

- [ ] **Step 2: 实现自由矩形框选与变换**
  - 支持“新建选框工具”：在画布上按住左键拖拽拉出新矩形框；
  - 支持选框选中、整体拖动、8 个控制手柄缩放调节；
  - 允许选框之间任意重叠与交叉。

- [ ] **Step 3: 联动右侧帧列表**
  大图上点击选框高亮对应右侧帧项；在大图上增删选框同步更新右侧帧缩略图序列。

- [ ] **Step 4: 手动操作验证**
  在浏览器中测试缩放、平移、拉框与调整手柄。

- [ ] **Step 5: Commit**
  `git add js/core/canvas-workspace.js && git commit -m "feat: implement pan, zoom and freeform frame box editing"`

---

### Task 4: 交叉消除专属工具集（橡皮擦、多边形扣选与魔棒）

**Files:**
- Create: `js/core/overlap-isolator.js`
- Modify: `js/core/canvas-workspace.js`

- [ ] **Step 1: 设计帧独立离屏蒙版（Frame Isolated Mask Canvas）**
  为每个 Frame 创建私有的 `maskCanvas`。默认包含原图中选框范围的全部像素。

- [ ] **Step 2: 实现交叉消除“橡皮擦笔刷”**
  - 选中某一个发生交叉的帧，激活橡皮擦工具；
  - 鼠标在选框范围内涂抹时，在私有 `maskCanvas` 上使用 `globalCompositeOperation = 'destination-out'` 擦除侵入的相邻帧像素（如穿插的枪尖或斗篷）；
  - 画布高亮显示被擦除后的干净独立结果，相邻帧保持不受影响。

- [ ] **Step 3: 实现多边形套索与魔棒快速修整**
  - 多边形套索：沿角色边缘点击绘制多边形闭合区域，框外像素自动设为透明；
  - 魔棒工具：点击杂色区域按容差直接填充透明。

- [ ] **Step 4: 验证穿插消除效果**
  导入含交叉的武将动作图，在第9帧和第10帧使用橡皮擦工具成功擦除多余枪刃，验证两帧彻底独立分离。

- [ ] **Step 5: Commit**
  `git add js/core/overlap-isolator.js js/core/canvas-workspace.js && git commit -m "feat: implement overlap isolator with eraser, lasso and magic wand"`

---

### Task 5: 帧位置编辑、锚点对齐与洋葱皮残影 (Alignment & Onion Skin)

**Files:**
- Create: `js/core/frame-alignment.js`
- Modify: `index.html`

- [ ] **Step 1: 可视化锚点对齐系统（Pivot System）**
  - 每一帧提供锚点 `pivot: { x, y }`，支持在帧视口中直接拖拽红色十字瞄准准星；
  - 提供九宫格快速对齐按钮（如默认“底部居中”贴近地面）；
  - 渲染地面参考基准水平线。

- [ ] **Step 2: 键盘方向键 1 像素微调**
  聚焦某帧时，支持使用键盘方向键（↑ ↓ ← →）以 1px 步进微调该帧相对锚点的 X/Y 偏移量，支持 Shift + 方向键以 10px 快速移动。

- [ ] **Step 3: 洋葱皮残影辅助显示（Onion Skinning）**
  开启后，以 30% 半透明度在当前帧视口中重叠渲染前一帧（淡红色）和后一帧（淡蓝色），供用户肉眼精确对齐重心与步伐。

- [ ] **Step 4: 手动对齐验证**
  对齐连续的奔跑与挥枪动作，观察锚点与地面接触线的一致性。

- [ ] **Step 5: Commit**
  `git add js/core/frame-alignment.js index.html && git commit -m "feat: implement frame pivot alignment, keyboard nudging and onion skinning"`

---

### Task 6: 实时动画播放器引擎 (Animation Player)

**Files:**
- Create: `js/core/animation-player.js`

- [ ] **Step 1: 动画定时渲染引擎**
  基于 `requestAnimationFrame` 配合精确时间差控制（Delta Time），实现根据设定的 FPS（1~60 无级调节）定时切换帧并渲染。

- [ ] **Step 2: 播放模式与控制逻辑**
  实现播放/暂停、第一帧、最后一帧、单帧向前步进、单帧向后步进；支持循环播放（Loop）、单次播放（Once）、乒乓播放（Ping-pong）。

- [ ] **Step 3: 播放器视口交互**
  播放器支持显示/隐藏地面参考线、中心网格；支持快捷键（空格键播放/暂停，左右方向键逐帧步进）。

- [ ] **Step 4: 播放流畅度验证**
  载入 10 帧武将动作，在 12 FPS 下进行循环播放，确认动作连贯无抖动。

- [ ] **Step 5: Commit**
  `git add js/core/animation-player.js && git commit -m "feat: implement real-time animation player engine with controls"`

---

### Task 7: 多格式导出与单文件便携化打包 (Exporter & Self-Contained Bundle)

**Files:**
- Create: `js/core/exporter.js`
- Create: `js/vendor/jszip.min.js`
- Create: `js/vendor/gifshot.min.js`
- Create: `build_single_file.py`
- Modify: `index.html`

- [x] **Step 1: 导出独立透明 PNG 序列包（Zip）**
  集成 JSZip，将全部修复后的单帧保存为带有透明通道的 PNG 图像，压缩为 `sprite_frames.zip` 并触发浏览器自动下载。

- [x] **Step 2: 导出重新排版整张规整 Sprite Sheet**
  将所有单帧按照网格安全间隔计算最大尺寸，合成一张崭新、绝无交叉重叠的透明整图 PNG 并导出。

- [x] **Step 3: 导出 GIF 动画**
  利用逐帧数据合成标准的 `.gif` 动图并下载。

- [x] **Step 4: 编写一键单文件打包脚本 `build_single_file.py`**
  将 HTML、CSS、JS、三方库内联合并为完全独立的单一 `SpriteAnimator.html` 文件，双击即可脱离所有外链直接运行。

- [x] **Step 5: 验证与最终交付**
  使用真实武将动作图导入 -> 框选 -> 橡皮擦修改交叉 -> 对齐 -> 播放 -> 导出 Zip 与单文件，验证完整工作流顺畅无误。

- [x] **Step 6: Commit**
  `git add . && git commit -m "feat: complete exporter, single-file bundle and end-to-end integration"`
