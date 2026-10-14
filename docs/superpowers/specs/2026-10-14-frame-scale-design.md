# 单帧人物缩放调节 (Frame Scale) 与洋葱皮实时对照设计规范

## 1. 背景与目标 (Background & Goals)

### 1.1 痛点分析
在使用 AI（如 Midjourney、Stable Diffusion 等）生成 2D 动作序列大图（Sprite Sheet）时，由于 AI 无法在每个动作格子中严格锁定 3D 摄像机视距，容易将某些动作（例如正面蓄力、突刺或后排帧）画成“特写近景”，导致特定动作帧的人物骨架比例明显偏大（如第 2 帧、第 13~15 帧放大 15%~25%）。
目前工具仅提供了选框裁剪与 X/Y 位移微调能力：缩小选框只能裁剪人物边界，无法缩小人物骨架像素，导致播放时人物突兀变大、忽胖忽瘦。

### 1.2 核心目标
1. **单帧独立缩放 (Per-Frame Scale)**：为每一个 Frame 引入独立的缩放比例属性（默认 100% / 1.0），支持 20% ~ 300% 范围调节。
2. **锚点基准缩放 (Pivot-Anchored Scaling)**：缩放时以脚底中心（或当前设定锚点）为基准固定点，角色缩小时双脚紧贴地面，不发生浮空或下陷。
3. **洋葱皮实时比对 (Onion Skin Live Comparison)**：在开启洋葱皮残影时，当前帧缩放调节实时重绘，与上一帧半透明残影叠图比对，实现肉眼精确校准。
4. **全链路导出一致性 (Consistent Exporter Pipeline)**：在导出透明 PNG 序列帧 ZIP、新精灵大图（Sprite Sheet）以及 GIF 动图时，自动应用缩放重采样，保证输出资源的人物尺寸完全统一。

---

## 2. 数据模型变更 (Data Model Changes)

### 2.1 Frame 数据结构扩展
在 `js/core/state.js` 的 `createFrame` 与 `Frame` 对象中，增加 `scale` 字段：
```javascript
{
  id: string,
  name: string,
  rect: { x: number, y: number, w: number, h: number },
  offset: { x: number, y: number },
  pivot: { x: number, y: number },
  scale: 1.0, // 缩放比例，默认 1.0 (100%)，范围 [0.2, 3.0]
  maskCanvas: HTMLCanvasElement | null,
  duration: number
}
```

### 2.2 状态同步与更新
- 当切换选中帧（`selectedFrameId` 变更）时，右侧缩放控件同步刷新为当前帧的 `scale`；
- 用户调节缩放时，更新 `frame.scale`，并通过 `state.setState({ frames: ... })` 或定向通知触发播放器视口与对齐标线即刻重绘。

---

## 3. UI 界面与交互设计 (UI & Controls)

### 3.1 侧边栏布局
在 `index.html` 右侧侧边栏中，位于「偏移微调」模块正下方新增「人物缩放」面板：
- **标签与当前百分比显示**：如 `人物缩放 (Scale): 85%`；
- **滑动条 (Slider)**：`<input type="range" id="frame-scale-slider" min="50" max="150" step="1" value="100">`；
- **数字输入框**：`<input type="number" id="frame-scale-input" min="20" max="300" step="1" value="100"> %`；
- **微调步进按钮**：
  - `[-5%]`：快速微缩 5%；
  - `[+5%]`：快速放大 5%；
- **重置按钮**：`↺ 100%`，瞬间恢复当前帧默认原始比例。

### 3.2 交互联动体验
- 用户勾选「洋葱皮残影」后，前一帧（第 1 帧）的残影出现在视口背后；
- 用户拖动第 2 帧的缩放滑块，右下角播放器和对齐视口以 60FPS 极速响应，实时呈现人物变大变小的平滑过渡；
- 用户观察头盔顶端、肩膀宽度与洋葱皮残影重合，即可完成校准。

---

## 4. 算法与渲染设计 (Algorithm & Rendering)

### 4.1 基于锚点的数学推导
在 `js/core/frame-alignment.js` 与 `js/core/animation-player.js` 中：
设单帧原图选框宽度为 $W$，高度为 $H$；
帧缩放比为 $s = \text{frame.scale} \ || \ 1.0$；
缩放后的渲染包围盒尺寸为：
$$W' = W \times s$$
$$H' = H \times s$$

视口中基准十字准星位置为 $(\text{targetBaseX}, \text{targetBaseY})$，锚点归一化比例为 $(P_x, P_y)$（脚底中心为 $P_x = 0.5, P_y = 1.0$），位移为 $(O_x, O_y)$。
则该帧在视口 Canvas 上的绘制左上角目标坐标 $(dx, dy)$ 为：
$$dx = \text{targetBaseX} - W' \times P_x + O_x$$
$$dy = \text{targetBaseY} - H' \times P_y + O_y$$

Canvas 绘制调用：
```javascript
ctx.drawImage(sourceCanvasOrImage, sx, sy, sw, sh, dx, dy, W * s, H * s);
```
**数学特性保证**：当锚点为脚底 ($P_y = 1.0$) 时，$dy = \text{targetBaseY} - H \times s + O_y$。脚底接触点 $dy + H' = \text{targetBaseY} + O_y$，与缩放比 $s$ 无关！人物在缩放过程中脚底始终稳定锁定在地面线上！

### 4.2 洋葱皮残影适配
洋葱皮生成前一帧/后一帧时，同样读取该相邻帧各自的 `frame.scale` 进行渲染，保证残影本身也是准确缩放后的姿态。

---

## 5. 导出系统适配 (Export Pipeline Integration)

在 `js/core/exporter.js` 中：

1. **导出透明 PNG 序列帧 (ZIP)**：
   - 提取帧像素时，如果 `frame.scale !== 1.0`：
     - 创建缩放后尺寸的离屏 Canvas：$W' = \text{round}(W \times s)$, $H' = \text{round}(H \times s)$；
     - 使用平滑图像渲染（`ctx.imageSmoothingQuality = 'high'`）将原图或遮罩层等比重采样绘制；
     - 导出为该尺寸的透明 PNG。
   - `animation.json` 中同步记录 `scale: frame.scale` 元数据。

2. **导出新精灵表大图 (Sprite Sheet)**：
   - 在排版每一个规整网格单元格时，单元格大小自适应所有帧缩放后的最大宽度与高度；
   - 居中或按锚点将缩放后的各帧绘制入大图，彻底抹平忽大忽小问题。

3. **导出动图 (GIF)**：
   - 逐帧渲染到 GIF 编码器时，传入应用了 `frame.scale` 的视口渲染逻辑。

---

## 6. 测试与质量保证 (Testing & QA)

1. **新增单元测试 `tests/test_frame_scale.js`**：
   - 测试 1：验证 `frame.scale` 在默认值、合法范围 [0.2, 3.0] 的设置与重置；
   - 测试 2：验证脚底锚点（0.5, 1.0）缩放时，底部 Y 坐标保持不变的数学定理；
   - 测试 3：验证中心锚点（0.5, 0.5）缩放时，中心坐标保持不变；
   - 测试 4：验证导出离屏缩放 Canvas 像素尺寸符合预期；
   - 测试 5：验证各导出器对 `scale` 属性的健壮性。
2. **回归现有全套测试**：
   - 运行全部 9 个现有测试套件，确保 0 破坏性。
3. **单文件脱机打包与版本构建**：
   - 执行 `python build_single_file.py`，更新 `SpriteAnimator.html`。
