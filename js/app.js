/**
 * @file app.js
 * @description Sprite Animator 应用主入口模块
 */

import { state, eventBus } from './core/state.js';
import { ImageProcessor, parseColor } from './core/image-processor.js';
import { CanvasWorkspace } from './core/canvas-workspace.js';
import { overlapIsolator } from './core/overlap-isolator.js';
import { FrameAlignment, frameAlignment } from './core/frame-alignment.js';

class SpriteAnimatorApp {
  constructor() {
    this.initElements();
    this.initCanvasWorkspace();
    this.bindEvents();
    this.bindStateSubscriptions();
    this.initCanvas();
    console.log('[SpriteAnimator] App initialized successfully.');
  }

  initElements() {
    // 顶部操作元素
    this.btnImport = document.getElementById('btn-import-image');
    this.fileInput = document.getElementById('file-input');
    this.btnEmptyImport = document.getElementById('btn-empty-import');
    this.emptyPlaceholder = document.getElementById('empty-placeholder');
    this.btnExportDropdown = document.getElementById('btn-export-dropdown');
    this.exportMenu = document.getElementById('export-menu');
    this.btnAutoDetect = document.getElementById('btn-auto-detect');
    this.btnRemoveBg = document.getElementById('btn-remove-bg');

    // 图像与信息 Badges
    this.imageNameBadge = document.getElementById('image-name-badge');
    this.imageDimBadge = document.getElementById('image-dim-badge');
    this.cursorPosBadge = document.getElementById('cursor-pos-badge');
    this.currentFrameInfoBadge = document.getElementById('current-frame-info-badge');

    // 工具按钮
    this.toolButtons = document.querySelectorAll('.tool-btn');
    this.brushSizeSlider = document.getElementById('brush-size-slider');
    this.brushSizeInput = document.getElementById('brush-size-input');
    this.toleranceSlider = document.getElementById('tolerance-slider');
    this.toleranceInput = document.getElementById('tolerance-input');

    // 缩放控件
    this.zoomSlider = document.getElementById('zoom-slider');
    this.zoomDisplay = document.getElementById('zoom-display');
    this.btnZoomIn = document.getElementById('btn-zoom-in');
    this.btnZoomOut = document.getElementById('btn-zoom-out');
    this.btnZoomFit = document.getElementById('btn-zoom-fit');
    this.btnZoom100 = document.getElementById('btn-zoom-100');

    // 画布与面板
    this.viewportContainer = document.getElementById('viewport-container');
    this.mainCanvas = document.getElementById('main-canvas');
    this.playerCanvas = document.getElementById('player-canvas');
    this.statusMessage = document.getElementById('status-message');

    // 帧列表面板
    this.frameCountBadge = document.getElementById('frame-count-badge');
    this.frameList = document.getElementById('frame-list');
    this.btnAddFrame = document.getElementById('btn-add-frame');
    this.btnClearFrames = document.getElementById('btn-clear-frames');

    // 锚点与对齐控制
    this.pivotGrid = document.getElementById('pivot-grid');
    this.pivotDots = document.querySelectorAll('.pivot-dot');
    this.offsetXInput = document.getElementById('offset-x');
    this.offsetYInput = document.getElementById('offset-y');
    this.onionSkinToggle = document.getElementById('onion-skin-toggle');
    this.groundLineToggle = document.getElementById('ground-line-toggle');

    // 播放器与视口控件
    this.btnPlayPause = document.getElementById('btn-play-pause');
    this.playIcon = document.getElementById('play-icon');
    this.fpsSlider = document.getElementById('fps-slider');
    this.fpsDisplay = document.getElementById('fps-display');
    this.loopModeSelect = document.getElementById('loop-mode-select');
    this.playerFrameIndicator = document.getElementById('player-frame-indicator');
    this.btnFirstFrame = document.getElementById('btn-first-frame');
    this.btnPrevFrame = document.getElementById('btn-prev-frame');
    this.btnNextFrame = document.getElementById('btn-next-frame');
    this.btnLastFrame = document.getElementById('btn-last-frame');

    // 背景透明化模态框元素
    this.modalRemoveBg = document.getElementById('modal-remove-bg');
    this.btnCloseBgModal = document.getElementById('btn-close-bg-modal');
    this.btnCancelRemoveBg = document.getElementById('btn-cancel-remove-bg');
    this.btnConfirmRemoveBg = document.getElementById('btn-confirm-remove-bg');
    this.bgColorPicker = document.getElementById('bg-color-picker');
    this.bgColorHex = document.getElementById('bg-color-hex');
    this.bgColorPreviewBox = document.getElementById('bg-color-preview-box');
    this.btnSampleTopLeft = document.getElementById('btn-sample-top-left');
    this.presetColorBtns = document.querySelectorAll('.preset-color-btn');
    this.modalToleranceSlider = document.getElementById('modal-tolerance-slider');
    this.modalToleranceVal = document.getElementById('modal-tolerance-val');
  }

