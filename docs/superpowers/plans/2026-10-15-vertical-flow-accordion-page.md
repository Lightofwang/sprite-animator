# 全网页纵向长流与四大板块全折叠改版实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 打破固定 100vh 屏幕视口挤压，将应用改造为像常规长网页一样的全网页自适应纵向长流布局（高度不固定，浏览器自带顺畅滚动条），自上而下自如排布【第1部分 预览图片与播放器】、【第2部分 原图切片与工作台】、【第3部分 动作帧序列列表】、【第4部分 人物缩放与对齐校准】，且每个部分均可完整独立折叠展开。

**Architecture:** 
- 解除根节点 `body` 与 `.app-container` 的 `height: 100vh; overflow: hidden;`，转为全局流动高度（`height: auto; min-height: 100vh; overflow-y: auto;`）；
- 顶部工具栏设为 `position: sticky; top: 0; z-index: 100;`，随页面滚动始终悬停在最上方；
- 主工作区由横向左右双栏改造为自上而下单列长流（`.main-workspace`，居中最大宽度 1440px）；
- 严格按照工作流程，划分为 4 大全尺寸折叠板块（`.flow-section` / `.accordion-card`），折叠后高度缩为 44px，展开后高度自由舒展；
- 画布与播放器监听容器展开与 Resize 事件，确保坐标映射精准无偏差；
- 使用 `localStorage` 记忆四大板块的折叠偏好。

**Tech Stack:** HTML5, CSS3 (Sticky positioning, CSS Grid/Flexbox, Custom Scrollbars, Transitions), Vanilla JS (ES6 Module).

---

### Task 1: CSS 架构重构 —— 全网页流动高度与四大板块排版体系

**Files:**
- Modify: `css/style.css`

- [x] **Step 1: 解除 body、app-container 的 100vh 限制，设置 sticky 顶栏与全页面流动滚动条**
- [x] **Step 2: 重构 `.main-workspace` 为自上而下的纵向自适应流动容器（带弹性留白与呼吸感）**
- [x] **Step 3: 编写四大流动板块（`.flow-section`）的标题栏、折叠收缩（展开高度自适应，收起高度仅留标题栏）样式**
- [x] **Step 4: 为板块 2（主画布切片工作区）提供全宽舒适的视口高度（如 540px），确保大图操作从容不迫**
- [x] **Step 5: 为板块 4（缩放与对齐）提供两列并排响应式网格布局（左侧身高校准，右侧九宫格与偏移）**
- [x] **Step 6: 提交样式体系变更**

---

### Task 2: HTML 结构重构 —— 严格自上而下组织 4 大全功能折叠板块

**Files:**
- Modify: `index.html`

- [x] **Step 1: 封装板块 1【🎬 动画播放与动图预览区】（带大号视口、大号播放栏、FPS滑块、循环下拉）**
- [x] **Step 2: 封装板块 2【✂️ 原图切片与工作区画布】（带大图主画布、框选切片工具、网格切片快速栏、信息栏）**
- [x] **Step 3: 封装板块 3【🎞️ 动作帧序列列表】（带添加/删除按钮、自适应缩略图卡片网格）**
- [x] **Step 4: 封装板块 4【🎯 人物缩放与身量对齐校准】（左侧缩放与建议胶囊，右侧九宫格与XY微调）**
- [x] **Step 5: 确保全部原 DOM ID 完整继承无遗漏**
- [x] **Step 6: 提交 HTML 结构重构**

---

### Task 3: JS 交互适配 —— 视口重绘、折叠状态记忆与 Canvas 尺寸自适应

**Files:**
- Modify: `js/app.js`

- [x] **Step 1: 升级 `bindAccordionCards()`：适配全网页 4 大板块的折叠与展开**
- [x] **Step 2: 板块展开/折叠时触发 `canvasWorkspace.resize()` 与 `renderPlayerViewport()`，防止尺寸不同步**
- [x] **Step 3: 折叠状态与 `localStorage` 同步读写**
- [x] **Step 4: 提交 JS 适配逻辑**

---

### Task 4: 全量测试验证与单文件构建发布

**Files:**
- Modify: `SpriteAnimator.html`

- [x] **Step 1: 运行全套 11 组单元测试确保 100% 全部通过**
- [x] **Step 2: 运行 `python build_single_file.py` 重新生成脱机单文件**
- [x] **Step 3: 提交 Git 并推送到远程仓库**
- [x] **Step 4: 向用户汇报改版成果**
