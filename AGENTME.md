# 🤖 AGENTME: AI Agent 上下文衔接与架构指南

> **本文件是专为 AI 编码助手（如 Antigravity / Claude Code / Cursor 等）编写的项目全景与接续开发备忘录。**  
> 当你在新的环境、设备或会话中接手本项目时，请**首先阅读本文件**，以便立即进入上下文并遵循既定规范。

---

## 📌 1. 项目定位与核心价值

* **项目名称**：Sprite Animator (序列帧交叉修复与动画播放器)
* **技术栈**：纯原生 ES6+ JavaScript, HTML5 Canvas 2D, 纯原生 CSS3（无 Webpack/Vite 复杂打包工具链，无第三方重型框架，零外部网络依赖）。
* **交付目标**：
  1. 模块化工程代码（`index.html` + `js/` + `css/`）；
  2. 独立脱机便携发行单文件（**`SpriteAnimator.html`**，所有 CSS、JS 与第三方库均被内联在单一文件中，双击即用）。
* **核心业务痛点**：
  * AI 生成或拼版序列帧大图中，相邻帧的武器、刀光、披风相互交叉穿插；
  * 网格等分切片时，动作幅度大的帧伸出边界；
  * 帧尺寸不一致或重心不稳导致播放时晃动跳动；
  * 导出透明动图时画面被裁切。

---

## 🏗️ 2. 核心架构与模块职责划分

```text
js/
├── app.js                 # 主控制器 (SpriteAnimatorApp)，负责 DOM 挂载、模态框、事件协调
├── core/
│   ├── state.js           # 响应式状态中心 (StateStore + EventBus)，全局单一真相源
│   ├── image-processor.js # 图像算法库：连通域外接矩形提取、背景透明化扣除、空白帧检测
│   ├── overlap-isolator.js# 交叉消除引擎：每个 Frame 的 maskCanvas 离屏图层管理、橡皮擦、多边形套索、魔棒与 Undo/Redo 栈
│   ├── frame-alignment.js # 对齐系统：九宫格锚点比例推导、坐标换算、洋葱皮残影生成、舞台渲染
│   ├── animation-player.js# 播放器核心引擎：基于 rAF + Delta-time 的多模式定时器
│   ├── canvas-workspace.js# 主画布视口：平移/缩放矩阵变换、8手柄自由拉伸选框交互
│   └── exporter.js        # 导出服务：ZIP透明包打包、无交叉规整SpriteSheet排版、全包围盒GIF导出
└── vendor/
    ├── jszip.min.js       # 原生轻量 Zip 库
    └── gifshot.min.js     # 原生轻量 GIF89a 编码库 (带 LZW 压缩)
```

---

## 📊 3. 核心数据模型 (Data Models)

### `Frame` 对象规范
```javascript
{
  id: "frame_1791795178975_0", // 唯一 ID
  name: "帧 1",                 // 界面展示名
  rect: { x: 0, y: 0, w: 688, h: 512 }, // 在原图上的外接矩形 (允许帧之间任意重叠)
  offset: { x: 0, y: 0 },       // 相对基准点的微调偏移 (方向键 1px 调节)
  pivot: { x: 0.5, y: 1.0 },    // 归一化锚点 (默认脚底中心 bottom-center)
  maskCanvas: HTMLCanvasElement | null, // 局部像素修整专属离屏图层 (若经橡皮擦/魔棒修改)
  customPixels: null,
  duration: 83                  // 单帧时长 (ms)
}
```

### `playerState` 对象规范
```javascript
{
  isPlaying: false,
  fps: 12,
  currentFrameIndex: 0,
  loopMode: 'loop',             // 'loop' | 'once' | 'pingpong'
  onionSkin: false,             // 是否开启洋葱皮残影
  onionSkinOpacity: 0.30,       // 残影透明度
  showGround: true,             // 是否显示地面虚线
  showPivot: true,              // 是否显示红色准星
  zoom: 'auto',                 // 视口缩放模式 ('auto' | 1.0 | 0.75 | 0.5 | 0.35 | 0.25)
  viewportScaleMode: 'auto'
}
```

---

## 🧮 4. 关键算法与设计模式

