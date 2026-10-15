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
import { GifDecoder } from './core/gif-decoder.js';

class SpriteAnimatorApp {
  constructor() {
    // 准星与画面偏移拖拽交互状态
    this.isDraggingPivot = false;
    this.isDraggingOffset = false;
    this.pivotDragOrigin = null;
    this.offsetDragStartMouse = null;
    this.offsetDragInitial = null;
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
    this.btnImportGif = document.getElementById('btn-import-gif');
    this.fileInput = document.getElementById('file-input');
    this.gifFileInput = document.getElementById('gif-file-input');
    this.btnEmptyImport = document.getElementById('btn-empty-import');
    this.btnEmptyImportGif = document.getElementById('btn-empty-import-gif');
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
    this.btnToggleSnap = document.getElementById('btn-toggle-snap');
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
    this.gridAutoAlignY = document.getElementById('grid-auto-align-y');
    this.gridPresetBtns = document.querySelectorAll('.grid-preset-btn');

    // 锚点与对齐控制
    this.pivotGrid = document.getElementById('pivot-grid');
    this.pivotDots = document.querySelectorAll('.pivot-dot');
    this.offsetXInput = document.getElementById('offset-x');
    this.offsetYInput = document.getElementById('offset-y');
    this.btnAlignAllXY = document.getElementById('btn-align-all-xy');
    this.btnAlignFrameGround = document.getElementById('btn-align-frame-ground');
    this.btnAlignAllGround = document.getElementById('btn-align-all-ground');
    this.btnResetOffset = document.getElementById('btn-reset-offset');
    this.onionSkinToggle = document.getElementById('onion-skin-toggle');
    this.ghostOverlayToggle = document.getElementById('ghost-overlay-toggle');
    this.groundLineToggle = document.getElementById('ground-line-toggle');

    // 单帧人物缩放控制
    this.frameScaleSlider = document.getElementById('frame-scale-slider');
    this.frameScaleInput = document.getElementById('frame-scale-input');
    this.frameScaleDisplay = document.getElementById('frame-scale-display');
    this.btnSuggestScale = document.getElementById('btn-suggest-scale');
    this.btnScaleMinus = document.getElementById('btn-scale-minus');
    this.btnScalePlus = document.getElementById('btn-scale-plus');
    this.btnResetScale = document.getElementById('btn-reset-scale');
    this.btnAutoScaleAll = document.getElementById('btn-auto-scale-all');
    this.btnAutoScaleFrame = document.getElementById('btn-auto-scale-frame');
    this.scaleCompareCanvas = document.getElementById('scale-compare-canvas');
    this.scalePreviewGhostTag = document.getElementById('scale-preview-ghost-tag');
    this.scalePreviewCurrentTag = document.getElementById('scale-preview-current-tag');

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
    this.panelPlayer = document.getElementById('panel-player') || document.querySelector('.panel-player');
    this.btnToggleFullscreenPlayer = document.getElementById('btn-toggle-fullscreen-player');

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

    // GIF 拆分模态框元素
    this.modalGifSplit = document.getElementById('modal-gif-split');
    this.btnCloseGifModal = document.getElementById('btn-close-gif-modal');
    this.btnCancelGif = document.getElementById('btn-cancel-gif');
    this.btnGifToWorkspace = document.getElementById('btn-gif-to-workspace');
    this.btnGifDownloadZip = document.getElementById('btn-gif-download-zip');
    this.gifPreviewCanvas = document.getElementById('gif-preview-canvas');
    this.gifMetaFilename = document.getElementById('gif-meta-filename');
    this.gifMetaDim = document.getElementById('gif-meta-dim');
    this.gifMetaFrames = document.getElementById('gif-meta-frames');
    this.gifMetaFps = document.getElementById('gif-meta-fps');
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
        const effectiveZoom = ps.viewportScaleMode || ps.zoom || 'auto';
        frameAlignment.renderAlignmentStage(
          canvas,
          frame,
          allFrames,
          currentIndex,
          sourceImage,
          {
            ...ps,
            ...opts,
            zoom: effectiveZoom
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

    const cw = thumbCanvas.width || 96;
    const ch = thumbCanvas.height || 96;
    tctx.clearRect(0, 0, cw, ch);

    if (frame.rect.w > 0 && frame.rect.h > 0) {
      tctx.imageSmoothingEnabled = false;
      const s = (typeof frame.scale === 'number' && !isNaN(frame.scale) && frame.scale > 0) ? frame.scale : 1.0;
      const baseFit = Math.min((cw - 8) / frame.rect.w, (ch - 8) / frame.rect.h);
      const effectiveScale = baseFit * s;
      const dw = frame.rect.w * effectiveScale;
      const dh = frame.rect.h * effectiveScale;
      const dx = (cw - dw) / 2;
      const dy = (ch - dh) / 2;

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

    // 动态同步缩略图左下角的缩放百分比胶囊徽章
    const thumbBox = itemEl.querySelector('.frame-thumb-box');
    if (thumbBox) {
      let scalePill = thumbBox.querySelector('.frame-scale-pill');
      const sVal = (typeof frame.scale === 'number') ? frame.scale : 1.0;
      const sPercent = Math.round(sVal * 100);
      if (sPercent !== 100) {
        if (!scalePill) {
          scalePill = document.createElement('div');
          scalePill.className = 'frame-scale-pill';
          scalePill.style.cssText = 'position: absolute; bottom: 4px; left: 4px; font-size: 9px; font-weight: 700; background: rgba(58, 134, 255, 0.9); color: #fff; padding: 1px 4px; border-radius: 3px; font-family: var(--font-mono); pointer-events: none; z-index: 2;';
          thumbBox.appendChild(scalePill);
        }
        scalePill.textContent = `${sPercent}%`;
        scalePill.style.display = 'block';
      } else if (scalePill) {
        scalePill.style.display = 'none';
      }
    }
  }

  bindEvents() {
    // 侧边栏宽度自由拖拽调整
    this.bindSidebarResizer();

    // 导入图片触发
    const triggerFileInput = () => this.fileInput && this.fileInput.click();
    if (this.btnImport) this.btnImport.addEventListener('click', triggerFileInput);
    if (this.btnEmptyImport) this.btnEmptyImport.addEventListener('click', triggerFileInput);

    // 导入拆分 GIF 动图触发
    const triggerGifInput = () => this.gifFileInput && this.gifFileInput.click();
    if (this.btnImportGif) this.btnImportGif.addEventListener('click', triggerGifInput);
    if (this.btnEmptyImportGif) this.btnEmptyImportGif.addEventListener('click', triggerGifInput);

    if (this.gifFileInput) {
      this.gifFileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          await this.handleGifFile(file);
          this.gifFileInput.value = '';
        }
      });
    }

    // 文件选择器变化处理 (支持自动识别并分流 GIF)
    if (this.fileInput) {
      this.fileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          await this.loadSourceImageFile(file);
          this.fileInput.value = ''; // 允许重复选择同名文件
        }
      });
    }

    // 绑定 GIF 拆分模态框
    this.bindGifSplitModal();

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
          this.showToast('请先导入精灵大图，再添加选框', 'warning', {
            label: '📂 立即选择图片',
            onClick: () => this.fileInput?.click()
          });
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
    this.bindSnapToggle();

    // 播放器视口缩放模式下拉选择
    if (this.playerZoomSelect) {
      this.playerZoomSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        state.setPlayerState({ viewportScaleMode: val, zoom: val });
        this.renderPlayerViewport();
        if (this.player && this.player.isPlaying) {
          this.player.render();
        }
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

    // 5. 播放器大屏全屏模式切换
    if (this.btnToggleFullscreenPlayer && this.panelPlayer) {
      this.btnToggleFullscreenPlayer.addEventListener('click', () => {
        const isFullscreen = this.panelPlayer.classList.toggle('fullscreen-mode');
        if (isFullscreen) {
          this.playerCanvas.width = 640;
          this.playerCanvas.height = 500;
          this.btnToggleFullscreenPlayer.title = '退出大屏视口 (Esc)';
          this.btnToggleFullscreenPlayer.classList.add('active');
          this.setStatus('已进入大屏视口预览模式 (按 Esc 或再次点击退出)');
        } else {
          this.playerCanvas.width = 460;
          this.playerCanvas.height = 380;
          this.btnToggleFullscreenPlayer.title = '最大化 / 展开大屏视口预览';
          this.btnToggleFullscreenPlayer.classList.remove('active');
          this.setStatus('已恢复标准侧边栏视口预览');
        }
        this.renderPlayerViewport();
        if (this.player && this.player.isPlaying) {
          this.player.render();
        }
      });
    }

    // 6. 键盘全局快捷键：
    //    - 空格键 (Space): 播放/暂停切换
    //    - Esc 键: 退出播放器全屏模式
    //    - 逗号 (,) / 左箭头 (ArrowLeft, 暂停时且无 Shift): 上一帧
    //    - 句号 (.) / 右箭头 (ArrowRight, 暂停时且无 Shift): 下一帧
    //    - 方向键 (ArrowUp/Down/Left/Right 配合 Shift 或单独上下键): 1px / 10px 偏移量微调
    window.addEventListener('keydown', (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // 按 Esc 退出大屏视口预览
      if (e.key === 'Escape' && this.panelPlayer && this.panelPlayer.classList.contains('fullscreen-mode')) {
        this.panelPlayer.classList.remove('fullscreen-mode');
        this.playerCanvas.width = 460;
        this.playerCanvas.height = 380;
        if (this.btnToggleFullscreenPlayer) {
          this.btnToggleFullscreenPlayer.title = '最大化 / 展开大屏视口预览';
          this.btnToggleFullscreenPlayer.classList.remove('active');
        }
        this.renderPlayerViewport();
        if (this.player && this.player.isPlaying) {
          this.player.render();
        }
        this.setStatus('已退出大屏视口预览');
        return;
      }

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

    // 7. 绑定手风琴卡片折叠交互与偏好记忆
    this.bindAccordionCards();
  }

  /**
   * 绑定全网页四大长流板块与手风琴卡片的折叠交互与偏好记忆
   */
  bindAccordionCards() {
    const cards = document.querySelectorAll('.flow-section, .accordion-card');
    if (!cards || cards.length === 0) return;

    const STORAGE_KEY = 'sprite_animator_flow_sections_state';

    // 1. 尝试从 localStorage 恢复用户折叠习惯
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const stateMap = JSON.parse(saved);
        cards.forEach((card) => {
          const cardId = card.getAttribute('data-card-id') || card.id;
          if (cardId && stateMap[cardId] !== undefined) {
            const isCollapsed = Boolean(stateMap[cardId]);
            card.classList.toggle('collapsed', isCollapsed);
            const arrow = card.querySelector('.flow-section-arrow, .card-arrow');
            if (arrow) {
              arrow.textContent = isCollapsed ? '▸' : '▾';
            }
          }
        });
      }
    } catch (err) {
      console.warn('[SpriteAnimator] Failed to read flow state from localStorage:', err);
    }

    // 2. 为每个板块/卡片头部绑定点击折叠交互
    cards.forEach((card) => {
      const header = card.querySelector('.flow-section-header, .card-header');
      if (!header) return;

      header.addEventListener('click', (e) => {
        // 如果点击的是头部内部的操作按钮、下拉框、输入框等交互控件，不触发折叠
        if (e.target.closest('button, select, input, .flow-section-actions select, .flow-section-actions button, .card-header-actions select, .card-header-actions button')) {
          return;
        }

        const willCollapse = !card.classList.contains('collapsed');
        card.classList.toggle('collapsed', willCollapse);

        const arrow = card.querySelector('.flow-section-arrow, .card-arrow');
        if (arrow) {
          arrow.textContent = willCollapse ? '▸' : '▾';
        }

        // 保存最新偏好到 localStorage
        try {
          const stateMap = {};
          cards.forEach((c) => {
            const cId = c.getAttribute('data-card-id') || c.id;
            if (cId) {
              stateMap[cId] = c.classList.contains('collapsed');
            }
          });
          localStorage.setItem(STORAGE_KEY, JSON.stringify(stateMap));
        } catch (err) {
          console.warn('[SpriteAnimator] Failed to save flow state to localStorage:', err);
        }

        // 触发视口尺寸同步与重绘
        setTimeout(() => {
          if (this.canvasWorkspace) {
            this.canvasWorkspace.resize();
            this.renderMainCanvas();
          }
          this.renderPlayerViewport();
          if (this.player && this.player.isPlaying) {
            this.player.render();
          }
        }, 50);
      });
    });

    // 3. 监听全局窗口尺寸变化，保证主画布视口和播放器始终像素对齐
    window.addEventListener('resize', () => {
      if (this.canvasWorkspace) {
        this.canvasWorkspace.resize();
        this.renderMainCanvas();
      }
      this.renderPlayerViewport();
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

    // 2.3 单帧人物缩放比例 (Scale) 事件绑定
    const handleScaleChange = (newPercent, commit = true) => {
      let selectedFrame = state.getSelectedFrame();
      if (!selectedFrame) {
        const frames = state.get('frames') || [];
        if (frames.length > 0) {
          const currentIdx = (this.player && this.player.currentFrameIndex >= 0 && this.player.currentFrameIndex < frames.length)
            ? this.player.currentFrameIndex
            : 0;
          selectedFrame = frames[currentIdx];
          state.selectFrame(selectedFrame.id);
        } else {
          this.setStatus('当前无动作帧，请先导入图片并添加切片选框');
          this.showToast('请先导入图片并添加切片选框后再调节人物缩放', 'warning');
          return;
        }
      }

      const scale = frameAlignment.setScale(selectedFrame, newPercent / 100);
      const percent = Math.round(scale * 100);

      if (this.frameScaleSlider && document.activeElement !== this.frameScaleSlider) {
        this.frameScaleSlider.value = percent;
      }
      if (this.frameScaleInput && document.activeElement !== this.frameScaleInput) {
        this.frameScaleInput.value = percent;
      }
      if (this.frameScaleDisplay) {
        this.frameScaleDisplay.textContent = `${percent}%`;
      }

      // 直接同步内存中当前帧的 scale，确保视口毫秒级即时反映
      selectedFrame.scale = scale;
      if (commit) {
        state.updateFrame(selectedFrame.id, { scale });
      }

      // 实时更新缩略图徽章、主画布、播放器视口以及步骤 3 的实时对比小舞台
      this.updateSingleThumbnail(selectedFrame.id);
      this.renderMainCanvas();
      this.renderPlayerViewport();
      this.renderScalePreviewViewport();
      if (this.player && this.player.isPlaying) {
        this.player.render();
      }
      this.setStatus(`当前帧 [${selectedFrame.name || '选框'}] 人物缩放比例已调整为: ${percent}%`);
    };

    if (this.frameScaleSlider) {
      this.frameScaleSlider.addEventListener('input', (e) => {
        handleScaleChange(parseFloat(e.target.value) || 100, false);
      });
      this.frameScaleSlider.addEventListener('change', (e) => {
        handleScaleChange(parseFloat(e.target.value) || 100, true);
      });
    }

    if (this.frameScaleInput) {
      this.frameScaleInput.addEventListener('change', (e) => {
        handleScaleChange(parseFloat(e.target.value) || 100, true);
      });
      this.frameScaleInput.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val) && val >= 20 && val <= 300) {
          handleScaleChange(val, false);
        }
      });
    }

    if (this.btnScaleMinus) {
      this.btnScaleMinus.addEventListener('click', () => {
        let selectedFrame = state.getSelectedFrame();
        if (!selectedFrame) {
          const frames = state.get('frames') || [];
          if (frames.length > 0) {
            state.selectFrame(frames[0].id);
            selectedFrame = frames[0];
          }
        }
        if (!selectedFrame) {
          this.showToast('请先选择动作帧', 'warning');
          return;
        }
        const curScale = (typeof selectedFrame.scale === 'number') ? selectedFrame.scale : 1.0;
        handleScaleChange(Math.round((curScale - 0.05) * 100), true);
      });
    }

    if (this.btnScalePlus) {
      this.btnScalePlus.addEventListener('click', () => {
        let selectedFrame = state.getSelectedFrame();
        if (!selectedFrame) {
          const frames = state.get('frames') || [];
          if (frames.length > 0) {
            state.selectFrame(frames[0].id);
            selectedFrame = frames[0];
          }
        }
        if (!selectedFrame) {
          this.showToast('请先选择动作帧', 'warning');
          return;
        }
        const curScale = (typeof selectedFrame.scale === 'number') ? selectedFrame.scale : 1.0;
        handleScaleChange(Math.round((curScale + 0.05) * 100), true);
      });
    }

    if (this.btnResetScale) {
      this.btnResetScale.addEventListener('click', () => {
        let selectedFrame = state.getSelectedFrame();
        if (!selectedFrame) {
          const frames = state.get('frames') || [];
          if (frames.length > 0) {
            state.selectFrame(frames[0].id);
            selectedFrame = frames[0];
          }
        }
        if (!selectedFrame) {
          this.showToast('请先选择动作帧', 'warning');
          return;
        }
        frameAlignment.resetScale(selectedFrame);
        handleScaleChange(100, true);
        this.setStatus('已恢复当前帧缩放为 100% 原始尺寸');
      });
    }

    // 2.4 一键智能自动身高校准
    if (this.btnAutoScaleAll) {
      this.btnAutoScaleAll.addEventListener('click', () => {
        this.handleAutoScale(true);
      });
    }
    if (this.btnAutoScaleFrame) {
      this.btnAutoScaleFrame.addEventListener('click', () => {
        this.handleAutoScale(false);
      });
    }

    // 2.5 自动对齐、脚底贴地与归零快捷按钮（自定义位置可直接拖拽预览框角色）
    if (this.btnAlignAllXY) {
      this.btnAlignAllXY.addEventListener('click', () => {
        this.handleAutoAlignGround(true, { alignX: true, alignY: true, xMode: 'body-center' });
      });
    }
    if (this.btnAlignAllGround) {
      this.btnAlignAllGround.addEventListener('click', () => {
        this.handleAutoAlignGround(true, { alignX: false, alignY: true });
      });
    }
    if (this.btnAlignFrameGround) {
      this.btnAlignFrameGround.addEventListener('click', () => {
        this.handleAutoAlignGround(false, { alignX: false, alignY: true });
      });
    }
    if (this.btnResetOffset) {
      this.btnResetOffset.addEventListener('click', () => {
        const selectedFrame = state.getSelectedFrame();
        if (!selectedFrame) {
          this.setStatus('请先选择一个动作帧');
          return;
        }
        frameAlignment.resetOffset(selectedFrame);
        state.updateFrame(selectedFrame.id, { offset: { x: 0, y: 0 } });
        this.updateOffsetUI(selectedFrame);
        this.renderMainCanvas();
        this.renderPlayerViewport();
        this.setStatus(`已将 [${selectedFrame.name}] 的偏移量归零 (0, 0)`);
      });
    }

    // 3. 洋葱皮开关联动
    if (this.onionSkinToggle) {
      this.onionSkinToggle.addEventListener('change', (e) => {
        state.setPlayerState({ onionSkin: e.target.checked });
        this.renderPlayerViewport();
        this.setStatus(e.target.checked ? '已开启洋葱皮残影 (前帧淡红，后帧淡蓝)' : '已关闭洋葱皮残影');
      });
    }

    // 4. XY 对齐参考标线与刻度开关联动
    if (this.groundLineToggle) {
      this.groundLineToggle.addEventListener('change', (e) => {
        state.setPlayerState({ showGround: e.target.checked });
        this.renderPlayerViewport();
        this.setStatus(e.target.checked ? '已开启 XY 对齐参考标线、标尺刻度与准星标记' : '已关闭 XY 对齐标线');
      });
    }

    // 4.2 基准帧幽灵透光台对比 (Ghost Overlay) 开关联动
    if (this.ghostOverlayToggle) {
      this.ghostOverlayToggle.addEventListener('change', (e) => {
        state.setPlayerState({ ghostOverlay: e.target.checked });
        this.renderPlayerViewport();
        this.setStatus(e.target.checked ? '已开启基准帧幽灵透光台对比 (第1帧青蓝半透明剪影垫底)' : '已关闭基准透光对比');
      });
    }

    // 4.3 智能身量推荐按钮点击直接应用
    if (this.btnSuggestScale) {
      this.btnSuggestScale.addEventListener('click', () => {
        const suggestedVal = parseFloat(this.btnSuggestScale.dataset.suggestedScale);
        if (!isNaN(suggestedVal) && suggestedVal > 0) {
          handleScaleChange(Math.round(suggestedVal * 100));
          this.setStatus(`已应用智能推荐身量比例: ${Math.round(suggestedVal * 100)}%`);
          this.btnSuggestScale.style.display = 'none';
        }
      });
    }

    // 5. 帧视口 (playerCanvas) 红色十字准星拖拽与角色画面直接拖拽调整偏移交互
    this.bindPlayerCanvasPivotDrag();
  }

  /**
   * 一键智能自动身高校准 (排除高空白色刀光等干扰，以第1帧为基准自动对齐人物身量比例)
   * @param {boolean} all - true: 校准全部帧; false: 仅校准当前选中帧
   */
  handleAutoScale(all = true) {
    const sourceImage = state.get('sourceImage');
    const frames = state.get('frames') || [];
    if (!sourceImage || frames.length === 0) {
      this.setStatus('请先导入图像并添加或识别动作选框');
      this.showToast('请先导入图像并添加动作选框', 'warning');
      return;
    }

    if (all) {
      if (frames.length < 2) {
        this.setStatus('帧数量少于 2 帧，无需执行跨帧身高校准');
        return;
      }

      this.setStatus('正在智能计算并校准全部动作帧人物身量比例...');
      const result = frameAlignment.autoNormalizeAllScales(frames, sourceImage, 0);

      if (result.normalizedCount > 0) {
        // 同步更新每帧的 scale 属性到 state
        frames.forEach(f => {
          state.updateFrame(f.id, { scale: f.scale || 1.0 });
        });

        // 更新当前选中帧的 UI 控件
        const curFrame = state.getSelectedFrame();
        if (curFrame) {
          this.updateOffsetUI(curFrame);
        }

        this.renderMainCanvas();
        this.renderPlayerViewport();
        this.renderFrameList();

        const msg = `🎯 身高校准完毕: 以第1帧 (${result.refHeight}px) 为基准，已成功自动对齐全部 ${result.normalizedCount} 帧的角色身量！`;
        this.setStatus(msg);
        this.showToast(msg, 'success');
      } else {
        this.setStatus('身高校准失败: 未能从帧画面中提取到有效角色躯干高度');
        this.showToast('未能提取到有效角色高度，请确认画面内容', 'warning');
      }
    } else {
      // 仅校准当前选中帧
      const curFrame = state.getSelectedFrame();
      if (!curFrame) {
        this.setStatus('请先在动作帧列表中选择一个目标帧');
        this.showToast('请先选择一个动作帧', 'warning');
        return;
      }

      const refFrame = frames[0];
      if (curFrame.id === refFrame.id) {
        curFrame.scale = 1.0;
        state.updateFrame(curFrame.id, { scale: 1.0 });
        this.updateOffsetUI(curFrame);
        this.renderMainCanvas();
        this.renderPlayerViewport();
        this.renderFrameList();
        this.setStatus('当前帧为第1帧基准帧，缩放比例已设为 100%');
        return;
      }

      const res = frameAlignment.autoNormalizeFrameScale(curFrame, refFrame, sourceImage);
      if (res.success) {
        state.updateFrame(curFrame.id, { scale: res.scale });
        this.updateOffsetUI(curFrame);
        this.renderMainCanvas();
        this.renderPlayerViewport();
        this.renderFrameList();

        const percent = Math.round(res.scale * 100);
        const msg = `📏 当前帧 [${curFrame.name}] 已校准: 躯干高度 ${res.targetHeight}px -> 基准 ${res.refHeight}px (比例设为 ${percent}%)`;
        this.setStatus(msg);
        this.showToast(`📏 成功校准当前帧人物比例为 ${percent}%`, 'success');
      } else {
        this.setStatus('当前帧身高校准失败: 未能识别有效躯干高度');
        this.showToast('未能识别有效躯干高度', 'warning');
      }
    }
  }

  /**
   * 自动扫描角色真实前景像素最低点（脚底）、左脚接地位置或角色躯干水平重心（排除白色刀光干扰），
   * 自动补偿 offset.x / offset.y 使各帧角色精准对齐
   * @param {boolean} alignAll - true: 一键对齐全部动作帧; false: 仅对齐当前选中帧
   * @param {{ alignX?: boolean, alignY?: boolean, xMode?: 'left-foot'|'body-center'|'right-foot' }} [opts={ alignX: false, alignY: true }]
   */
  handleAutoAlignGround(alignAll = false, opts = {}) {
    const sourceImage = state.get('sourceImage');
    const frames = state.get('frames') || [];
    if (!sourceImage || frames.length === 0) {
      this.setStatus('请先导入图像并生成动作选框');
      return;
    }

    const alignX = opts.alignX === true;
    const alignY = opts.alignY !== false;
    const xMode = opts.xMode || 'body-center';

    const targets = alignAll ? frames : [state.getSelectedFrame()].filter(Boolean);
    if (targets.length === 0) {
      this.setStatus('请先选择一个动作帧');
      return;
    }

    let sourceImageData = null;
    try {
      sourceImageData = ImageProcessor.getImageDataFromImage(sourceImage);
    } catch (err) {
      console.warn('[SpriteAnimator] 获取原图 ImageData 失败:', err);
    }

    const getFrameBounds = (frame) => {
      if (!frame || !frame.rect) return null;
      let b = null;
      if (frame.maskCanvas && typeof frame.maskCanvas.getContext === 'function') {
        try {
          const mctx = frame.maskCanvas.getContext('2d');
          const mData = mctx.getImageData(0, 0, frame.rect.w, frame.rect.h);
          b = ImageProcessor.getRectContentBounds(
            mData,
            { x: 0, y: 0, w: frame.rect.w, h: frame.rect.h },
            { alphaThreshold: 15, tolerance: 25 }
          );
        } catch (e) {
          b = null;
        }
      }
      if (!b && sourceImageData) {
        b = ImageProcessor.getRectContentBounds(sourceImageData, frame.rect, {
          alphaThreshold: 15,
          tolerance: 25
        });
      }
      return (b && !b.empty) ? b : null;
    };

    const boundsMap = new Map();
    for (const f of frames) {
      const b = getFrameBounds(f);
      if (b) boundsMap.set(f.id, b);
    }

    // 计算 X 轴对齐的目标参考基准位置 referenceX：
    // - 全部对齐时：取所有帧左脚(或重心)在各自选框内的平均位置，使所有帧就地对齐，绝不会把人物整体推向右侧导致刀光出画框！
    // - 单帧对齐时：若存在前一帧，直接对齐到前一帧左脚(或重心)所在的实际水平位置！
    let referenceX = undefined;
    if (alignX) {
      if (alignAll) {
        let sumX = 0;
        let cnt = 0;
        for (const f of targets) {
          const b = boundsMap.get(f.id);
          if (!b) continue;
          const val = (xMode === 'left-foot') ? b.leftFootX : b.bodyCenterX;
          if (typeof val === 'number') {
            sumX += val;
            cnt++;
          }
        }
        if (cnt > 0) referenceX = sumX / cnt;
      } else if (targets.length === 1) {
        const curFrame = targets[0];
        const curIdx = frames.findIndex(f => f.id === curFrame.id);
        if (curIdx > 0) {
          const prevFrame = frames[curIdx - 1];
          const prevB = boundsMap.get(prevFrame.id);
          if (prevB) {
            const prevLocalX = (xMode === 'left-foot') ? prevB.leftFootX : prevB.bodyCenterX;
            const prevOx = prevFrame.offset?.x || 0;
            referenceX = prevLocalX + prevOx;
          }
        }
      }
    }

    let alignedCount = 0;
    for (const frame of targets) {
      const bounds = boundsMap.get(frame.id);
      if (bounds) {
        frameAlignment.autoAlignFrameToGround(frame, bounds, {
          alignX,
          alignY,
          xMode,
          referenceX
        });
        alignedCount++;
      }
    }

    // 触发状态与界面刷新
    state.setState({ frames: [...frames] });
    const selectedFrame = state.getSelectedFrame();
    this.updateOffsetUI(selectedFrame);
    this.renderMainCanvas();
    this.renderPlayerViewport();

    if (alignAll) {
      const modeDesc = alignX
        ? (xMode === 'left-foot' ? '左脚基准与地面线' : '角色中心与地面线')
        : 'Y 轴脚底地面线';
      const msg = `已完成全部 ${alignedCount} 帧 [${modeDesc}] 自动对齐！(拖拽预览画面仅平移位置，绝不改变大小)`;
      this.setStatus(msg);
      this.showToast(`全部 ${alignedCount} 帧已按 [${modeDesc}] 原位对齐，刀光完整保留在画框内！`, 'success');
    } else if (selectedFrame) {
      this.setStatus(`已将 [${selectedFrame.name}] 对齐至基准位置 (X偏移 = ${selectedFrame.offset?.x || 0}px, Y偏移 = ${selectedFrame.offset?.y || 0}px)`);
    }
  }

  /**
   * 绑定帧视口 (playerCanvas) 交互：
   * 1. 鼠标在红色十字准星 10px 内按下拖拽：调整锚点 (Pivot)
   * 2. 鼠标在画面其他区域按下拖拽：直接上下左右拖动角色微调当前帧偏移 (Offset X/Y)
   */
  bindPlayerCanvasPivotDrag() {
    if (!this.playerCanvas) return;

    // 鼠标按下：检测命中准星或进入角色位置直接拖拽模式
    this.playerCanvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const selectedFrame = state.getSelectedFrame();
      const playerState = state.get('playerState') || {};
      if (!selectedFrame) return;

      const mousePos = this.getPlayerCanvasMousePos(e);
      const crosshairPos = this.getPlayerCanvasCrosshairPos(selectedFrame);

      if (playerState.showPivot !== false && this.isNearCrosshair(mousePos, crosshairPos, 10)) {
        this.isDraggingPivot = true;
        this.draggedFrame = selectedFrame;
        this.playerCanvas.style.cursor = 'crosshair';
        e.preventDefault();
        return;
      }

      // 在播放器画面其他区域按下：直接拖拽角色调节当前帧 X / Y 偏移量
      if (this.player && this.player.isPlaying) {
        this.player.pause();
      }
      this.isDraggingOffset = true;
      this.draggedFrame = selectedFrame;
      this.offsetDragStartMouse = mousePos;
      this.offsetDragInitial = {
        x: selectedFrame.offset?.x || 0,
        y: selectedFrame.offset?.y || 0
      };
      this.playerCanvas.style.cursor = 'grabbing';
      e.preventDefault();
    });

    // 鼠标移动：悬停显示光标，拖拽实时更新锚点或偏移并重绘
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

      if (this.isDraggingOffset && this.draggedFrame && this.offsetDragStartMouse && this.offsetDragInitial) {
        const selectedFrame = this.draggedFrame;
        const scale = frameAlignment.lastRenderScale || 1.0;
        const dx = Math.round((mousePos.x - this.offsetDragStartMouse.x) / scale);
        const dy = Math.round((mousePos.y - this.offsetDragStartMouse.y) / scale);
        const newX = this.offsetDragInitial.x + dx;
        const newY = this.offsetDragInitial.y + dy;

        selectedFrame.offset = { x: newX, y: newY };
        state.updateFrame(selectedFrame.id, { offset: { x: newX, y: newY } });

        this.updateOffsetUI(selectedFrame);
        this.renderPlayerViewport();
        this.renderMainCanvas();
        this.setStatus(`拖拽调节 [${selectedFrame.name}] 位置偏移: X = ${newX}px, Y = ${newY}px (向上拖为腾空跳跃，向下拖贴合地面)`);
        return;
      }

      // 悬停检测：当鼠标悬停在准星附近（命中半径 10px）时，光标显示为 crosshair，否则显示 grab 可抓取
      const selectedFrame = state.getSelectedFrame();
      const playerState = state.get('playerState') || {};
      if (selectedFrame) {
        if (playerState.showPivot !== false) {
          const crosshairPos = this.getPlayerCanvasCrosshairPos(selectedFrame);
          if (this.isNearCrosshair(mousePos, crosshairPos, 10)) {
            this.playerCanvas.style.cursor = 'crosshair';
            return;
          }
        }
        this.playerCanvas.style.cursor = 'grab';
        return;
      }
      this.playerCanvas.style.cursor = '';
    });

    // 鼠标松开：结束拖拽
    this.playerCanvas.addEventListener('mouseup', (e) => {
      if (this.isDraggingPivot || this.isDraggingOffset) {
        const wasPivot = this.isDraggingPivot;
        this.isDraggingPivot = false;
        this.isDraggingOffset = false;
        this.draggedFrame = null;
        this.pivotDragOrigin = null;
        this.offsetDragStartMouse = null;
        this.offsetDragInitial = null;

        const selectedFrame = state.getSelectedFrame();
        if (selectedFrame) {
          const mousePos = this.getPlayerCanvasMousePos(e);
          const crosshairPos = this.getPlayerCanvasCrosshairPos(selectedFrame);
          this.playerCanvas.style.cursor = this.isNearCrosshair(mousePos, crosshairPos, 10) ? 'crosshair' : 'grab';
        } else {
          this.playerCanvas.style.cursor = '';
        }
        this.setStatus(wasPivot ? '已完成帧锚点拖拽设置' : '已完成当前帧角色偏移拖拽微调');
      }
    });

    // 鼠标离开：若非拖拽中则重置光标
    this.playerCanvas.addEventListener('mouseleave', () => {
      if (!this.isDraggingPivot && !this.isDraggingOffset) {
        this.playerCanvas.style.cursor = '';
      }
    });

    // 全局 mouseup 保护，防止拖拽移出画布后松开按键状态卡死
    if (typeof window !== 'undefined') {
      window.addEventListener('mouseup', () => {
        if (this.isDraggingPivot || this.isDraggingOffset) {
          const wasPivot = this.isDraggingPivot;
          this.isDraggingPivot = false;
          this.isDraggingOffset = false;
          this.draggedFrame = null;
          this.pivotDragOrigin = null;
          this.offsetDragStartMouse = null;
          this.offsetDragInitial = null;
          if (this.playerCanvas) {
            this.playerCanvas.style.cursor = '';
          }
          this.setStatus(wasPivot ? '已完成帧锚点拖拽设置' : '已完成当前帧角色偏移拖拽微调');
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
        expandForOffset: true,
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
        expandForOffset: true,
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
   * 从本地文件加载大图或 GIF 动图并更新状态与界面
   * @param {File} file 
   */
  async loadSourceImageFile(file) {
    if (!file) return;

    // 智能识别 GIF 动图并自动分流至 GIF 拆分模块
    if (file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')) {
      await this.handleGifFile(file);
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.setStatus('请选择有效的图像文件 (PNG / JPG / WebP / GIF)');
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
   * 处理 GIF 动图文件：调用 GifDecoder 解析各帧并自动载入工作台开播
   * @param {File} file 
   */
  async handleGifFile(file) {
    if (!file) return;

    try {
      this.setStatus(`正在解析并拆分 GIF 动图: ${file.name}...`);
      this.showToast(`正在无损拆解 GIF 动图: ${file.name}...`, 'info');

      // 1. 调用双引擎 GIF 解码核心
      const decodedGif = await GifDecoder.decode(file);

      this.currentDecodedGif = decodedGif;
      this.currentGifFile = file;

      // 2. 直接自动生成规整精灵大图并载入工作台开播！
      await this.loadGifToWorkspace(decodedGif, file.name);

      // 3. 同时唤起弹窗呈现拆解详情（尺寸、帧数、帧率）与一键下载 ZIP 包操作
      this.openGifSplitModal(decodedGif, file.name);

      this.setStatus(`GIF 动图拆解成功: 共提取 ${decodedGif.frameCount} 个动作序列帧 (${decodedGif.width} × ${decodedGif.height} px, ${decodedGif.avgFps} FPS) 并已开播！`);
    } catch (err) {
      console.error('[SpriteAnimator] 解析 GIF 动图失败:', err);
      this.setStatus(`解析 GIF 失败: ${err.message}`);
      this.showToast(`解析 GIF 失败: ${err.message}`, 'error');
    }
  }

  /**
   * 打开 GIF 拆分确认模态框并启动动态循环预览
   * @param {Object} decodedGif 
   * @param {string} filename 
   */
  openGifSplitModal(decodedGif, filename) {
    if (!this.modalGifSplit) return;

    if (this.gifMetaFilename) this.gifMetaFilename.textContent = filename;
    if (this.gifMetaDim) this.gifMetaDim.textContent = `${decodedGif.width} × ${decodedGif.height} px`;
    if (this.gifMetaFrames) this.gifMetaFrames.textContent = `${decodedGif.frameCount} 帧`;
    if (this.gifMetaFps) this.gifMetaFps.textContent = `${decodedGif.avgFps} FPS (总时长 ${decodedGif.durationMs}ms)`;

    // 启动弹窗内的动态帧循环预览
    this.startGifModalPreview(decodedGif);

    this.modalGifSplit.classList.add('active');
  }

  /**
   * 关闭 GIF 拆分确认模态框
   */
  closeGifSplitModal() {
    this.stopGifModalPreview();
    if (this.modalGifSplit) {
      this.modalGifSplit.classList.remove('active');
    }
  }

  /**
   * 启动弹窗内部的动态循环帧预览
   * @param {Object} decodedGif 
   */
  startGifModalPreview(decodedGif) {
    this.stopGifModalPreview();
    if (!this.gifPreviewCanvas || !decodedGif.frames || decodedGif.frames.length === 0) return;

    const ctx = this.gifPreviewCanvas.getContext('2d');
    if (!ctx) return;

    this.gifPreviewCanvas.width = decodedGif.width;
    this.gifPreviewCanvas.height = decodedGif.height;

    let frameIdx = 0;
    const playNext = () => {
      const f = decodedGif.frames[frameIdx];
      if (f && f.canvas) {
        ctx.clearRect(0, 0, decodedGif.width, decodedGif.height);
        ctx.drawImage(f.canvas, 0, 0);
      }
      const delay = Math.max(30, f ? f.delay : 100);
      frameIdx = (frameIdx + 1) % decodedGif.frames.length;
      this.gifModalTimer = setTimeout(playNext, delay);
    };

    playNext();
  }

  /**
   * 停止弹窗内部的动态预览定时器
   */
  stopGifModalPreview() {
    if (this.gifModalTimer) {
      clearTimeout(this.gifModalTimer);
      this.gifModalTimer = null;
    }
  }

  /**
   * 将拆分好的 GIF 自动拼装为 Sprite Sheet 并载入主工作台
   * @param {Object} decodedGif 
   * @param {string} filename 
   */
  async loadGifToWorkspace(decodedGif, filename = 'animation.gif') {
    if (!decodedGif) return;

    return new Promise((resolve) => {
      try {
        this.setStatus('正在自动生成规整精灵表并载入工作台...');

        // 1. 规整网格排版大图与选框元数据
        const assembled = GifDecoder.assembleSpriteSheet(decodedGif, {
          padding: 8,
          namePrefix: '帧'
        });

        // 2. 将离屏 Canvas 转为 Image 对象作为 sourceImage
        const sheetCanvas = assembled.sheetCanvas;
        let imgSrc = '';
        if (sheetCanvas && typeof sheetCanvas.toDataURL === 'function') {
          imgSrc = sheetCanvas.toDataURL('image/png');
        }

        const sheetImg = new Image();
        sheetImg.onload = () => {
          // 隐藏空状态大图标
          if (this.emptyPlaceholder) {
            this.emptyPlaceholder.style.display = 'none';
          }

          // 更新全局状态：载入大图、帧列表、同步帧率
          const fps = Math.min(60, Math.max(1, Math.round(decodedGif.avgFps || 12)));

          state.setState({
            sourceImage: sheetImg,
            imageMetadata: {
              name: `${filename.replace(/\.[^/.]+$/, '')}_sheet.png`,
              width: sheetImg.naturalWidth,
              height: sheetImg.naturalHeight,
              naturalWidth: sheetImg.naturalWidth,
              naturalHeight: sheetImg.naturalHeight
            },
            frames: assembled.frames,
            selectedFrameId: assembled.frames[0]?.id || null,
            playerState: {
              ...state.get('playerState'),
              fps,
              isPlaying: true // 自动开播
            }
          });

          // 更新顶部 Badges
          if (this.imageNameBadge) this.imageNameBadge.textContent = `${filename} (${decodedGif.frameCount}帧)`;
          if (this.imageDimBadge) this.imageDimBadge.textContent = `${sheetImg.naturalWidth} × ${sheetImg.naturalHeight} px`;

          if (this.fpsSlider) this.fpsSlider.value = fps;
          if (this.fpsDisplay) this.fpsDisplay.textContent = `${fps} FPS`;

          // 重新自适应视口居中
          if (this.canvasWorkspace) {
            this.canvasWorkspace.fitToView();
          }

          // 启动播放器
          if (this.player) {
            this.player.setSourceImage(sheetImg);
            this.player.setFPS(fps);
            this.player.setFrames(assembled.frames);
            this.player.play();
          }

          this.renderFrameList();
          this.renderPlayerViewport();
          this.renderMainCanvas();

          const successMsg = `🎉 成功拆解 GIF（共 ${assembled.frames.length} 帧，${fps} FPS），已自动规整排版并载入播放！`;
          this.setStatus(successMsg);
          this.showToast(`🎉 成功拆解 ${assembled.frames.length} 帧并载入播放！`, 'success', {
            label: '📦 导出序列帧包 (.zip)',
            onClick: () => this.downloadGifFramesZip(decodedGif, filename)
          });
          resolve(true);
        };

        sheetImg.onerror = (e) => {
          console.error('[SpriteAnimator] 大图生成失败:', e);
          this.setStatus('加载拆解精灵大图失败');
          resolve(false);
        };

        sheetImg.src = imgSrc;
      } catch (err) {
        console.error('[SpriteAnimator] 载入 GIF 到工作台失败:', err);
        this.setStatus(`载入工作台失败: ${err.message}`);
        resolve(false);
      }
    });
  }

  /**
   * 将拆分好的 GIF 帧直接打包为透明 PNG 的 ZIP 文件并下载
   * @param {Object} decodedGif 
   * @param {string} filename 
   */
  async downloadGifFramesZip(decodedGif, filename = 'animation.gif') {
    if (!decodedGif) return;

    try {
      this.setStatus('正在打包透明 PNG 序列帧...');
      const baseName = filename.replace(/\.[^/.]+$/, '');
      const zipData = await GifDecoder.splitFramesToZip(decodedGif, {
        namePrefix: 'frame'
      });

      // 触发下载
      Exporter.downloadBlob(zipData.blob, `${baseName}_frames.zip`);

      this.closeGifSplitModal();
      this.setStatus(`成功导出 ${zipData.count} 帧透明 PNG 序列帧包: ${baseName}_frames.zip`);
      this.showToast(`📦 成功打包下载 ${zipData.count} 帧透明 PNG 序列帧包！`, 'success');
    } catch (err) {
      console.error('[SpriteAnimator] 打包序列帧失败:', err);
      this.setStatus(`导出序列帧失败: ${err.message}`);
    }
  }

  /**
   * 绑定 GIF 拆分模态框的用户交互事件
   */
  bindGifSplitModal() {
    if (!this.modalGifSplit) return;

    if (this.btnCloseGifModal) {
      this.btnCloseGifModal.addEventListener('click', () => this.closeGifSplitModal());
    }
    if (this.btnCancelGif) {
      this.btnCancelGif.addEventListener('click', () => this.closeGifSplitModal());
    }

    // 点击遮罩外部关闭
    this.modalGifSplit.addEventListener('click', (e) => {
      if (e.target === this.modalGifSplit) {
        this.closeGifSplitModal();
      }
    });

    // 点击“载入工作台编辑 / 进入工作台”
    if (this.btnGifToWorkspace) {
      this.btnGifToWorkspace.addEventListener('click', () => {
        if (this.currentDecodedGif) {
          const fn = this.currentGifFile ? this.currentGifFile.name : 'animation.gif';
          this.loadGifToWorkspace(this.currentDecodedGif, fn);
        }
        this.closeGifSplitModal();
      });
    }

    // 点击“下载序列帧包 (.zip)”
    if (this.btnGifDownloadZip) {
      this.btnGifDownloadZip.addEventListener('click', () => {
        if (this.currentDecodedGif) {
          const fn = this.currentGifFile ? this.currentGifFile.name : 'animation.gif';
          this.downloadGifFramesZip(this.currentDecodedGif, fn);
        }
      });
    }
  }

  /**
   * 自动识别动作角色外接矩形
   */
  handleAutoDetectFrames() {
    const img = state.get('sourceImage');
    if (!img) {
      this.setStatus('请先导入精灵大图再执行识别');
      this.showToast('请先导入精灵大图，再执行自动识别选框', 'warning', {
        label: '📂 立即选择图片',
        onClick: () => this.fileInput?.click()
      });
      return;
    }

    try {
      this.setStatus('正在分析连通域并提取独立动作包围盒...');
      const imageData = ImageProcessor.getImageDataFromImage(img);

      // minSize = 8 过滤噪点，mergeDistance = 4 自动连接相邻部件
      const boxes = ImageProcessor.detectBoundingBoxes(imageData, 8, 4);

      if (boxes.length === 0) {
        this.setStatus('未检测到独立选框。若图像包含黑底/白底/绿幕，请点击「⊞ 网格等分切片」或「背景透明化」');
        this.showToast('未检测到独立透明选框，建议点击「⊞ 网格等分切片」进行规律切片', 'warning');
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
          this.showToast('请先导入精灵大图，再进行背景透明化', 'warning', {
            label: '📂 立即选择图片',
            onClick: () => this.fileInput?.click()
          });
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
          this.setStatus('暂无动作帧，请先导入图片并添加或切片选框');
          this.showToast('暂无动作帧，请先导入图片并添加或切片选框', 'warning', {
            label: '📂 立即选择图片',
            onClick: () => this.fileInput?.click()
          });
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
          this.showToast('请先导入精灵大图，再使用网格切片功能', 'warning', {
            label: '📂 立即选择图片',
            onClick: () => this.fileInput?.click()
          });
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
          this.gridPresetBtns.forEach(b => {
            b.classList.remove('btn-primary');
            b.classList.add('btn-secondary');
          });
          btn.classList.remove('btn-secondary');
          btn.classList.add('btn-primary');
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
        const autoAlignY = this.gridAutoAlignY ? this.gridAutoAlignY.checked : true;
        let imageData = null;
        if (filterEmpty || autoAlignY) {
          try {
            imageData = ImageProcessor.getImageDataFromImage(sourceImage);
          } catch (e) {
            console.warn('提取整图 ImageData 进行空白过滤/自动对齐失败:', e);
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

            const frameObj = {
              id: 'frame_' + Date.now() + '_' + count,
              name: `帧 ${count}`,
              rect,
              offset: { x: 0, y: 0 },
              pivot: { x: 0.5, y: 1.0 }, // 默认脚底中心对齐
              maskCanvas: null
            };

            // 若勾选了自动按角色真实脚底对齐 Y 轴地面线
            if (autoAlignY && imageData) {
              const bounds = ImageProcessor.getRectContentBounds(imageData, rect, {
                alphaThreshold: 15,
                tolerance: 25
              });
              if (bounds && !bounds.empty) {
                frameAlignment.autoAlignFrameToGround(frameObj, bounds, { alignX: false });
              }
            }

            newFrames.push(frameObj);
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
        const alignMsg = autoAlignY ? '，并已自动对齐全部帧 Y 轴脚底地面线' : '';
        this.setStatus(`均等网格切片完成: 共生成 ${newFrames.length} 帧${filterMsg}${alignMsg}，单帧规格 ${cellW} × ${cellH} px`);
      });
    }
  }

  /**
   * 绑定智能横纵吸附对齐按钮事件
   */
  bindSnapToggle() {
    const updateButtonUI = (enabled) => {
      if (!this.btnToggleSnap) return;
      if (enabled) {
        this.btnToggleSnap.classList.add('active');
        this.btnToggleSnap.textContent = '🧲 智能吸附: 开';
        this.btnToggleSnap.title = '智能吸附已开启 (快捷键 S 切换，拖动时按住 Alt 临时自由移动)';
      } else {
        this.btnToggleSnap.classList.remove('active');
        this.btnToggleSnap.textContent = '🧲 智能吸附: 关';
        this.btnToggleSnap.title = '智能吸附已关闭 (快捷键 S 切换，拖动时按住 Alt 临时吸附)';
      }
    };

    if (this.btnToggleSnap) {
      this.btnToggleSnap.addEventListener('click', () => {
        const nextState = state.toggleSnapEnabled();
        this.setStatus(nextState ? '已开启选框横纵对齐吸附 (对齐边缘、中心与相邻贴靠)' : '已关闭选框智能吸附 (自由像素移动)');
        this.showToast(nextState ? '🧲 已开启智能对齐吸附' : '已关闭吸附 (自由像素移动)', 'info');
      });
    }

    state.subscribe('snapEnabled', (enabled) => {
      updateButtonUI(enabled);
    });

    updateButtonUI(state.get('snapEnabled'));
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
      if (this.ghostOverlayToggle) {
        this.ghostOverlayToggle.checked = Boolean(playerState.ghostOverlay);
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
   * 渲染右侧动作帧列表缩略图序列 (支持增量 Diff 局部更新与全量重绘)
   * @param {boolean} [forceFull=false] 是否强制全量重构 DOM 结构
   */
  renderFrameList(forceFull = false) {
    if (!this.frameList) return;

    const frames = state.get('frames') || [];
    const selectedId = state.get('selectedFrameId');
    const sourceImage = state.get('sourceImage');

    if (this.frameCountBadge) {
      this.frameCountBadge.textContent = frames.length;
    }

    // 检查现有 DOM 节点是否与 frames 匹配
    const existingItems = Array.from(this.frameList.querySelectorAll('.frame-item'));
    const isSameStructure = !forceFull && existingItems.length === frames.length &&
      existingItems.every((el, i) => el.dataset.id === frames[i].id);

    if (isSameStructure) {
      // 结构相同，仅增量更新状态与缩略图，避免破坏焦点或造成滚动卡顿
      frames.forEach((frame, idx) => {
        const itemEl = existingItems[idx];
        itemEl.classList.toggle('selected', frame.id === selectedId);
        this.updateSingleThumbnail(frame.id);
      });
      this.updateSelectedFrameUI(selectedId);
      if (this.player && this.player.isPlaying) {
        this.highlightPlayingFrame(this.player.getCurrentFrameIndex());
      }
      return;
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
      thumbCanvas.width = 96;
      thumbCanvas.height = 96;
      const tctx = thumbCanvas.getContext('2d');

      if (tctx && frame.rect.w > 0 && frame.rect.h > 0) {
        tctx.imageSmoothingEnabled = false;
        const s = (typeof frame.scale === 'number' && !isNaN(frame.scale) && frame.scale > 0) ? frame.scale : 1.0;
        const baseScale = Math.min(88 / frame.rect.w, 88 / frame.rect.h);
        const effectiveScale = baseScale * s;
        const dw = frame.rect.w * effectiveScale;
        const dh = frame.rect.h * effectiveScale;
        const dx = (96 - dw) / 2;
        const dy = (96 - dh) / 2;

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

      // 若当前帧进行了缩放，在缩略图左下角显示醒目的缩放比例徽章
      if (typeof frame.scale === 'number' && Math.round(frame.scale * 100) !== 100) {
        const scalePill = document.createElement('div');
        scalePill.className = 'frame-scale-pill';
        scalePill.style.cssText = 'position: absolute; bottom: 4px; left: 4px; font-size: 9px; font-weight: 700; background: rgba(58, 134, 255, 0.9); color: #fff; padding: 1px 4px; border-radius: 3px; font-family: var(--font-mono); pointer-events: none; z-index: 2;';
        scalePill.textContent = `${Math.round(frame.scale * 100)}%`;
        thumbBox.appendChild(scalePill);
      }

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
    this.renderScalePreviewViewport();
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

    const scale = (frame && typeof frame.scale === 'number') ? frame.scale : 1.0;
    const percent = Math.round(scale * 100);
    if (this.frameScaleSlider) {
      this.frameScaleSlider.value = percent;
    }
    if (this.frameScaleInput) {
      this.frameScaleInput.value = percent;
    }
    if (this.frameScaleDisplay) {
      this.frameScaleDisplay.textContent = `${percent}%`;
    }

    // 智能更新当前帧身量建议徽章与实时微缩对比视口
    this.updateScaleSuggestionUI(frame);
    this.renderScalePreviewViewport();
  }

  /**
   * 智能更新当前帧身量缩放建议徽章 (Smart Suggestion Badge)
   * 若检测到当前帧人物明显偏大或偏小，显示醒目的建议按钮，用户可一键精准采纳
   * @param {Object|null} frame 
   */
  updateScaleSuggestionUI(frame) {
    if (!this.btnSuggestScale) return;
    if (!frame) {
      this.btnSuggestScale.style.display = 'none';
      return;
    }

    const frames = state.get('frames') || [];
    const sourceImage = state.get('sourceImage');
    if (!sourceImage || frames.length < 2 || frame.id === frames[0].id) {
      this.btnSuggestScale.style.display = 'none';
      return;
    }

    try {
      const refFrame = frames[0];
      const res = frameAlignment.autoNormalizeFrameScale(frame, refFrame, sourceImage);
      if (res.success && typeof res.scale === 'number') {
        const curScale = (typeof frame.scale === 'number') ? frame.scale : 1.0;
        const curPercent = Math.round(curScale * 100);
        const suggestedPercent = Math.round(res.scale * 100);

        // 如果建议比例非 100% 且与当前设置有明显差异 (>= 3%)
        if (suggestedPercent !== 100 && Math.abs(suggestedPercent - curPercent) >= 3) {
          this.btnSuggestScale.style.display = 'inline-block';
          this.btnSuggestScale.textContent = `💡 建议 ${suggestedPercent}%`;
          this.btnSuggestScale.title = `智能检测到当前帧与基准帧身量偏差，点击一键应用 ${suggestedPercent}%`;
          this.btnSuggestScale.dataset.suggestedScale = res.scale;
          return;
        }
      }
    } catch (_) {}

    this.btnSuggestScale.style.display = 'none';
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

    const effectiveZoom = playerState.viewportScaleMode || playerState.zoom || 'auto';
    frameAlignment.renderAlignmentStage(
      this.playerCanvas,
      currentFrame,
      frames,
      currentIndex,
      sourceImage,
      {
        ...playerState,
        zoom: effectiveZoom
      }
    );
  }

  /**
   * 渲染步骤 3 实时身量比对微缩视口 (Scale Preview Viewport)
   * 包含当前帧实时缩放渲染、底层第 1 帧青蓝色半透明幽灵剪影、以及脚底对齐基准线
   */
  renderScalePreviewViewport() {
    if (!this.scaleCompareCanvas) return;
    const ctx = this.scaleCompareCanvas.getContext('2d');
    if (!ctx) return;

    const w = this.scaleCompareCanvas.width || 140;
    const h = this.scaleCompareCanvas.height || 140;
    ctx.clearRect(0, 0, w, h);

    const frames = state.get('frames') || [];
    const selectedId = state.get('selectedFrameId');
    const sourceImage = state.get('sourceImage');
    const refFrame = frames.length > 0 ? frames[0] : null;

    let selectedFrame = frames.find(f => f.id === selectedId);
    if (!selectedFrame && frames.length > 0) {
      selectedFrame = frames[0];
    }

    // 更新指示标签
    if (this.scalePreviewCurrentTag) {
      if (selectedFrame) {
        const sVal = (typeof selectedFrame.scale === 'number') ? selectedFrame.scale : 1.0;
        this.scalePreviewCurrentTag.textContent = `${selectedFrame.name || '当前'}: ${Math.round(sVal * 100)}%`;
      } else {
        this.scalePreviewCurrentTag.textContent = '当前: 无';
      }
    }

    if (this.scalePreviewGhostTag) {
      if (refFrame && selectedFrame && refFrame.id !== selectedFrame.id) {
        this.scalePreviewGhostTag.style.display = 'block';
        this.scalePreviewGhostTag.textContent = `基准: ${refFrame.name || '帧 1'}`;
      } else {
        this.scalePreviewGhostTag.style.display = 'none';
      }
    }

    if (!selectedFrame || (!selectedFrame.maskCanvas && !sourceImage) || !selectedFrame.rect) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('暂无切片帧', w / 2, h / 2);
      return;
    }

    const groundY = Math.round(h * 0.85);
    const centerX = Math.round(w / 2);

    // 绘制地面参考线 (细蓝实线)
    ctx.save();
    ctx.strokeStyle = '#3a86ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(8, groundY);
    ctx.lineTo(w - 8, groundY);
    ctx.stroke();

    // 绘制微型中心点
    ctx.fillStyle = '#06d6a0';
    ctx.beginPath();
    ctx.arc(centerX, groundY, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 计算缩放比例让角色完整容纳在视口中
    let maxContentH = selectedFrame.rect ? selectedFrame.rect.h : 64;
    let maxContentW = selectedFrame.rect ? selectedFrame.rect.w : 64;
    if (refFrame && refFrame.rect) {
      if (refFrame.rect.h > maxContentH) maxContentH = refFrame.rect.h;
      if (refFrame.rect.w > maxContentW) maxContentW = refFrame.rect.w;
    }

    const availH = h * 0.74;
    const availW = w * 0.82;
    const fitScale = Math.min(1.0, availH / Math.max(1, maxContentH), availW / Math.max(1, maxContentW));

    // 1. 绘制底层幽灵基准帧 (第 1 帧青蓝色半透明剪影)
    if (refFrame && refFrame.id !== selectedFrame.id && refFrame.rect) {
      ctx.save();
      ctx.translate(centerX, groundY);
      ctx.scale(fitScale, fitScale);
      frameAlignment.renderFrameToContext(ctx, refFrame, sourceImage, 0, 0, {
        alpha: 0.35,
        tint: '#00e5ff'
      });
      ctx.restore();
    }

    // 2. 绘制当前帧 (应用其自身 scale)
    ctx.save();
    ctx.translate(centerX, groundY);
    ctx.scale(fitScale, fitScale);
    frameAlignment.renderFrameToContext(ctx, selectedFrame, sourceImage, 0, 0, {
      alpha: 1.0,
      tint: null
    });
    ctx.restore();
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

  /**
   * 显示屏幕中上方全局悬浮 Toast 消息胶囊
   * @param {string} msg 
   * @param {'info'|'warning'|'error'|'success'} type 
   * @param {{ label: string, onClick: Function }|null} action 
   */
  showToast(msg, type = 'info', action = null) {
    if (typeof document === 'undefined') return;
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `app-toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'warning') icon = '⚠️';
    else if (type === 'error') icon = '❌';
    else if (type === 'success') icon = '✅';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'toast-icon';
    iconSpan.textContent = icon;
    toast.appendChild(iconSpan);

    const textSpan = document.createElement('span');
    textSpan.textContent = msg;
    toast.appendChild(textSpan);

    if (action && action.label && typeof action.onClick === 'function') {
      const actBtn = document.createElement('button');
      actBtn.className = 'toast-action-btn';
      actBtn.textContent = action.label;
      actBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toast.remove();
        action.onClick();
      });
      toast.appendChild(actBtn);
    }

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px) scale(0.95)';
      setTimeout(() => toast.remove(), 250);
    }, 4000);
  }

  /**
   * 绑定右侧面板自由拖拽拉伸宽度
   */
  bindSidebarResizer() {
    const resizer = document.getElementById('sidebar-resizer');
    const sidebar = document.getElementById('sidebar-panel');
    if (!resizer || !sidebar) return;

    // 从本地存储恢复上次设定的面板宽度
    try {
      const savedW = localStorage.getItem('sprite_animator_sidebar_w');
      if (savedW) {
        const numW = parseInt(savedW, 10);
        if (numW >= 380 && numW <= 850) {
          sidebar.style.width = `${numW}px`;
        }
      }
    } catch (e) {}

    let isDragging = false;
    let startX = 0;
    let startW = 0;

    resizer.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startW = sidebar.getBoundingClientRect().width;
      resizer.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const deltaX = startX - e.clientX;
      let newW = Math.max(380, Math.min(850, Math.round(startW + deltaX)));
      sidebar.style.width = `${newW}px`;

      if (this.canvasWorkspace && typeof this.canvasWorkspace.handleResize === 'function') {
        this.canvasWorkspace.handleResize();
      }
      this.renderPlayerViewport();
    });

    window.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      resizer.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try {
        const currentW = Math.round(sidebar.getBoundingClientRect().width);
        localStorage.setItem('sprite_animator_sidebar_w', String(currentW));
      } catch (e) {}
      if (this.canvasWorkspace && typeof this.canvasWorkspace.handleResize === 'function') {
        this.canvasWorkspace.handleResize();
      }
      this.renderPlayerViewport();
    });
  }

  initCanvas() {
    this.renderPlayerViewport();
    this.renderScalePreviewViewport();
  }
}

// 启动应用
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    window.__SPRITE_ANIMATOR__ = new SpriteAnimatorApp();
  });
}

export { SpriteAnimatorApp };