  initCanvasWorkspace() {
    if (this.mainCanvas && this.viewportContainer) {
      this.canvasWorkspace = new CanvasWorkspace(this.mainCanvas, this.viewportContainer);
      this.canvasWorkspace.enableRectNudge = false; // 由 App 接管键盘方向键作为帧 offset 精确对齐微调
      this.canvasWorkspace.onFrameRectChange = (frameId) => {
        this.updateSelectedFrameUI(frameId);
        this.updateSingleThumbnail(frameId);
        this.renderPlayerViewport();
      };
      this.canvasWorkspace.onFrameModified = (frameId) => {
        this.updateSingleThumbnail(frameId);
        this.renderPlayerViewport();
        this.setStatus('当前帧局部像素已修整更新 (已记录历史快照，支持 Ctrl+Z 撤销 / Ctrl+Y 重做)');
      };
    }
  }

  /**
   * 局部快速更新单个帧缩略图
   * @param {string} frameId 
   */
  updateSingleThumbnail(frameId) {
    if (!this.frameList) return;
    const itemEl = this.frameList.querySelector(`.frame-item[data-id="${frameId}"]`);
    if (!itemEl) return;

    const thumbCanvas = itemEl.querySelector('.frame-thumb-canvas');
    if (!thumbCanvas) return;

    const frame = state.get('frames').find(f => f.id === frameId);
    const sourceImage = state.get('sourceImage');
    if (!frame) return;

    const tctx = thumbCanvas.getContext('2d');
    if (!tctx) return;

    tctx.clearRect(0, 0, thumbCanvas.width, thumbCanvas.height);
    if (frame.rect.w > 0 && frame.rect.h > 0) {
      tctx.imageSmoothingEnabled = false;
      const scale = Math.min(60 / frame.rect.w, 60 / frame.rect.h);
      const dw = frame.rect.w * scale;
      const dh = frame.rect.h * scale;
      const dx = (66 - dw) / 2;
      const dy = (66 - dh) / 2;

      if (frame.maskCanvas) {
        tctx.drawImage(
          frame.maskCanvas,
          0, 0, frame.rect.w, frame.rect.h,
          dx, dy, dw, dh
        );
      } else if (sourceImage) {
        tctx.drawImage(
          sourceImage,
          frame.rect.x, frame.rect.y, frame.rect.w, frame.rect.h,
          dx, dy, dw, dh
        );
      }
    }
  }

