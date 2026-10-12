/**
 * @file app.js
 * @description Sprite Animator 应用主入口模块
 */

import { state, eventBus } from './core/state.js';

class SpriteAnimatorApp {
  constructor() {
    this.initElements();
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
    this.mainCanvas = document.getElementById('main-canvas');
    this.playerCanvas = document.getElementById('player-canvas');
    this.statusMessage = document.getElementById('status-message');

    // 播放器控件
    this.btnPlayPause = document.getElementById('btn-play-pause');
    this.playIcon = document.getElementById('play-icon');
    this.fpsSlider = document.getElementById('fps-slider');
    this.fpsDisplay = document.getElementById('fps-display');
    this.loopModeSelect = document.getElementById('loop-mode-select');
  }

  bindEvents() {
    // 导入图片触发
    const triggerFileInput = () => this.fileInput && this.fileInput.click();
    if (this.btnImport) this.btnImport.addEventListener('click', triggerFileInput);
    if (this.btnEmptyImport) this.btnEmptyImport.addEventListener('click', triggerFileInput);

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

    // 缩放滑块
    if (this.zoomSlider && this.zoomDisplay) {
      this.zoomSlider.addEventListener('input', (e) => {
        const zoomPercent = parseInt(e.target.value, 10);
        this.zoomDisplay.textContent = `${zoomPercent}%`;
        state.setState({
          viewport: { ...state.get('viewport'), zoom: zoomPercent / 100 }
        });
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

    // 空状态拖拽支持高亮
    if (this.emptyPlaceholder) {
      ['dragenter', 'dragover'].forEach(eventName => {
        this.emptyPlaceholder.addEventListener(eventName, (e) => {
          e.preventDefault();
          this.emptyPlaceholder.classList.add('drag-over');
        });
      });
      ['dragleave', 'drop'].forEach(eventName => {
        this.emptyPlaceholder.addEventListener(eventName, (e) => {
          e.preventDefault();
          this.emptyPlaceholder.classList.remove('drag-over');
        });
      });
    }
  }

  bindStateSubscriptions() {
    // 监听工具变化高亮对应按钮
    state.subscribe('currentTool', (tool) => {
      this.toolButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === tool);
      });
      if (this.statusMessage) {
        const toolNames = {
          select: '选择选框工具 (V)',
          create_box: '新建选框工具 (B)',
          eraser: '交叉消除橡皮擦 (E)',
          lasso: '多边形套索 (L)',
          wand: '魔棒抠图 (W)',
          pan: '抓手平移 (Space)'
        };
        this.statusMessage.textContent = `当前工具: ${toolNames[tool] || tool}`;
      }
    });

    // 监听播放状态切换图标
    state.subscribe('playerState', (playerState) => {
      if (this.playIcon) {
        this.playIcon.textContent = playerState.isPlaying ? '⏸' : '▶';
      }
    });

    // 监听图像导入以隐藏空状态提示
    state.subscribe('sourceImage', (img) => {
      if (this.emptyPlaceholder) {
        this.emptyPlaceholder.style.display = img ? 'none' : 'flex';
      }
    });
  }

  initCanvas() {
    // 初始化画布网格与基准指示
    if (this.playerCanvas) {
      const ctx = this.playerCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, this.playerCanvas.width, this.playerCanvas.height);
        // 绘制辅助水平地面线
        ctx.strokeStyle = 'rgba(58, 134, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        const groundY = this.playerCanvas.height * 0.85;
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(this.playerCanvas.width, groundY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
  window.__SPRITE_ANIMATOR__ = new SpriteAnimatorApp();
});

export { SpriteAnimatorApp };
