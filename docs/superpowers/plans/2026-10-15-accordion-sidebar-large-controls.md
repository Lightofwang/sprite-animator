# 可折叠手风琴大卡片与侧边栏大号控件改版实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将右侧侧边栏从“固定视口高度硬挤压”彻底改版为“纵向流畅滚动 + 可折叠手风琴大卡片（Accordion）+ 全面大号 Pro 控件”架构，使按钮字号提升至 13~14px、高度提升至 36px、间距呼吸感翻倍，并支持各功能卡片独立折叠收起与持久化记忆。

**Architecture:** 
- 将 `.sidebar-panel` 转变为单一大纵向滚动容器（`overflow-y: auto`），彻底解除固定高度限制；
- 将侧边栏 5 大核心功能（播放器、缩放校准、锚点与位置、帧序列列表、选框切片）封装为独立可折叠手风琴大卡片（`.accordion-card`）；
- 全面加大侧边栏的排版、按钮、滑块、九宫格锚点与输入框尺寸，各模块自上而下自如展开；
- `localStorage` 记忆卡片展开与折叠状态。

**Tech Stack:** HTML5, CSS3 (Flexbox/Grid, CSS Variables, Custom Scrollbar, Transitions), Vanilla JS (ES6 Module).

---

### Task 1: CSS 架构升级 —— 侧边栏全局滚动条与大号 Pro 控件样式体系

**Files:**
- Modify: `css/style.css`

- [x] **Step 1: 重构 `.sidebar-panel` 为全局纵向滚动容器并定制深色平滑滚动条**
- [x] **Step 2: 编写 `.accordion-card` 与 `.card-header` 样式体系（支持折叠、展开、箭头旋转动画）**
- [x] **Step 3: 编写大号 Pro 控件样式（按钮高度 34~36px，字号 13px，输入框 32px，九宫格 28×28px，行间距 10~12px）**
- [x] **Step 4: 提交样式变更**

---

### Task 2: HTML 结构重构 —— 5 大功能块封装为手风琴大卡片

**Files:**
- Modify: `index.html`

- [x] **Step 1: 封装卡片 1【🎬 实时动画播放器】（带大号视口、大号播放控制栏与 FPS 滑块）**
- [x] **Step 2: 封装卡片 2【📏 人物缩放与身量校准】（带大号滑块、输入框、智能建议胶囊、幽灵透光台开关、校准按钮）**
- [x] **Step 3: 封装卡片 3【🎯 锚点与位置微调】（带 28px 九宫格、大号 XY 偏移输入、对齐按钮组、参考线开关）**
- [x] **Step 4: 封装卡片 4【🎞️ 动作帧序列】（大号舒适缩略图网格，序号与缩放药丸）**
- [x] **Step 5: 封装卡片 5【✂️ 网格切片与尺寸工具】（可折叠低频功能卡片）**
- [x] **Step 6: 提交 HTML 结构重构**

---

### Task 3: JS 交互绑定 —— 卡片折叠收起与用户偏好持久化

**Files:**
- Modify: `js/app.js`

- [x] **Step 1: 实现 `bindAccordionCards()`：绑定卡片标题点击切换折叠/展开**
- [x] **Step 2: 实现折叠状态与 `localStorage` 同步读写**
- [x] **Step 3: 折叠展开时自动触发播放器与视口平滑重绘**
- [x] **Step 4: 提交 JS 交互逻辑**

---

### Task 4: 全量测试验证与单文件构建发布

**Files:**
- Modify: `SpriteAnimator.html`

- [x] **Step 1: 运行全套 11 组单元测试确保 100% 通过**
- [x] **Step 2: 运行 `python build_single_file.py` 更新独立单文件**
- [x] **Step 3: 提交 Git 并推送到远程仓库**
- [x] **Step 4: 向用户演示改版成果**