  bindEvents() {
    // 导入图片触发
    const triggerFileInput = () => this.fileInput && this.fileInput.click();
    if (this.btnImport) this.btnImport.addEventListener('click', triggerFileInput);
    if (this.btnEmptyImport) this.btnEmptyImport.addEventListener('click', triggerFileInput);

    // 文件选择器变化处理
    if (this.fileInput) {
      this.fileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          await this.loadSourceImageFile(file);
          this.fileInput.value = ''; // 允许重复选择同名文件
        }
      });
    }

    // 拖拽导入文件
    this.bindDragAndDrop();

    // 自动识别选框按钮
    if (this.btnAutoDetect) {
      this.btnAutoDetect.addEventListener('click', () => this.handleAutoDetectFrames());
    }

    // 顶部背景透明化按钮及弹窗控制
    this.bindBackgroundTransparencyModal();

    // 帧列表操作按钮
    if (this.btnAddFrame) {
      this.btnAddFrame.addEventListener('click', () => {
        if (!state.get('sourceImage')) {
          this.setStatus('请先导入精灵大图');
          return;
        }
        state.addFrame({
          rect: { x: 0, y: 0, w: 64, h: 64 }
        });
        this.setStatus('已添加新选框');
      });
    }

    if (this.btnClearFrames) {
      this.btnClearFrames.addEventListener('click', () => {
        if (state.get('frames').length === 0) return;
        state.setState({ frames: [], selectedFrameId: null });
        this.setStatus('已清空所有选框');
      });
    }

    // 导出下拉菜单展开/收起
    if (this.btnExportDropdown && this.exportMenu) {
      this.btnExportDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
        this.exportMenu.classList.toggle('show');
      });
      document.addEventListener('click', () => {
        this.exportMenu.classList.remove('show');
      });
    }

    // 工具按钮切换
    this.toolButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        if (tool) {
          state.setCurrentTool(tool);
        }
      });
    });

    // 笔刷大小双向绑定
    if (this.brushSizeSlider && this.brushSizeInput) {
      this.brushSizeSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.brushSizeInput.value = val;
        state.setState({ brushSize: val });
      });
      this.brushSizeInput.addEventListener('change', (e) => {
        const val = Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 10));
        e.target.value = val;
        this.brushSizeSlider.value = val;
        state.setState({ brushSize: val });
      });
    }

    // 容差大小双向绑定
    if (this.toleranceSlider && this.toleranceInput) {
      this.toleranceSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.toleranceInput.value = val;
        state.setState({ tolerance: val });
      });
      this.toleranceInput.addEventListener('change', (e) => {
        const val = Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0));
        e.target.value = val;
        this.toleranceSlider.value = val;
        state.setState({ tolerance: val });
      });
    }

    // 缩放滑块与快捷缩放
    if (this.zoomSlider) {
      this.zoomSlider.addEventListener('input', (e) => {
        const zoomPercent = parseInt(e.target.value, 10);
        if (this.canvasWorkspace) {
          this.canvasWorkspace.setZoom(zoomPercent / 100);
        }
      });
    }
    if (this.btnZoomIn) {
      this.btnZoomIn.addEventListener('click', () => {
        if (this.canvasWorkspace) this.canvasWorkspace.zoomIn();
      });
    }
    if (this.btnZoomOut) {
      this.btnZoomOut.addEventListener('click', () => {
        if (this.canvasWorkspace) this.canvasWorkspace.zoomOut();
      });
    }
    if (this.btnZoomFit) {
      this.btnZoomFit.addEventListener('click', () => {
        if (this.canvasWorkspace) this.canvasWorkspace.fitToView();
      });
    }
    if (this.btnZoom100) {
      this.btnZoom100.addEventListener('click', () => {
        if (this.canvasWorkspace) this.canvasWorkspace.resetZoom();
      });
    }

    // 播放器 FPS 滑块
    if (this.fpsSlider && this.fpsDisplay) {
      this.fpsSlider.addEventListener('input', (e) => {
        const fps = parseInt(e.target.value, 10);
        this.fpsDisplay.textContent = `${fps} FPS`;
        state.setPlayerState({ fps });
      });
    }

    // 循环模式
    if (this.loopModeSelect) {
      this.loopModeSelect.addEventListener('change', (e) => {
        state.setPlayerState({ loopMode: e.target.value });
      });
    }

    // 播放/暂停
    if (this.btnPlayPause) {
      this.btnPlayPause.addEventListener('click', () => {
        const isPlaying = !state.get('playerState').isPlaying;
        state.setPlayerState({ isPlaying });
      });
    }

    // 绑定九宫格锚点、偏移量输入、洋葱皮与键盘微调事件
    this.bindAlignmentEvents();
  }

  /**
   * 绑定九宫格锚点对齐、偏移量微调、洋葱皮开关与快捷键
   */
  bindAlignmentEvents() {
    // 1. 九宫格锚点按钮点击
    if (this.pivotDots) {
      this.pivotDots.forEach(dot => {
        dot.addEventListener('click', () => {
          const pivotKey = dot.dataset.pivot;
          const selectedFrame = state.getSelectedFrame();
          if (!selectedFrame) {
            this.setStatus('请先在帧列表中选择一个动作选框');
            return;
          }

          frameAlignment.setPivotPreset(selectedFrame, pivotKey);
          state.updateFrame(selectedFrame.id, { pivot: { ...selectedFrame.pivot } });

          this.updatePivotGridUI(selectedFrame);
          this.renderMainCanvas();
          this.renderPlayerViewport();
          this.setStatus(`当前帧锚点已设为: ${dot.getAttribute('title') || pivotKey}`);
        });
      });
    }

    // 2. X / Y 偏移量输入框双向绑定
    const handleOffsetChange = () => {
      const selectedFrame = state.getSelectedFrame();
      if (!selectedFrame) return;

      const x = parseFloat(this.offsetXInput ? this.offsetXInput.value : 0) || 0;
      const y = parseFloat(this.offsetYInput ? this.offsetYInput.value : 0) || 0;

      selectedFrame.offset = { x, y };
      state.updateFrame(selectedFrame.id, { offset: { x, y } });

      this.renderMainCanvas();
      this.renderPlayerViewport();
    };

    if (this.offsetXInput) {
      this.offsetXInput.addEventListener('input', handleOffsetChange);
      this.offsetXInput.addEventListener('change', handleOffsetChange);
    }
    if (this.offsetYInput) {
      this.offsetYInput.addEventListener('input', handleOffsetChange);
      this.offsetYInput.addEventListener('change', handleOffsetChange);
    }

    // 3. 洋葱皮开关联动
    if (this.onionSkinToggle) {
      this.onionSkinToggle.addEventListener('change', (e) => {
        state.setPlayerState({ onionSkin: e.target.checked });
        this.renderPlayerViewport();
        this.setStatus(e.target.checked ? '已开启洋葱皮残影 (前帧淡红，后帧淡蓝)' : '已关闭洋葱皮残影');
      });
    }

    // 4. 地面参考线开关联动
    if (this.groundLineToggle) {
      this.groundLineToggle.addEventListener('change', (e) => {
        state.setPlayerState({ showGround: e.target.checked });
        this.renderPlayerViewport();
        this.setStatus(e.target.checked ? '已开启地面水平参考基准线' : '已关闭地面参考线');
      });
    }

    // 5. 键盘方向键 (↑ ↓ ← →) 1px 精确微调 (Shift + 方向键 10px 快速微调)
    window.addEventListener('keydown', (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const selectedFrame = state.getSelectedFrame();
        if (!selectedFrame) return;

        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;

        if (e.key === 'ArrowLeft') dx = -step;
        if (e.key === 'ArrowRight') dx = step;
        if (e.key === 'ArrowUp') dy = -step;
        if (e.key === 'ArrowDown') dy = step;

        const newOffset = frameAlignment.nudgeOffset(selectedFrame, dx, dy);
        state.updateFrame(selectedFrame.id, { offset: { ...newOffset } });

        if (this.offsetXInput) this.offsetXInput.value = newOffset.x;
        if (this.offsetYInput) this.offsetYInput.value = newOffset.y;

        this.renderMainCanvas();
        this.renderPlayerViewport();
        this.setStatus(`精确微调帧偏移量: X = ${newOffset.x}px, Y = ${newOffset.y}px (按 Shift 快速步进 10px)`);
      }
    });

    // 6. 播放器快捷步进切换帧按钮
    const switchFrameStep = (delta) => {
      const frames = state.get('frames') || [];
      if (frames.length === 0) return;
      const selectedId = state.get('selectedFrameId');
      let curIdx = frames.findIndex(f => f.id === selectedId);
      if (curIdx === -1) curIdx = 0;
      const nextIdx = (curIdx + delta + frames.length) % frames.length;
      state.selectFrame(frames[nextIdx].id);
    };

    if (this.btnFirstFrame) {
      this.btnFirstFrame.addEventListener('click', () => {
        const frames = state.get('frames') || [];
        if (frames.length > 0) state.selectFrame(frames[0].id);
      });
    }
    if (this.btnLastFrame) {
      this.btnLastFrame.addEventListener('click', () => {
        const frames = state.get('frames') || [];
        if (frames.length > 0) state.selectFrame(frames[frames.length - 1].id);
      });
    }
    if (this.btnPrevFrame) {
      this.btnPrevFrame.addEventListener('click', () => switchFrameStep(-1));
    }
    if (this.btnNextFrame) {
      this.btnNextFrame.addEventListener('click', () => switchFrameStep(1));
    }
  }

  /**
   * 绑定拖拽导入图片
   */
  bindDragAndDrop() {
    const targets = [this.viewportContainer, this.emptyPlaceholder].filter(Boolean);

    targets.forEach(el => {
      ['dragenter', 'dragover'].forEach(eventName => {
        el.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (this.emptyPlaceholder) this.emptyPlaceholder.classList.add('drag-over');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        el.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (this.emptyPlaceholder) this.emptyPlaceholder.classList.remove('drag-over');
        });
      });

      el.addEventListener('drop', async (e) => {
        const files = e.dataTransfer && e.dataTransfer.files;
        if (files && files.length > 0) {
          await this.loadSourceImageFile(files[0]);
        }
      });
    });
  }

  /**
   * 从本地文件加载大图并更新状态与界面
   * @param {File} file 
   */
  async loadSourceImageFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      this.setStatus('请选择有效的图像文件 (PNG / JPG / WebP)');
      return;
    }

    try {
      this.setStatus(`正在载入图像: ${file.name}...`);
      const img = await ImageProcessor.loadImageFromFile(file);

      // 更新全局状态
      state.setState({
        sourceImage: img,
        imageMetadata: {
          name: file.name,
          width: img.naturalWidth,
          height: img.naturalHeight,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight
        },
        frames: [],
        selectedFrameId: null
      });

      // 更新顶部 Badges
      if (this.imageNameBadge) this.imageNameBadge.textContent = file.name;
      if (this.imageDimBadge) this.imageDimBadge.textContent = `${img.naturalWidth} × ${img.naturalHeight} px`;

      this.setStatus(`图像载入成功: ${file.name} (${img.naturalWidth} × ${img.naturalHeight})`);
      this.renderFrameList();
    } catch (err) {
      console.error('[SpriteAnimator] 加载图像失败:', err);
      this.setStatus(`图像载入失败: ${err.message}`);
    }
  }

  /**
   * 自动识别动作角色外接矩形
   */
  handleAutoDetectFrames() {
    const img = state.get('sourceImage');
    if (!img) {
      this.setStatus('请先导入精灵大图再执行识别');
      return;
    }

    try {
      this.setStatus('正在分析连通域并提取独立动作包围盒...');
      const imageData = ImageProcessor.getImageDataFromImage(img);

      // minSize = 8 过滤噪点，mergeDistance = 4 自动连接相邻部件
      const boxes = ImageProcessor.detectBoundingBoxes(imageData, 8, 4);

      if (boxes.length === 0) {
        this.setStatus('未检测到独立选框。若图像包含白底/绿幕，请先点击【背景透明化】消除背景');
        return;
      }

      const fps = state.get('playerState')?.fps || 12;
      const duration = Math.round(1000 / fps);

      // 生成 Frame 列表
      const newFrames = boxes.map((box, index) => ({
        id: `frame_${Date.now()}_${index}`,
        name: `帧 ${index + 1}`,
        rect: { x: box.x, y: box.y, w: box.width, h: box.height },
        offset: { x: 0, y: 0 },
        pivot: { x: 0.5, y: 1.0 },
        maskCanvas: null,
        customPixels: null,
        duration
      }));

      state.setState({
        frames: newFrames,
        selectedFrameId: newFrames[0]?.id || null
      });

      this.setStatus(`自动识别完成，成功提取 ${newFrames.length} 个动作选框`);
    } catch (err) {
      console.error('[SpriteAnimator] 自动识别失败:', err);
      this.setStatus(`识别异常: ${err.message}`);
    }
  }

  /**
   * 背景透明化模态框事件绑定与扣图处理
   */
  bindBackgroundTransparencyModal() {
    if (!this.modalRemoveBg) return;

    // 打开模态框
    if (this.btnRemoveBg) {
      this.btnRemoveBg.addEventListener('click', () => {
        const img = state.get('sourceImage');
        if (!img) {
          this.setStatus('请先导入精灵大图');
          return;
        }

        // 同步全局容差到弹窗
        const curTol = state.get('tolerance') ?? 20;
        if (this.modalToleranceSlider) this.modalToleranceSlider.value = curTol;
        if (this.modalToleranceVal) this.modalToleranceVal.textContent = curTol;

        // 默认自动取左上角像素颜色
        this.sampleTopLeftColor();

        this.modalRemoveBg.classList.add('active');
      });
    }

    // 关闭模态框
    const closeModal = () => this.modalRemoveBg.classList.remove('active');
    if (this.btnCloseBgModal) this.btnCloseBgModal.addEventListener('click', closeModal);
    if (this.btnCancelRemoveBg) this.btnCancelRemoveBg.addEventListener('click', closeModal);

    // 弹窗容差滑块
    if (this.modalToleranceSlider && this.modalToleranceVal) {
      this.modalToleranceSlider.addEventListener('input', (e) => {
        this.modalToleranceVal.textContent = e.target.value;
      });
    }

    // 预设颜色快捷按钮
    this.presetColorBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const hex = btn.dataset.color;
        this.updateModalColor(hex);
      });
    });

    // 点击左上角取色
    if (this.btnSampleTopLeft) {
      this.btnSampleTopLeft.addEventListener('click', () => this.sampleTopLeftColor());
    }

    // 原生拾色器与 HEX 文本框联动
    if (this.bgColorPicker) {
      this.bgColorPicker.addEventListener('input', (e) => {
        this.updateModalColor(e.target.value, false);
      });
    }
    if (this.bgColorHex) {
      this.bgColorHex.addEventListener('change', (e) => {
        let val = e.target.value.trim();
        if (!val.startsWith('#')) val = '#' + val;
        this.updateModalColor(val, true);
      });
    }

    // 点击确定应用透明化
    if (this.btnConfirmRemoveBg) {
      this.btnConfirmRemoveBg.addEventListener('click', () => this.applyBackgroundTransparency());
    }
  }

  sampleTopLeftColor() {
    const img = state.get('sourceImage');
    if (!img) return;

    try {
      const imageData = ImageProcessor.getImageDataFromImage(img);
      const color = ImageProcessor.sampleColor(imageData, 0, 0);
      const toHex = (c) => c.toString(16).padStart(2, '0');
      const hex = `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
      this.updateModalColor(hex);
    } catch (e) {
      console.warn('提取左上角颜色失败:', e);
    }
  }

  updateModalColor(hex, syncPicker = true) {
    if (!hex) return;
    const formattedHex = hex.toUpperCase();
    if (this.bgColorHex) this.bgColorHex.value = formattedHex;
    if (syncPicker && this.bgColorPicker) {
      try {
        this.bgColorPicker.value = hex.startsWith('#') && hex.length === 7 ? hex : '#ffffff';
      } catch (_) {}
    }
    if (this.bgColorPreviewBox) this.bgColorPreviewBox.style.backgroundColor = hex;
  }

  /**
   * 应用背景透明化
   */
  applyBackgroundTransparency() {
    const img = state.get('sourceImage');
    if (!img) return;

    try {
      const targetColor = this.bgColorHex ? this.bgColorHex.value : '#ffffff';
      const tolerance = this.modalToleranceSlider ? parseInt(this.modalToleranceSlider.value, 10) : 20;

      this.setStatus('正在执行背景消除与透明通道转换...');

      const imageData = ImageProcessor.getImageDataFromImage(img);
      ImageProcessor.removeColorBackground(imageData, targetColor, tolerance);

      const offscreen = ImageProcessor.createCanvasFromImageData(imageData);
      const newImg = new Image();
      newImg.onload = () => {
        state.setState({ sourceImage: newImg });
        this.renderMainCanvas();
        this.renderFrameList();
        this.setStatus(`背景透明化完成 (扣除颜色: ${targetColor}, 容差: ${tolerance})`);
      };
      newImg.src = offscreen.toDataURL('image/png');

      // 关闭模态框
      if (this.modalRemoveBg) this.modalRemoveBg.classList.remove('active');
    } catch (err) {
      console.error('[SpriteAnimator] 透明化失败:', err);
      this.setStatus(`透明化失败: ${err.message}`);
    }
  }

  /**
   * 状态订阅与动态刷新
   */
  bindStateSubscriptions() {
    // 监听工具变化高亮对应按钮
    state.subscribe('currentTool', (tool) => {
      this.toolButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === tool);
      });
      const toolNames = {
        select: '选择选框工具 (V)',
        create_box: '新建选框工具 (B)',
        eraser: '交叉消除橡皮擦 (E)',
        lasso: '多边形套索 (L)',
        wand: '魔棒抠图 (W)',
        pan: '抓手平移 (Space)'
      };
      this.setStatus(`当前工具: ${toolNames[tool] || tool}`);
    });

    // 监听播放状态切换图标
    state.subscribe('playerState', (playerState) => {
      if (this.playIcon) {
        this.playIcon.textContent = playerState.isPlaying ? '⏸' : '▶';
      }
      if (this.onionSkinToggle) {
        this.onionSkinToggle.checked = Boolean(playerState.onionSkin);
      }
      if (this.groundLineToggle) {
        this.groundLineToggle.checked = playerState.showGround !== false;
      }
      this.renderPlayerViewport();
    });

    // 监听视口变换，同步顶栏缩放比例显示与滑块
    state.subscribe('viewport', (vp) => {
      const zoomPercent = Math.round(vp.zoom * 100);
      if (this.zoomDisplay) {
        this.zoomDisplay.textContent = `${zoomPercent}%`;
      }
      if (this.zoomSlider) {
        this.zoomSlider.value = zoomPercent;
      }
    });

    // 监听图像导入以隐藏空状态提示并重绘
    state.subscribe('sourceImage', (img) => {
      if (this.emptyPlaceholder) {
        this.emptyPlaceholder.style.display = img ? 'none' : 'flex';
      }
      this.renderFrameList();
      this.renderPlayerViewport();
    });

    // 监听帧列表变化更新缩略图列表
    state.subscribe('frames', () => {
      this.renderFrameList();
      this.renderPlayerViewport();
    });

    // 监听选中帧变化高亮
    state.subscribe('selectedFrameId', (selectedId) => {
      this.updateSelectedFrameUI(selectedId);
      this.renderPlayerViewport();
    });
  }

  /**
   * 触发主画布重绘 (由 CanvasWorkspace 代理调度)
   */
  renderMainCanvas() {
    if (this.canvasWorkspace) {
      this.canvasWorkspace.requestRender();
    }
  }

  /**
   * 渲染右侧动作帧列表缩略图序列
   */
  renderFrameList() {
    if (!this.frameList) return;

    const frames = state.get('frames') || [];
    const selectedId = state.get('selectedFrameId');
    const sourceImage = state.get('sourceImage');

    if (this.frameCountBadge) {
      this.frameCountBadge.textContent = frames.length;
    }

    this.frameList.innerHTML = '';

    frames.forEach((frame, idx) => {
      const itemEl = document.createElement('div');
      itemEl.className = `frame-item ${frame.id === selectedId ? 'selected' : ''}`;
      itemEl.dataset.id = frame.id;

      // 缩略图容器与离屏渲染
      const thumbBox = document.createElement('div');
      thumbBox.className = 'frame-thumb-box checkerboard-bg';

      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.className = 'frame-thumb-canvas';
      thumbCanvas.width = 66;
      thumbCanvas.height = 66;
      const tctx = thumbCanvas.getContext('2d');

      if (tctx && frame.rect.w > 0 && frame.rect.h > 0) {
        tctx.imageSmoothingEnabled = false;
        const scale = Math.min(60 / frame.rect.w, 60 / frame.rect.h);
        const dw = frame.rect.w * scale;
        const dh = frame.rect.h * scale;
        const dx = (66 - dw) / 2;
        const dy = (66 - dh) / 2;

        if (frame.maskCanvas) {
          tctx.drawImage(
            frame.maskCanvas,
            0, 0, frame.rect.w, frame.rect.h,
            dx, dy, dw, dh
          );
        } else if (sourceImage) {
          tctx.drawImage(
            sourceImage,
            frame.rect.x, frame.rect.y, frame.rect.w, frame.rect.h,
            dx, dy, dw, dh
          );
        }
      }

      const badge = document.createElement('div');
      badge.className = 'frame-badge';
      badge.textContent = `${idx + 1}`;

      thumbBox.appendChild(thumbCanvas);
      thumbBox.appendChild(badge);

      const title = document.createElement('div');
      title.className = 'frame-title';
      title.textContent = frame.name || `帧 ${idx + 1}`;

      itemEl.appendChild(thumbBox);
      itemEl.appendChild(title);

      itemEl.addEventListener('click', () => {
        state.selectFrame(frame.id);
      });

      this.frameList.appendChild(itemEl);
    });

    this.updateSelectedFrameUI(selectedId);
  }

  /**
   * 更新当前选中帧的高亮与顶部状态卡片
   * @param {string|null} selectedId 
   */
  updateSelectedFrameUI(selectedId) {
    if (this.frameList) {
      const items = this.frameList.querySelectorAll('.frame-item');
      items.forEach(el => {
        el.classList.toggle('selected', el.dataset.id === selectedId);
      });
    }

    const frame = state.getSelectedFrame();
    if (this.currentFrameInfoBadge) {
      if (frame) {
        this.currentFrameInfoBadge.textContent = `${frame.name} (${frame.rect.w} × ${frame.rect.h})`;
      } else {
        this.currentFrameInfoBadge.textContent = '选框: 无';
      }
    }

    // 联动同步右侧侧边栏九宫格按钮高亮与偏移量输入框
    this.updatePivotGridUI(frame);
    this.updateOffsetUI(frame);
    this.renderPlayerViewport();
  }

  /**
   * 根据当前帧的相对锚点自动更新右侧九宫格按钮高亮
   * @param {Object|null} frame 
   */
  updatePivotGridUI(frame) {
    if (!this.pivotDots) return;
    if (!frame) {
      this.pivotDots.forEach(dot => dot.classList.remove('active'));
      return;
    }

    const activePresetKey = frameAlignment.getPivotPresetKey(frame); // 如 'bottom-center'
    this.pivotDots.forEach(dot => {
      const dotKey = dot.dataset.pivot;
      dot.classList.toggle('active', dotKey === activePresetKey);
    });
  }

  /**
   * 同步 X / Y 偏移量输入框数值
   * @param {Object|null} frame 
   */
  updateOffsetUI(frame) {
    if (this.offsetXInput) {
      this.offsetXInput.value = frame?.offset ? (frame.offset.x || 0) : 0;
    }
    if (this.offsetYInput) {
      this.offsetYInput.value = frame?.offset ? (frame.offset.y || 0) : 0;
    }
  }

  /**
   * 渲染实时动画播放器与对齐视口舞台 (包含洋葱皮残影、地面参考基准线与锚点十字星)
   */
  renderPlayerViewport() {
    if (!this.playerCanvas) return;
    const frames = state.get('frames') || [];
    const selectedId = state.get('selectedFrameId');
    const sourceImage = state.get('sourceImage');
    const playerState = state.get('playerState') || {};

    let currentIndex = frames.findIndex(f => f.id === selectedId);
    if (currentIndex === -1 && frames.length > 0) {
      currentIndex = 0;
    }

    const currentFrame = currentIndex >= 0 ? frames[currentIndex] : null;

    // 更新底部帧索引指示器 (例如 "3 / 10")
    if (this.playerFrameIndicator) {
      if (frames.length > 0 && currentIndex >= 0) {
        this.playerFrameIndicator.textContent = `${currentIndex + 1} / ${frames.length}`;
      } else {
        this.playerFrameIndicator.textContent = '0 / 0';
      }
    }

    frameAlignment.renderAlignmentStage(
      this.playerCanvas,
      currentFrame,
      frames,
      currentIndex,
      sourceImage,
      playerState
    );
  }

  /**
   * 设置底部状态栏文本
   * @param {string} msg 
   */
  setStatus(msg) {
    if (this.statusMessage) {
      this.statusMessage.textContent = msg;
    }
  }

  initCanvas() {
    this.renderPlayerViewport();
  }
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
  window.__SPRITE_ANIMATOR__ = new SpriteAnimatorApp();
});

export { SpriteAnimatorApp };