1. **视口与播放器自适应比例 (`calculateStageScale`)**：
   * 位于 `js/core/frame-alignment.js`；
   * 自动统计全部帧的最大宽高 `maxW` 与 `maxH`，根据视口留白比例自适应缩小；
   * **注意**：`playerState.zoom` 默认值必须为 `'auto'`，不能硬编码为数值 `1.0`，否则播放时会放大挤破视口。
2. **GIF 导出全包围盒计算与防裁切**：
   * 位于 `js/core/exporter.js` 的 `exportAnimationAsGif`；
   * 自动遍历所有帧在基准点下的最小最大坐标 `[minLeft, maxRight, minTop, maxBottom]`；
   * 动态推导动图最佳高清画布尺寸并预留 16px 留白，**彻底根除人物头部、长枪与刀光被裁切的问题**。
3. **空白帧过滤算法 (`isRectContentEmpty`)**：
   * 位于 `js/core/image-processor.js`；
   * 支持全透明（Alpha = 0）与纯色底（如武将图末尾纯黑底、纯白底）的多点采样分析；
   * 计算前景有效像素占比，小于阈值时剔除末尾无动作的填充方格。
4. **单帧独立图层机制 (`OverlapIsolator`)**：
   * 位于 `js/core/overlap-isolator.js`；
   * 修改某帧时优先初始化专属离屏 `maskCanvas`，使用 `destination-out` 执行局部像素擦除，绝不污染原始大图；
   * 维护独立的 `undoStack` 与 `redoStack`，最多保留 20 步快照。
5. **真实脚底像素扫描与自动 Y 轴贴地 (`getRectContentBounds` & `autoAlignFrameToGround`)**：
   * 位于 `js/core/image-processor.js` 与 `js/core/frame-alignment.js`；
   * AI 生成的精灵表中，若某几帧头顶有巨大刀光/特效，人物往往被画在格子偏上方，导致脚底离网格底边留有不等的透明空白（播放时人物往上飘）；
   * `getRectContentBounds` 自动扫描选框内前景像素最低点 `localMaxY`，`autoAlignFrameToGround` 自动计算 `frame.offset.y = Math.round(h * py - (localMaxY + 1))`，一键将全部地面帧的角色脚底贴合到地面基准线；
   * 支持在右下角播放器画布（`#player-canvas`）中直接用鼠标按住人物上下左右拖拽微调 `offset.x / offset.y`（方便把跳跃帧单独往上拖回空中），且导出新精灵表与 ZIP 时自动烘焙该偏移。

---

## ⚙️ 5. AI Agent 协作铁律 (Important Rules)

当你修改项目代码时，**必须严格遵守以下执行纪律**：

1. **单文件同步重新构建（核心！）**：
   * 本项目的用户主力使用的是根目录下的独立单文件 **`SpriteAnimator.html`**；
   * **每次对 `index.html`、`js/` 或 `css/` 的任何代码进行修改后，必须运行构建脚本**：
     ```bash
     python build_single_file.py
     ```
   * 构建完成后确认 `SpriteAnimator.html` 体积正常（约 280KB~300KB）且包含最新改动。
2. **版本号徽章更新与防缓存机制**：
   * 每次解决重大 Bug 或发布新特性时，在 `index.html` 顶部 Header 的 Logo 旁递增版本号：
     `<span class="badge-version">v1.x</span>`；
   * 这样用户在浏览器中刷新后，一眼就能确认是否已加载最新打包文件。
3. **HTML 标签闭合性自检**：
   * 模态框统一使用 `.modal-overlay > .modal-box` 结构，必须作为 `body` 的平级直属子元素；
   * 禁止模态框之间产生未闭合的层级嵌套（否则会导致子模态框被父级 `opacity: 0; pointer-events: none;` 完全盖住不可见）。
4. **测试验证全绿**：
   * 提交前必须运行全套单元测试：
     ```bash
     node tests/test_size_and_slice.js
     node tests/test_exporter.js
     node tests/test_overlap_isolator.js
     node tests/test_frame_alignment.js
     ```
5. **Git 提交并保持 Clean**：
   * 提交信息采用规范化 Commit Message（如 `feat(...)`、`fix(...)`）；
   * 确保推送至 `origin main`。
6. **语言习惯**：
   * 所有内部思考和向用户的回复，**必须始终使用简体中文**。
