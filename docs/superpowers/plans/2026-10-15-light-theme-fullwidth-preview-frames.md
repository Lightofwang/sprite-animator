# 浅色系、横向铺满与【预览+帧序列】一体化改版实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将系统界面重构为大气开阔的 100% 横向铺满布局，全面升级为现代浅色系（Light Clean Pro Theme），并将“动画播放预览”与“动作帧序列列表”深度整合在同一大板块内并排联动，实现所见即所得的极佳动画调试体验。

**Architecture:** 
- 色彩系统重塑：在 `css/style.css` 中将全局深黑主题升级为极简现代浅色专业工作台（白/淡灰/高对比度深色文字/柔和浅灰棋盘格）；
- 容器宽度解放：`.main-workspace` 去除 `max-width: 1440px`，直接 `width: 100%; max-width: 100%;`，大气铺满屏幕；
- 核心板块结构重组：
  - 板块 1：【🎬 动画预览与动作帧序列】（一体化大板块，左侧高清播放视口 + 控制栏，右侧无缝衔接动作帧序列网格时间轴，支持整体折叠）；
  - 板块 2：【✂️ 原图切片与工作区画布】（大图主工作区、自由框选、消除交叉、等分切片）；
  - 板块 3：【🎯 人物缩放与身量对齐校准】（双列大号排版：身量缩放校准 + 九宫格锚点与微调）；
- 状态记忆：各板块折叠状态持续同步 `localStorage`。

**Tech Stack:** CSS3 (CSS Variables, Flexbox, Grid, Light Pro Theme), HTML5, Vanilla JS.

---

### Task 1: CSS 浅色系设计系统与 100% 横向铺满布局体系

**Files:**
- Modify: `css/style.css`

- [x] **Step 1: 重构 `:root` 为高品质浅色系变量（Light Theme Tokens: #f1f3f8 背景, #ffffff 卡片, #0f172a 文字, 浅灰白棋盘格）**
- [x] **Step 2: 解除 `.main-workspace` 最大宽度限制，实现 100% 横向铺满大气布局**
- [x] **Step 3: 编写【动画预览 + 动作帧序列】一体化板块专用布局（左侧视口控制 + 右侧帧序列网格）**
- [x] **Step 4: 全面升级按钮、输入框、九宫格、模态框、缩略图卡片为浅色高对比度现代质感**
- [x] **Step 5: 提交样式体系变更**

---

### Task 2: HTML 结构重组 —— 预览与动作帧序列一体化整合

**Files:**
- Modify: `index.html`

- [x] **Step 1: 组合板块 1 为【🎬 动画播放与动作帧序列】（包含播放器 canvas、控制条、帧序列列表 frame-list 与管理按钮）**
- [x] **Step 2: 规范板块 2 为【✂️ 原图切片与工作区画布】**
- [x] **Step 3: 规范板块 3 为【🎯 人物缩放与身量对齐校准】**
- [x] **Step 4: 确保所有原有 DOM ID 完备保留无遗漏**
- [x] **Step 5: 提交 HTML 结构重组**

---

### Task 3: JS 交互适配与尺寸响应联动

**Files:**
- Modify: `js/app.js`

- [x] **Step 1: 适配新板块 ID 的折叠与展开监听**
- [x] **Step 2: 优化单步选帧与播放中高亮帧自动平滑滚动**
- [x] **Step 3: 提交 JS 适配**

---

### Task 4: 全量测试验证与单文件构建发布

**Files:**
- Modify: `SpriteAnimator.html`

- [x] **Step 1: 运行全套 11 组单元测试确保 100% 全部通过**
- [x] **Step 2: 运行 `python build_single_file.py` 生成浅色全宽脱机单文件**
- [x] **Step 3: 提交 Git 并推送到远程仓库**
- [x] **Step 4: 向用户演示全新成果**
