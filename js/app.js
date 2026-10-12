/**
 * @file app.js
 * @description Sprite Animator 应用主入口模块
 */

import { state, eventBus } from './core/state.js';
import { ImageProcessor, parseColor } from './core/image-processor.js';
import { CanvasWorkspace } from './core/canvas-workspace.js';
import { overlapIsolator } from './core/overlap-isolator.js';
import { FrameAlignment, frameAlignment } from './core/frame-alignment.js';
import { AnimationPlayer } from './core/animation-player.js';
import { Exporter } from './core/exporter.js';

class SpriteAnimatorApp {
  constructor() {
    // 准星拖拽交互状态
    this.isDraggingPivot = false;
    this.pivotDragOrigin = null;
    this.draggedFrame = null;

    this.initElements();
    this.initAnimationPlayer();
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
    this.btnExportZip = document.getElementById('btn-export-zip');
    this.btnExportSheet = document.getElementById('btn-export-sheet');
    this.btnExportGif = document.getElementById('btn-export-gif');
    this.btnAutoDetect = document.getElementById('btn-auto-detect');
    this.btnRemoveBg = document.getElementById('btn-remove-bg');

    // 导出进度模态框元素
    this.modalExportProgress = document.getElementById('modal-export-progress');
    this.exportModalTitle = document.getElementById('export-modal-title');
    this.exportStatusText = document.getElementById('export-status-text');
    this.exportProgressBar = document.getElementById('export-progress-bar');

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
    this.btnDeleteFrame = document.getElementById('btn-delete-frame');
    this.btnClearFrames = document.getElementById('btn-clear-frames');
    this.frameWInput = document.getElementById('frame-w');
    this.frameHInput = document.getElementById('frame-h');
    this.btnUnifySize = document.getElementById('btn-unify-size');
    this.btnGridSlice = document.getElementById('btn-grid-slice');
    this.playerZoomSelect = document.getElementById('player-zoom-select');

    // 统一尺寸与网格切片模态框元素
    this.modalUnifySize = document.getElementById('modal-unify-size');
    this.btnCloseUnifyModal = document.getElementById('btn-close-unify-modal');
    this.btnCancelUnify = document.getElementById('btn-cancel-unify');
    this.btnConfirmUnify = document.getElementById('btn-confirm-unify');
    this.radioUnifySelected = document.getElementById('radio-unify-selected');
    this.radioUnifyMax = document.getElementById('radio-unify-max');
    this.radioUnifyCustom = document.getElementById('radio-unify-custom');
    this.labelSelectedSize = document.getElementById('label-selected-size');
    this.labelMaxSize = document.getElementById('label-max-size');
    this.unifyCustomW = document.getElementById('unify-custom-w');
    this.unifyCustomH = document.getElementById('unify-custom-h');
    this.unifyAlignAnchor = document.getElementById('unify-align-anchor');

    this.modalGridSlice = document.getElementById('modal-grid-slice');
    this.btnCloseGridModal = document.getElementById('btn-close-grid-modal');
    this.btnCancelGrid = document.getElementById('btn-cancel-grid');
    this.btnConfirmGrid = document.getElementById('btn-confirm-grid');
    this.gridRowsInput = document.getElementById('grid-rows-input');
    this.gridColsInput = document.getElementById('grid-cols-input');
    this.gridSliceSummary = document.getElementById('grid-slice-summary');
    this.gridFilterEmpty = document.getElementById('grid-filter-empty');
    this.gridPresetBtns = document.querySelectorAll('.grid-preset-btn');

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
    this.btnTopPlayPause = document.getElementById('btn-top-play-pause');
    this.topPlayIcon = document.getElementById('top-play-icon');
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

  /**
   * 初始化实时动画播放器引擎
   */
  initAnimationPlayer() {
    const playerState = state.get('playerState') || {};
    this.player = new AnimationPlayer({
      fps: playerState.fps || 12,
      loopMode: playerState.loopMode || 'loop',
      frames: state.get('frames') || [],
      canvas: this.playerCanvas,
      sourceImage: state.get('sourceImage'),
      onFrameChange: (index, frame) => {
        state.setPlayerState({ currentFrameIndex: index });
        if (this.playerFrameIndicator) {
          const total = this.player.frames.length;
          this.playerFrameIndicator.textContent = total > 0 ? `${index + 1} / ${total}` : '0 / 0';
        }
        // 高亮当前播放帧缩略图
        this.highlightPlayingFrame(index);

        // 如果在暂停状态下单步切换，联动全局选中帧
        if (!this.player.isPlaying && frame) {
          state.selectFrame(frame.id);
        }
      },
      onPlayStateChange: (isPlaying) => {
        state.setPlayerState({ isPlaying });
        this.updatePlayPauseUI(isPlaying);
        this.setStatus(isPlaying ? `动画正在以 ${this.player.fps} FPS 播放中...` : '动画播放已暂停');
      },
      renderCustom: (canvas, frame, allFrames, currentIndex, sourceImage, opts) => {
        if (!canvas) return;
        const ps = state.get('playerState') || {};
        frameAlignment.renderAlignmentStage(
          canvas,
          frame,
          allFrames,
          currentIndex,
          sourceImage,
          {
            ...ps,
            ...opts
          }
        );
      }
    });
  }

  /**
   * 高亮播放中的当前帧项，并滚动到视口中
   * @param {number} index 
   */
  highlightPlayingFrame(index) {
    if (!this.frameList) return;
    const items = this.frameList.querySelectorAll('.frame-item');
    items.forEach((item, idx) => {
      const isCurrent = idx === index;
      item.classList.toggle('playing', isCurrent);
      if (isCurrent && this.player && this.player.isPlaying) {
        item.scrollIntoView({ behavior: 'auto', block: 'nearest' });
      }
    });
  }

  /**
   * 更新顶栏与播放器底部的播放/暂停按钮视觉状态
   * @param {boolean} isPlaying 
   */
  updatePlayPauseUI(isPlaying) {
    if (this.playIcon) {
      this.playIcon.textContent = isPlaying ? '⏸' : '▶';
    }
    if (this.topPlayIcon) {
      this.topPlayIcon.textContent = isPlaying ? '⏸' : '▶';
    }
    if (this.btnTopPlayPause) {
      const label = this.btnTopPlayPause.querySelector('span:not(#top-play-icon)');
      if (label) label.textContent = isPlaying ? '暂停' : '播放';
      this.btnTopPlayPause.classList.toggle('btn-primary', isPlaying);
      this.btnTopPlayPause.classList.toggle('btn-secondary', !isPlaying);
    }
    if (this.btnPlayPause) {
      this.btnPlayPause.classList.toggle('playing', isPlaying);
    }
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

    // 删除当前选中单帧
    if (this.btnDeleteFrame) {
      this.btnDeleteFrame.addEventListener('click', () => {
        const selectedId = state.get('selectedFrameId');
        if (!selectedId) {
          this.setStatus('请先在帧列表中选择要删除的单帧');
          return;
        }
        const frame = state.getSelectedFrame();
        state.removeFrame(selectedId);
        this.setStatus(`已删除单帧: ${frame?.name || selectedId}`);
      });
    }

    if (this.btnClearFrames) {
      this.btnClearFrames.addEventListener('click', () => {
        if (state.get('frames').length === 0) return;
        state.setState({ frames: [], selectedFrameId: null });
        this.setStatus('已清空所有选框');
      });
    }

    // 选框尺寸 (W × H) 实时编辑
    const handleFrameDimensionChange = () => {
      const selectedFrame = state.getSelectedFrame();
      if (!selectedFrame) return;

      let newW = parseInt(this.frameWInput?.value, 10);
      let newH = parseInt(this.frameHInput?.value, 10);
      if (isNaN(newW) || newW < 1) newW = selectedFrame.rect.w;
      if (isNaN(newH) || newH < 1) newH = selectedFrame.rect.h;

      if (newW === selectedFrame.rect.w && newH === selectedFrame.rect.h) return;

      // 默认以脚底中心对齐扩展/收缩
      const oldRect = selectedFrame.rect;
      const cx = oldRect.x + oldRect.w / 2;
      const by = oldRect.y + oldRect.h;
      const newX = Math.round(cx - newW / 2);
      const newY = Math.round(by - newH);

      state.updateFrame(selectedFrame.id, {
        rect: { x: newX, y: newY, w: newW, h: newH }
      });

      // 如果有隔离画布，需要以新尺寸重置
      if (selectedFrame.maskCanvas) {
        const sourceImage = state.get('sourceImage');
        if (sourceImage) {
          overlapIsolator.initFrameCanvas(selectedFrame, sourceImage);
        }
      }

      this.renderMainCanvas();
      this.updateSingleThumbnail(selectedFrame.id);
      this.renderPlayerViewport();
      this.setStatus(`当前帧尺寸已更新为: ${newW} × ${newH} px`);
    };

    if (this.frameWInput) {
      this.frameWInput.addEventListener('change', handleFrameDimensionChange);
      this.frameWInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleFrameDimensionChange();
      });
    }
    if (this.frameHInput) {
      this.frameHInput.addEventListener('change', handleFrameDimensionChange);
      this.frameHInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleFrameDimensionChange();
      });
    }

    // 统一尺寸与网格切片弹窗逻辑绑定
    this.bindUnifySizeModal();
    this.bindGridSliceModal();

    // 播放器视口缩放模式下拉选择
    if (this.playerZoomSelect) {
      this.playerZoomSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        state.setPlayerState({ viewportScaleMode: val });
        this.renderPlayerViewport();
        this.setStatus(`视口缩放模式已设为: ${e.target.options[e.target.selectedIndex]?.text || val}`);
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

    // 导出功能项点击处理
    if (this.btnExportZip) {
      this.btnExportZip.addEventListener('click', () => {
        this.exportMenu?.classList.remove('show');
        this.handleExportZip();
      });
    }
    if (this.btnExportSheet) {
      this.btnExportSheet.addEventListener('click', () => {
        this.exportMenu?.classList.remove('show');
        this.handleExportSheet();
      });
    }
    if (this.btnExportGif) {
      this.btnExportGif.addEventListener('click', () => {
        this.exportMenu?.classList.remove('show');
        this.handleExportGif();
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

    // 绑定实时动画播放器控件与键盘全局快捷键
    this.bindPlayerControls();

    // 绑定九宫格锚点、偏移量输入、洋葱皮与准星拖拽事件
    this.bindAlignmentEvents();
  }

  /**
   * 绑定实时动画播放器按钮、滑块、下拉选择与键盘全局快捷键
   */
  bindPlayerControls() {
    // 1. 播放/暂停按钮 (底栏主按钮与顶栏快捷按钮双向同步)
    const handleTogglePlay = () => {
      if (!this.player) return;
      const willPlay = !this.player.isPlaying;
      if (willPlay && (!this.player.frames || this.player.frames.length === 0)) {
        this.setStatus('请先导入图片并添加或识别选框以播放动画');
        return;
      }
      this.player.toggle();
    };

    if (this.btnPlayPause) {
      this.btnPlayPause.addEventListener('click', handleTogglePlay);
    }
    if (this.btnTopPlayPause) {
      this.btnTopPlayPause.addEventListener('click', handleTogglePlay);
    }

    // 2. 帧率 (FPS) 滑块与数值显示实时双向绑定 (1~60)
    if (this.fpsSlider) {
      this.fpsSlider.addEventListener('input', (e) => {
        const fps = parseInt(e.target.value, 10) || 12;
        if (this.player) this.player.setFPS(fps);
        state.setPlayerState({ fps });
        if (this.fpsDisplay) {
          this.fpsDisplay.textContent = `${fps} FPS`;
        }
      });
    }

    // 3. 循环模式下拉菜单 (Loop / Once / Pingpong)
    if (this.loopModeSelect) {
      this.loopModeSelect.addEventListener('change', (e) => {
        const mode = e.target.value;
        if (this.player) this.player.setLoopMode(mode);
        state.setPlayerState({ loopMode: mode });
        const modeNames = { loop: '循环播放 (Loop)', once: '单次播放 (Once)', pingpong: '往返乒乓 (Ping-pong)' };
        this.setStatus(`播放模式已更新为: ${modeNames[mode] || mode}`);
      });
    }

    // 4. 首帧、末帧、上一帧、下一帧控制按钮
    if (this.btnFirstFrame) {
      this.btnFirstFrame.addEventListener('click', () => {
        if (!this.player) return;
        this.player.firstFrame();
        const frame = this.player.getCurrentFrame();
        if (frame) state.selectFrame(frame.id);
        this.setStatus('已跳转至第一帧');
      });
    }

    if (this.btnLastFrame) {
      this.btnLastFrame.addEventListener('click', () => {
        if (!this.player) return;
        this.player.lastFrame();
        const frame = this.player.getCurrentFrame();
        if (frame) state.selectFrame(frame.id);
        this.setStatus('已跳转至最后一帧');
      });
    }

    if (this.btnPrevFrame) {
      this.btnPrevFrame.addEventListener('click', () => {
        if (!this.player) return;
        this.player.prevFrame();
        const frame = this.player.getCurrentFrame();
        if (frame) state.selectFrame(frame.id);
        this.setStatus(`单步上一帧 (第 ${this.player.currentFrameIndex + 1} 帧)`);
      });
    }

    if (this.btnNextFrame) {
      this.btnNextFrame.addEventListener('click', () => {
        if (!this.player) return;
        this.player.nextFrame();
        const frame = this.player.getCurrentFrame();
        if (frame) state.selectFrame(frame.id);
        this.setStatus(`单步下一帧 (第 ${this.player.currentFrameIndex + 1} 帧)`);
      });
    }

    // 5. 键盘全局快捷键：
    //    - 空格键 (Space): 播放/暂停切换
    //    - 逗号 (,) / 左箭头 (ArrowLeft, 暂停时且无 Shift): 上一帧
    //    - 句号 (.) / 右箭头 (ArrowRight, 暂停时且无 Shift): 下一帧
    //    - 方向键 (ArrowUp/Down/Left/Right 配合 Shift 或单独上下键): 1px / 10px 偏移量微调
    window.addEventListener('keydown', (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // 空格键：播放/暂停切换
      if (e.code === 'Space') {
        if (!e.repeat) {
          e.preventDefault();
          handleTogglePlay();
        }
        return;
      }

      // 逗号 (,) 或 <：单步上一帧 (暂停时)
      if (e.key === ',' || e.key === '<') {
        e.preventDefault();
        if (this.player && !this.player.isPlaying) {
          this.player.prevFrame();
          const frame = this.player.getCurrentFrame();
          if (frame) state.selectFrame(frame.id);
          this.setStatus(`单步步退: 第 ${this.player.currentFrameIndex + 1} 帧`);
        }
        return;
      }

      // 句号 (.) 或 >：单步下一帧 (暂停时)
      if (e.key === '.' || e.key === '>') {
        e.preventDefault();
        if (this.player && !this.player.isPlaying) {
          this.player.nextFrame();
          const frame = this.player.getCurrentFrame();
          if (frame) state.selectFrame(frame.id);
          this.setStatus(`单步步进: 第 ${this.player.currentFrameIndex + 1} 帧`);
        }
        return;
      }

      // Alt + 左/右箭头：作为单帧步进快捷键（上一帧 / 下一帧）
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.altKey) {
        if (this.player) {
          e.preventDefault();
          if (e.key === 'ArrowLeft') {
            this.player.prevFrame();
          } else {
            this.player.nextFrame();
          }
          const frame = this.player.getCurrentFrame();
          if (frame) state.selectFrame(frame.id);
          this.setStatus(`单步切换: 第 ${this.player.currentFrameIndex + 1} 帧`);
          return;
        }
      }

      // 方向键 1px/10px 像素偏移量微调（仅在未播放动画时生效，防止播放中误触）
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !e.altKey) {
        // 如果动画正在播放，不修改偏移量
        if (this.player && this.player.isPlaying) return;

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
        this.setStatus(`精确微调帧偏移量: X = ${newOffset.x}px, Y = ${newOffset.y}px (Shift 快速步进 10px)`);
      }
    });
  }

  /**
   * 绑定九宫格锚点对齐、偏移量微调、洋葱皮开关与准星拖拽
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

    // 5. 帧视口 (playerCanvas) 红色十字准星拖拽调整锚点交互
    this.bindPlayerCanvasPivotDrag();
  }

  /**
   * 绑定帧视口 (playerCanvas) 红色十字准星拖拽调整锚点交互
   * 支持准星 10px 悬停光标感知、拖拽反推帧内像素坐标与实时重绘联动
   */
  bindPlayerCanvasPivotDrag() {
    if (!this.playerCanvas) return;

    // 鼠标按下：检测是否命中准星并开启拖拽
    this.playerCanvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const selectedFrame = state.getSelectedFrame();
      const playerState = state.get('playerState') || {};
      if (!selectedFrame || playerState.showPivot === false) return;

      const mousePos = this.getPlayerCanvasMousePos(e);
      const crosshairPos = this.getPlayerCanvasCrosshairPos(selectedFrame);

      if (this.isNearCrosshair(mousePos, crosshairPos, 10)) {
        this.isDraggingPivot = true;
        this.draggedFrame = selectedFrame;
        this.playerCanvas.style.cursor = 'crosshair';
        e.preventDefault();
      }
    });

    // 鼠标移动：悬停显示十字光标，拖拽实时更新锚点与重绘
    this.playerCanvas.addEventListener('mousemove', (e) => {
      const mousePos = this.getPlayerCanvasMousePos(e);

      if (this.isDraggingPivot && this.draggedFrame) {
        const selectedFrame = this.draggedFrame;
        const targetBaseX = Math.round(this.playerCanvas.width / 2);
        const targetBaseY = Math.round(this.playerCanvas.height * 0.82);
        const scale = frameAlignment.lastRenderScale || 1.0;
        const localOrigin = frameAlignment.calculateWorldRenderPos(selectedFrame, 0, 0);

        const pixelX = (mousePos.x - targetBaseX) / scale - localOrigin.dx;
        const pixelY = (mousePos.y - targetBaseY) / scale - localOrigin.dy;

        frameAlignment.setCustomPivot(selectedFrame, pixelX, pixelY);
        state.updateFrame(selectedFrame.id, { pivot: { ...selectedFrame.pivot } });

        this.updatePivotGridUI(selectedFrame);
        this.renderPlayerViewport();
        this.renderMainCanvas();
        this.setStatus(`拖拽调整锚点: 像素 (${Math.round(pixelX)}, ${Math.round(pixelY)}) | 比例 (${selectedFrame.pivot.x.toFixed(2)}, ${selectedFrame.pivot.y.toFixed(2)})`);
        return;
      }

      // 悬停检测：当鼠标悬停在准星附近（命中半径 10px）时，光标显示为 crosshair
      const selectedFrame = state.getSelectedFrame();
      const playerState = state.get('playerState') || {};
      if (selectedFrame && playerState.showPivot !== false) {
        const crosshairPos = this.getPlayerCanvasCrosshairPos(selectedFrame);
        if (this.isNearCrosshair(mousePos, crosshairPos, 10)) {
          this.playerCanvas.style.cursor = 'crosshair';
          return;
        }
      }
      this.playerCanvas.style.cursor = '';
    });

    // 鼠标松开：结束拖拽
    this.playerCanvas.addEventListener('mouseup', (e) => {
      if (this.isDraggingPivot) {
        this.isDraggingPivot = false;
        this.draggedFrame = null;
        this.pivotDragOrigin = null;

        const selectedFrame = state.getSelectedFrame();
        if (selectedFrame) {
          const mousePos = this.getPlayerCanvasMousePos(e);
          const crosshairPos = this.getPlayerCanvasCrosshairPos(selectedFrame);
          this.playerCanvas.style.cursor = this.isNearCrosshair(mousePos, crosshairPos, 10) ? 'crosshair' : '';
        } else {
          this.playerCanvas.style.cursor = '';
        }
        this.setStatus('已完成帧锚点拖拽设置');
      }
    });

    // 鼠标离开：若非拖拽中则重置光标
    this.playerCanvas.addEventListener('mouseleave', () => {
      if (!this.isDraggingPivot) {
        this.playerCanvas.style.cursor = '';
      }
    });

    // 全局 mouseup 保护，防止拖拽移出画布后松开按键状态卡死
    if (typeof window !== 'undefined') {
      window.addEventListener('mouseup', () => {
        if (this.isDraggingPivot) {
          this.isDraggingPivot = false;
          this.draggedFrame = null;
          this.pivotDragOrigin = null;
          if (this.playerCanvas) {
            this.playerCanvas.style.cursor = '';
          }
          this.setStatus('已完成帧锚点拖拽设置');
        }
      });
    }
  }

  /**
   * 计算鼠标在 playerCanvas 中的实际像素坐标 (自动适配 CSS 缩放)
   * @param {MouseEvent} e 
   * @returns {{x: number, y: number}}
   */
  getPlayerCanvasMousePos(e) {
    if (!this.playerCanvas) return { x: 0, y: 0 };
    if (typeof this.playerCanvas.getBoundingClientRect !== 'function') {
      return { x: e.clientX || 0, y: e.clientY || 0 };
    }
    const rect = this.playerCanvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? this.playerCanvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? this.playerCanvas.height / rect.height : 1;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  /**
   * 获取当前帧在 playerCanvas 视口中的十字准星屏幕像素坐标 (自适应缩放)
   * @param {Object} frame 
   * @returns {{x: number, y: number}}
   */
  getPlayerCanvasCrosshairPos(frame) {
    if (!this.playerCanvas) return { x: 0, y: 0 };
    const targetBaseX = Math.round(this.playerCanvas.width / 2);
    const targetBaseY = Math.round(this.playerCanvas.height * 0.82);
    const scale = frameAlignment.lastRenderScale || 1.0;
    const ox = frame?.offset ? (frame.offset.x || 0) : 0;
    const oy = frame?.offset ? (frame.offset.y || 0) : 0;
    return {
      x: targetBaseX + ox * scale,
      y: targetBaseY + oy * scale
    };
  }

  /**
   * 判断鼠标位置是否在准星命中半径内 (默认 10px)
   * @param {{x: number, y: number}} mousePos 
   * @param {{x: number, y: number}} crosshairPos 
   * @param {number} radius 
   * @returns {boolean}
   */
  isNearCrosshair(mousePos, crosshairPos, radius = 10) {
    if (!mousePos || !crosshairPos) return false;
    const dist = Math.hypot(mousePos.x - crosshairPos.x, mousePos.y - crosshairPos.y);
    return dist <= radius;
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
   * 显示导出进度模态框
   * @param {string} title 
   * @param {string} text 
   * @param {number} percent 
   */
  showExportProgress(title, text, percent = 0) {
    if (this.exportModalTitle) this.exportModalTitle.textContent = title;
    if (this.exportStatusText) this.exportStatusText.textContent = text;
    if (this.exportProgressBar) {
      this.exportProgressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    }
    if (this.modalExportProgress) {
      this.modalExportProgress.classList.add('active');
    }
    this.setStatus(text);
  }

  /**
   * 平滑更新导出进度与说明
   * @param {string} text 
   * @param {number} percent 
   */
  updateExportProgress(text, percent) {
    if (this.exportStatusText) this.exportStatusText.textContent = text;
    if (this.exportProgressBar && percent !== undefined) {
      this.exportProgressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    }
    this.setStatus(text);
  }

  /**
   * 隐藏导出进度模态框
   */
  hideExportProgress() {
    if (this.modalExportProgress) {
      this.modalExportProgress.classList.remove('active');
    }
  }

  /**
   * 导出全部透明 PNG 序列帧 Zip 压缩包
   */
  async handleExportZip() {
    const frames = state.get('frames') || [];
    const sourceImage = state.get('sourceImage');
    const playerState = state.get('playerState') || {};

    if (frames.length === 0) {
      this.setStatus('未检测到动作选框，请先导入图像并添加或识别选框');
      return;
    }

    try {
      this.showExportProgress('导出透明序列帧包 (.zip)', '正在准备动作帧数据...', 5);

      const animName = state.get('imageMetadata')?.name?.replace(/\.[^/.]+$/, '') || 'sprite';
      const result = await Exporter.exportFramesAsZip(frames, {
        sourceImage,
        fps: playerState.fps || 12,
        name: animName,
        filename: `${animName}_frames.zip`,
        onProgress: (current, total, msg) => {
          const percent = Math.round((current / (total || 1)) * 90);
          this.updateExportProgress(msg || `正在处理第 ${current}/${total} 帧...`, percent);
        }
      });

      this.updateExportProgress('导出完成，正在唤起文件下载...', 100);
      setTimeout(() => this.hideExportProgress(), 600);

      if (result.success) {
        this.setStatus(`成功导出 ${result.count} 帧透明 PNG 序列帧包 (${animName}_frames.zip)`);
      } else {
        this.setStatus(`导出序列帧失败: ${result.error}`);
      }
    } catch (err) {
      console.error('[SpriteAnimator] 导出序列帧异常:', err);
      this.hideExportProgress();
      this.setStatus(`导出序列帧异常: ${err.message}`);
    }
  }

  /**
   * 导出重新规整排版无交叉的新 Sprite Sheet 透明大图
   */
  async handleExportSheet() {
    const frames = state.get('frames') || [];
    const sourceImage = state.get('sourceImage');

    if (frames.length === 0) {
      this.setStatus('未检测到动作选框，请先导入图像并添加或识别选框');
      return;
    }

    try {
      this.showExportProgress('导出新规整精灵表 (.png)', '正在重新计算无交叉安全排版网格...', 20);

      const animName = state.get('imageMetadata')?.name?.replace(/\.[^/.]+$/, '') || 'spritesheet';
      const result = await Exporter.exportNewSpriteSheet(frames, {
        sourceImage,
        padding: 16,
        filename: `${animName}_clean_sheet.png`
      });

      this.updateExportProgress('新精灵大图合成完成，正在触发下载...', 100);
      setTimeout(() => this.hideExportProgress(), 500);

      if (result.success) {
        const { columns, rows, width, height } = result.layout;
        this.setStatus(`已导出全新规整精灵表 (${width} × ${height} px, ${columns}列×${rows}行, 16px安全间隔，绝无交叉重叠)`);
      } else {
        this.setStatus(`导出精灵表失败: ${result.error}`);
      }
    } catch (err) {
      console.error('[SpriteAnimator] 导出精灵表异常:', err);
      this.hideExportProgress();
      this.setStatus(`导出精灵表异常: ${err.message}`);
    }
  }

  /**
   * 导出动画 GIF 动图
   */
  async handleExportGif() {
    const frames = state.get('frames') || [];
    const sourceImage = state.get('sourceImage');
    const playerState = state.get('playerState') || {};

    if (frames.length === 0) {
      this.setStatus('未检测到动作选框，请先导入图像并添加或识别选框');
      return;
    }

    try {
      this.showExportProgress('导出动图 (.gif)', '正在初始化 GIF 动画编码器...', 5);

      const animName = state.get('imageMetadata')?.name?.replace(/\.[^/.]+$/, '') || 'sprite_animation';
      const result = await Exporter.exportAnimationAsGif(
        frames,
        {
          sourceImage,
          fps: playerState.fps || 12,
          filename: `${animName}.gif`,
          onProgress: (current, total, msg) => {
            const percent = Math.round((current / (total || 1)) * 90);
            this.updateExportProgress(msg || `正在编码第 ${current}/${total} 帧...`, percent);
          }
        },
        playerState
      );

      this.updateExportProgress('动图生成完毕，正在触发下载...', 100);
      setTimeout(() => this.hideExportProgress(), 600);

      if (result.success) {
        this.setStatus(`动画动图导出成功: ${animName}.gif (${result.count} 帧, ${result.fps} FPS)`);
      } else {
        this.setStatus(`导出动图失败: ${result.error}`);
      }
    } catch (err) {
      console.error('[SpriteAnimator] 导出动图异常:', err);
      this.hideExportProgress();
      this.setStatus(`导出动图异常: ${err.message}`);
    }
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
    const closeModal = () => this.modalRemoveBg?.classList.remove('active');
    if (this.btnCloseBgModal) this.btnCloseBgModal.addEventListener('click', closeModal);
    if (this.btnCancelRemoveBg) this.btnCancelRemoveBg.addEventListener('click', closeModal);

    if (this.modalRemoveBg) {
      this.modalRemoveBg.addEventListener('click', (e) => {
        if (e.target === this.modalRemoveBg) closeModal();
      });
    }

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
   * 绑定统一选框尺寸模态框事件
   */
  bindUnifySizeModal() {
    if (this.btnUnifySize) {
      this.btnUnifySize.addEventListener('click', () => {
        const frames = state.get('frames') || [];
        if (frames.length === 0) {
          this.setStatus('暂无动作帧，请先导入图片并添加选框');
          return;
        }

        const selectedFrame = state.getSelectedFrame();
        let maxW = 0;
        let maxH = 0;
        frames.forEach(f => {
          if (f.rect.w > maxW) maxW = f.rect.w;
          if (f.rect.h > maxH) maxH = f.rect.h;
        });

        if (this.labelSelectedSize) {
          this.labelSelectedSize.textContent = selectedFrame
            ? `${selectedFrame.rect.w} × ${selectedFrame.rect.h} px`
            : '未选择 (建议先在列表中点击一帧)';
        }
        if (this.labelMaxSize) {
          this.labelMaxSize.textContent = `${maxW} × ${maxH} px`;
        }
        if (this.unifyCustomW && this.unifyCustomH) {
          this.unifyCustomW.value = selectedFrame ? selectedFrame.rect.w : maxW;
          this.unifyCustomH.value = selectedFrame ? selectedFrame.rect.h : maxH;
        }

        if (this.modalUnifySize) this.modalUnifySize.classList.add('active');
      });
    }

    const closeUnifyModal = () => {
      if (this.modalUnifySize) this.modalUnifySize.classList.remove('active');
    };

    if (this.btnCloseUnifyModal) this.btnCloseUnifyModal.addEventListener('click', closeUnifyModal);
    if (this.btnCancelUnify) this.btnCancelUnify.addEventListener('click', closeUnifyModal);

    if (this.modalUnifySize) {
      this.modalUnifySize.addEventListener('click', (e) => {
        if (e.target === this.modalUnifySize) closeUnifyModal();
      });
    }

    if (this.btnConfirmUnify) {
      this.btnConfirmUnify.addEventListener('click', () => {
        const frames = state.get('frames') || [];
        if (frames.length === 0) return;

        const selectedFrame = state.getSelectedFrame();
        let maxW = 0;
        let maxH = 0;
        frames.forEach(f => {
          if (f.rect.w > maxW) maxW = f.rect.w;
          if (f.rect.h > maxH) maxH = f.rect.h;
        });

        let targetW = 64;
        let targetH = 64;

        if (this.radioUnifySelected && this.radioUnifySelected.checked) {
          if (selectedFrame) {
            targetW = selectedFrame.rect.w;
            targetH = selectedFrame.rect.h;
          } else {
            targetW = maxW;
            targetH = maxH;
          }
        } else if (this.radioUnifyMax && this.radioUnifyMax.checked) {
          targetW = maxW;
          targetH = maxH;
        } else if (this.radioUnifyCustom && this.radioUnifyCustom.checked) {
          targetW = Math.max(1, parseInt(this.unifyCustomW?.value, 10) || 64);
          targetH = Math.max(1, parseInt(this.unifyCustomH?.value, 10) || 64);
        }

        const anchor = this.unifyAlignAnchor ? this.unifyAlignAnchor.value : 'bottom-center';
        const sourceImage = state.get('sourceImage');

        frames.forEach(frame => {
          const oldRect = frame.rect;
          let newX = oldRect.x;
          let newY = oldRect.y;

          if (anchor === 'bottom-center') {
            const cx = oldRect.x + oldRect.w / 2;
            const by = oldRect.y + oldRect.h;
            newX = Math.round(cx - targetW / 2);
            newY = Math.round(by - targetH);
          } else if (anchor === 'center') {
            const cx = oldRect.x + oldRect.w / 2;
            const cy = oldRect.y + oldRect.h / 2;
            newX = Math.round(cx - targetW / 2);
            newY = Math.round(cy - targetH / 2);
          } // top-left 保持 newX, newY 不变

          frame.rect = { x: newX, y: newY, w: targetW, h: targetH };
          if (frame.maskCanvas && sourceImage) {
            overlapIsolator.initFrameCanvas(frame, sourceImage);
          }
        });

        state.setState({ frames: [...frames] });
        closeUnifyModal();
        this.renderMainCanvas();
        this.renderFrameList();
        this.renderPlayerViewport();
        this.setStatus(`已将全部 ${frames.length} 个选框统一为 ${targetW} × ${targetH} px 规格！`);
      });
    }
  }

  /**
   * 绑定均等网格行列切片模态框事件
   */
  bindGridSliceModal() {
    const updateSliceSummary = () => {
      const sourceImage = state.get('sourceImage');
      if (!sourceImage || !this.gridSliceSummary) return;

      const rawRows = parseInt(this.gridRowsInput?.value, 10);
      const rawCols = parseInt(this.gridColsInput?.value, 10);
      const rows = Math.min(25, Math.max(1, isNaN(rawRows) ? 1 : rawRows));
      const cols = Math.min(25, Math.max(1, isNaN(rawCols) ? 1 : rawCols));

      const cellW = Math.max(1, Math.floor(sourceImage.width / cols));
      const cellH = Math.max(1, Math.floor(sourceImage.height / rows));
      const total = rows * cols;

      if (total > 100) {
        this.gridSliceSummary.style.color = '#ef476f';
        this.gridSliceSummary.textContent = `⚠ 预计生成 ${total} 帧 (超出 100 帧安全上限，请调整行/列)`;
      } else {
        this.gridSliceSummary.style.color = 'var(--accent-blue)';
        this.gridSliceSummary.textContent = `预计生成: ${total} 帧 | 单帧尺寸: ${cellW} × ${cellH} px`;
      }
    };

    if (this.btnGridSlice) {
      this.btnGridSlice.addEventListener('click', () => {
        const sourceImage = state.get('sourceImage');
        if (!sourceImage) {
          this.setStatus('请先导入精灵大图');
          return;
        }
        updateSliceSummary();
        if (this.modalGridSlice) this.modalGridSlice.classList.add('active');
      });
    }

    // 监听行数与列数实时输入变化
    if (this.gridRowsInput) {
      this.gridRowsInput.addEventListener('input', updateSliceSummary);
      this.gridRowsInput.addEventListener('change', updateSliceSummary);
    }
    if (this.gridColsInput) {
      this.gridColsInput.addEventListener('input', updateSliceSummary);
      this.gridColsInput.addEventListener('change', updateSliceSummary);
    }

    // 绑定快捷预设按钮点击
    if (this.gridPresetBtns) {
      this.gridPresetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const r = btn.dataset.rows;
          const c = btn.dataset.cols;
          if (r && this.gridRowsInput) this.gridRowsInput.value = r;
          if (c && this.gridColsInput) this.gridColsInput.value = c;
          updateSliceSummary();
        });
      });
    }

    const closeGridModal = () => {
      if (this.modalGridSlice) this.modalGridSlice.classList.remove('active');
    };

    if (this.btnCloseGridModal) this.btnCloseGridModal.addEventListener('click', closeGridModal);
    if (this.btnCancelGrid) this.btnCancelGrid.addEventListener('click', closeGridModal);

    // 点击遮罩外部也能平滑关闭
    if (this.modalGridSlice) {
      this.modalGridSlice.addEventListener('click', (e) => {
        if (e.target === this.modalGridSlice) closeGridModal();
      });
    }

    if (this.btnConfirmGrid) {
      this.btnConfirmGrid.addEventListener('click', () => {
        const sourceImage = state.get('sourceImage');
        if (!sourceImage) return;

        let rows = parseInt(this.gridRowsInput?.value, 10);
        let cols = parseInt(this.gridColsInput?.value, 10);
        if (isNaN(rows) || rows < 1) rows = 1;
        if (isNaN(cols) || cols < 1) cols = 1;

        // 严格安全上限防呆（单边最大 25，总数最大 100 帧，彻底杜绝输入大数字卡死）
        rows = Math.min(25, rows);
        cols = Math.min(25, cols);
        if (rows * cols > 100) {
          this.setStatus('单次切片总帧数不能超过 100 帧，请调小行数或列数');
          return;
        }

        const imgW = sourceImage.width;
        const imgH = sourceImage.height;
        const cellW = Math.max(4, Math.floor(imgW / cols));
        const cellH = Math.max(4, Math.floor(imgH / rows));

        const filterEmpty = this.gridFilterEmpty ? this.gridFilterEmpty.checked : true;
        let imageData = null;
        if (filterEmpty) {
          try {
            imageData = ImageProcessor.getImageDataFromImage(sourceImage);
          } catch (e) {
            console.warn('提取整图 ImageData 进行空白过滤失败，降级为不过滤:', e);
          }
        }

        this.setStatus('正在执行均等网格切片与有效帧校验...');

        const newFrames = [];
        let count = 1;
        let filteredCount = 0;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const rect = { x: c * cellW, y: r * cellH, w: cellW, h: cellH };

            // 若开启过滤且判定为空白帧，则剔除
            if (filterEmpty && imageData) {
              const isEmpty = ImageProcessor.isRectContentEmpty(imageData, rect, {
                tolerance: 20,
                minForegroundRatio: 0.005 // 0.5% 阈值
              });
              if (isEmpty) {
                filteredCount++;
                continue;
              }
            }

            newFrames.push({
              id: 'frame_' + Date.now() + '_' + count,
              name: `帧 ${count}`,
              rect,
              offset: { x: 0, y: 0 },
              pivot: { x: 0.5, y: 1.0 }, // 默认脚底中心对齐
              maskCanvas: null
            });
            count++;
          }
        }

        if (newFrames.length === 0) {
          this.setStatus('未检测到有效动作内容帧，已取消切片');
          closeGridModal();
          return;
        }

        // 批量更新状态（只触发一次视图订阅）
        state.setState({ frames: newFrames, selectedFrameId: newFrames[0]?.id || null });
        closeGridModal();
        this.renderMainCanvas();

        const filterMsg = filteredCount > 0 ? ` (已智能剔除 ${filteredCount} 帧空白背景)` : '';
        this.setStatus(`均等网格切片完成: 共生成 ${newFrames.length} 帧${filterMsg}，单帧规格 ${cellW} × ${cellH} px`);
      });
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
      this.updatePlayPauseUI(playerState.isPlaying);
      if (this.onionSkinToggle) {
        this.onionSkinToggle.checked = Boolean(playerState.onionSkin);
      }
      if (this.groundLineToggle) {
        this.groundLineToggle.checked = playerState.showGround !== false;
      }
      if (this.fpsSlider && playerState.fps !== undefined) {
        this.fpsSlider.value = playerState.fps;
      }
      if (this.fpsDisplay && playerState.fps !== undefined) {
        this.fpsDisplay.textContent = `${playerState.fps} FPS`;
      }
      if (this.loopModeSelect && playerState.loopMode) {
        this.loopModeSelect.value = playerState.loopMode;
      }
      if (!this.player || !this.player.isPlaying) {
        this.renderPlayerViewport();
      }
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
      if (this.player) {
        this.player.setSourceImage(img);
      }
      this.renderFrameList();
      this.renderPlayerViewport();
    });

    // 监听帧列表变化更新缩略图列表
    state.subscribe('frames', (frames) => {
      if (this.player) {
        this.player.setFrames(frames || []);
      }
      this.renderFrameList();
      this.renderPlayerViewport();
    });

    // 监听选中帧变化高亮
    state.subscribe('selectedFrameId', (selectedId) => {
      this.updateSelectedFrameUI(selectedId);
      if (this.player && !this.player.isPlaying) {
        const frames = state.get('frames') || [];
        const idx = frames.findIndex(f => f.id === selectedId);
        if (idx !== -1) {
          this.player.goToFrame(idx);
        }
      }
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

      // 缩略图右上角单帧删除小叉叉按钮
      const delBtn = document.createElement('button');
      delBtn.className = 'frame-item-del-btn';
      delBtn.title = '删除此单帧';
      delBtn.textContent = '×';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.removeFrame(frame.id);
        this.setStatus(`已删除动作帧: ${frame.name || `帧 ${idx + 1}`}`);
      });

      thumbBox.appendChild(thumbCanvas);
      thumbBox.appendChild(badge);
      thumbBox.appendChild(delBtn);

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
    if (this.player && this.player.isPlaying) {
      this.highlightPlayingFrame(this.player.getCurrentFrameIndex());
    }
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

    // 联动同步当前帧的宽/高尺寸输入框
    if (frame && this.frameWInput && this.frameHInput) {
      this.frameWInput.value = Math.round(frame.rect.w);
      this.frameHInput.value = Math.round(frame.rect.h);
    } else if (!frame && this.frameWInput && this.frameHInput) {
      this.frameWInput.value = '';
      this.frameHInput.value = '';
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
      {
        ...playerState,
        zoom: playerState.viewportScaleMode || 'auto'
      }
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
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    window.__SPRITE_ANIMATOR__ = new SpriteAnimatorApp();
  });
}

export { SpriteAnimatorApp };
