/**
 * @file snap-guides.js
 * @description 选框横纵对齐吸附与智能参考线计算引擎
 * 支持左/中/右/顶/底边缘对齐吸附、相邻矩形拼接贴靠、大图边界吸附以及拉伸手柄尺寸吸附
 */

export class SnapGuides {
  /**
   * 计算拖动整个选框时的横纵智能吸附与参考对齐线
   * @param {Object} activeRect - 当前正在拖动的矩形 { x, y, w, h }
   * @param {Array<Object>} otherFrames - 其它参考帧数组 [{ id, rect: { x, y, w, h } }]
   * @param {Object} [options={}] - 配置选项
   *   @param {number} [options.threshold=8] - 世界坐标下的吸附距离阈值
   *   @param {Object} [options.imageBounds] - 图像边界 { width, height }
   *   @param {boolean} [options.snapAdjacent=true] - 是否启用相邻贴靠拼接
   * @returns {{ snappedX: number, snappedY: number, guides: Array<Object> }}
   */
  static calculateBoxSnap(activeRect, otherFrames, options = {}) {
    const threshold = options.threshold !== undefined ? options.threshold : 8;
    const snapAdjacent = options.snapAdjacent !== false;
    const imageBounds = options.imageBounds || null;

    const { x, y, w, h } = activeRect;
    const activeR = x + w;
    const activeB = y + h;
    const activeCX = x + w / 2;
    const activeCY = y + h / 2;

    // 候选匹配项收集
    // xCandidates: { diff, val (吸附后的x), linePos (对齐线x坐标), alignType, targetRect }
    let bestXCandidate = null;
    let minDiffX = Infinity;

    // yCandidates: { diff, val (吸附后的y), linePos (对齐线y坐标), alignType, targetRect }
    let bestYCandidate = null;
    let minDiffY = Infinity;

    const validOtherFrames = (otherFrames || []).filter(
      f => f && f.rect && typeof f.rect.x === 'number' && typeof f.rect.w === 'number'
    );

    // 1. 遍历所有其它参考选框
    for (const other of validOtherFrames) {
      const o = other.rect;
      const oR = o.x + o.w;
      const oB = o.y + o.h;
      const oCX = o.x + o.w / 2;
      const oCY = o.y + o.h / 2;

      // ---- X 轴候选 ----
      const xChecks = [
        // 左-左对齐: active.x = o.x
        { targetX: o.x, linePos: o.x, type: 'left-left' },
        // 右-右对齐: active.x + w = oR => active.x = oR - w
        { targetX: oR - w, linePos: oR, type: 'right-right' },
        // 中心-中心对齐: active.x + w/2 = oCX => active.x = oCX - w/2
        { targetX: oCX - w / 2, linePos: oCX, type: 'center-center' },
      ];

      if (snapAdjacent) {
        // 左贴右: active.x = oR (当前框紧挨参考框右边)
        xChecks.push({ targetX: oR, linePos: oR, type: 'adjacent' });
        // 右贴左: active.x + w = o.x => active.x = o.x - w (当前框紧挨参考框左边)
        xChecks.push({ targetX: o.x - w, linePos: o.x, type: 'adjacent' });
      }

      for (const check of xChecks) {
        const diff = Math.abs(x - check.targetX);
        if (diff <= threshold) {
          if (diff < minDiffX) {
            minDiffX = diff;
            bestXCandidate = {
              val: Math.round(check.targetX),
              linePos: check.linePos,
              type: check.type,
              targets: [o]
            };
          } else if (diff === minDiffX && bestXCandidate) {
            bestXCandidate.targets.push(o);
          }
        }
      }

      // ---- Y 轴候选 ----
      const yChecks = [
        // 顶-顶对齐: active.y = o.y
        { targetY: o.y, linePos: o.y, type: 'top-top' },
        // 底-底对齐: active.y + h = oB => active.y = oB - h
        { targetY: oB - h, linePos: oB, type: 'bottom-bottom' },
        // 中心-中心对齐: active.y + h/2 = oCY => active.y = oCY - h/2
        { targetY: oCY - h / 2, linePos: oCY, type: 'middle-middle' },
      ];

      if (snapAdjacent) {
        // 顶贴底: active.y = oB (当前框紧贴在参考框下方)
        yChecks.push({ targetY: oB, linePos: oB, type: 'adjacent' });
        // 底贴顶: active.y + h = o.y => active.y = o.y - h (当前框紧贴在参考框上方)
        yChecks.push({ targetY: o.y - h, linePos: o.y, type: 'adjacent' });
      }

      for (const check of yChecks) {
        const diff = Math.abs(y - check.targetY);
        if (diff <= threshold) {
          if (diff < minDiffY) {
            minDiffY = diff;
            bestYCandidate = {
              val: Math.round(check.targetY),
              linePos: check.linePos,
              type: check.type,
              targets: [o]
            };
          } else if (diff === minDiffY && bestYCandidate) {
            bestYCandidate.targets.push(o);
          }
        }
      }
    }

    // 2. 大图边界吸附检测 (Image Bounds)
    if (imageBounds && imageBounds.width > 0 && imageBounds.height > 0) {
      const imgW = imageBounds.width;
      const imgH = imageBounds.height;

      // X 轴边界: 0 和 imgW - w
      const imgXChecks = [
        { targetX: 0, linePos: 0, type: 'bounds-left' },
        { targetX: imgW - w, linePos: imgW, type: 'bounds-right' }
      ];
      for (const check of imgXChecks) {
        const diff = Math.abs(x - check.targetX);
        if (diff <= threshold && diff < minDiffX) {
          minDiffX = diff;
          bestXCandidate = {
            val: Math.round(check.targetX),
            linePos: check.linePos,
            type: check.type,
            targets: [{ x: 0, y: 0, w: imgW, h: imgH }]
          };
        }
      }

      // Y 轴边界: 0 和 imgH - h
      const imgYChecks = [
        { targetY: 0, linePos: 0, type: 'bounds-top' },
        { targetY: imgH - h, linePos: imgH, type: 'bounds-bottom' }
      ];
      for (const check of imgYChecks) {
        const diff = Math.abs(y - check.targetY);
        if (diff <= threshold && diff < minDiffY) {
          minDiffY = diff;
          bestYCandidate = {
            val: Math.round(check.targetY),
            linePos: check.linePos,
            type: check.type,
            targets: [{ x: 0, y: 0, w: imgW, h: imgH }]
          };
        }
      }
    }

    const snappedX = bestXCandidate !== null ? bestXCandidate.val : x;
    const snappedY = bestYCandidate !== null ? bestYCandidate.val : y;

    // 3. 构建高亮参考线对象列表 (Guides)
    const guides = [];

    if (bestXCandidate) {
      // 垂直对齐线
      const currentBoxSnapped = { x: snappedX, y: snappedY, w, h };
      let minY = currentBoxSnapped.y;
      let maxY = currentBoxSnapped.y + currentBoxSnapped.h;

      bestXCandidate.targets.forEach(t => {
        minY = Math.min(minY, t.y);
        maxY = Math.max(maxY, t.y + t.h);
      });

      guides.push({
        axis: 'x',
        pos: bestXCandidate.linePos,
        start: minY - 10,
        end: maxY + 10,
        alignType: bestXCandidate.type
      });
    }

    if (bestYCandidate) {
      // 水平对齐线
      const currentBoxSnapped = { x: snappedX, y: snappedY, w, h };
      let minX = currentBoxSnapped.x;
      let maxX = currentBoxSnapped.x + currentBoxSnapped.w;

      bestYCandidate.targets.forEach(t => {
        minX = Math.min(minX, t.x);
        maxX = Math.max(maxX, t.x + t.w);
      });

      guides.push({
        axis: 'y',
        pos: bestYCandidate.linePos,
        start: minX - 10,
        end: maxX + 10,
        alignType: bestYCandidate.type
      });
    }

    return {
      snappedX,
      snappedY,
      guides
    };
  }

  /**
   * 计算手柄拖拽缩放选框时的边缘对齐吸附
   * @param {Object} activeRect - 正在缩放的矩形 { x, y, w, h }
   * @param {string} handle - 当前激活的手柄 ('nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w')
   * @param {Array<Object>} otherFrames - 其它参考帧数组
   * @param {Object} [options={}] - 配置参数
   * @returns {{ snappedRect: Object, guides: Array<Object> }}
   */
  static calculateResizeSnap(activeRect, handle, otherFrames, options = {}) {
    const threshold = options.threshold !== undefined ? options.threshold : 8;
    const minSize = options.minSize || 4;
    const imageBounds = options.imageBounds || null;

    let { x, y, w, h } = activeRect;
    let r = x + w;
    let b = y + h;

    const guides = [];
    const validOtherFrames = (otherFrames || []).filter(
      f => f && f.rect && typeof f.rect.x === 'number'
    );

    // 辅助函数: 吸附单个值到候选列表中最近的点
    const findSnapValue = (currentVal, candidates) => {
      let best = null;
      let minDiff = Infinity;
      for (const cand of candidates) {
        const diff = Math.abs(currentVal - cand.pos);
        if (diff <= threshold && diff < minDiff) {
          minDiff = diff;
          best = cand;
        }
      }
      return best;
    };

    // 收集所有参考选框的 X 和 Y 边缘候选
    const xEdgeCandidates = [];
    const yEdgeCandidates = [];

    for (const other of validOtherFrames) {
      const o = other.rect;
      xEdgeCandidates.push({ pos: o.x, target: o, type: 'left' });
      xEdgeCandidates.push({ pos: o.x + o.w, target: o, type: 'right' });
      xEdgeCandidates.push({ pos: o.x + o.w / 2, target: o, type: 'center' });

      yEdgeCandidates.push({ pos: o.y, target: o, type: 'top' });
      yEdgeCandidates.push({ pos: o.y + o.h, target: o, type: 'bottom' });
      yEdgeCandidates.push({ pos: o.y + o.h / 2, target: o, type: 'center' });
    }

    if (imageBounds) {
      xEdgeCandidates.push({ pos: 0, target: null, type: 'bounds' });
      xEdgeCandidates.push({ pos: imageBounds.width, target: null, type: 'bounds' });
      yEdgeCandidates.push({ pos: 0, target: null, type: 'bounds' });
      yEdgeCandidates.push({ pos: imageBounds.height, target: null, type: 'bounds' });
    }

    // 针对不同手柄进行边缘判定
    // 1. 右边缘吸附 (e, ne, se)
    if (['e', 'ne', 'se'].includes(handle)) {
      const snapR = findSnapValue(r, xEdgeCandidates);
      if (snapR && snapR.pos >= x + minSize) {
        r = Math.round(snapR.pos);
        w = r - x;
        guides.push({
          axis: 'x',
          pos: r,
          start: Math.min(y, snapR.target ? snapR.target.y : y) - 10,
          end: Math.max(b, snapR.target ? snapR.target.y + snapR.target.h : b) + 10,
          alignType: 'resize-edge'
        });
      }
    }

    // 2. 左边缘吸附 (w, nw, sw)
    if (['w', 'nw', 'sw'].includes(handle)) {
      const snapL = findSnapValue(x, xEdgeCandidates);
      if (snapL && snapL.pos <= r - minSize) {
        const oldR = r;
        x = Math.round(snapL.pos);
        w = oldR - x;
        guides.push({
          axis: 'x',
          pos: x,
          start: Math.min(y, snapL.target ? snapL.target.y : y) - 10,
          end: Math.max(b, snapL.target ? snapL.target.y + snapL.target.h : b) + 10,
          alignType: 'resize-edge'
        });
      }
    }

    // 3. 底边缘吸附 (s, se, sw)
    if (['s', 'se', 'sw'].includes(handle)) {
      const snapB = findSnapValue(b, yEdgeCandidates);
      if (snapB && snapB.pos >= y + minSize) {
        b = Math.round(snapB.pos);
        h = b - y;
        guides.push({
          axis: 'y',
          pos: b,
          start: Math.min(x, snapB.target ? snapB.target.x : x) - 10,
          end: Math.max(r, snapB.target ? snapB.target.x + snapB.target.w : r) + 10,
          alignType: 'resize-edge'
        });
      }
    }

    // 4. 顶边缘吸附 (n, ne, nw)
    if (['n', 'ne', 'nw'].includes(handle)) {
      const snapT = findSnapValue(y, yEdgeCandidates);
      if (snapT && snapT.pos <= b - minSize) {
        const oldB = b;
        y = Math.round(snapT.pos);
        h = oldB - y;
        guides.push({
          axis: 'y',
          pos: y,
          start: Math.min(x, snapT.target ? snapT.target.x : x) - 10,
          end: Math.max(r, snapT.target ? snapT.target.x + snapT.target.w : r) + 10,
          alignType: 'resize-edge'
        });
      }
    }

    return {
      snappedRect: { x, y, w, h },
      guides
    };
  }

  /**
   * 在 Canvas 上渲染高对比度的智能参考线
   * @param {CanvasRenderingContext2D} ctx 
   * @param {Array<Object>} guides - 参考线数组
   * @param {Function} worldToScreen - 世界坐标转屏幕坐标函数
   */
  static renderGuides(ctx, guides, worldToScreen) {
    if (!ctx || !guides || guides.length === 0) return;

    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ff006e'; // 鲜艳洋红/玫红色参考线
    ctx.fillStyle = '#ff006e';

    for (const guide of guides) {
      if (guide.axis === 'x') {
        // 垂直线 (x 恒定，y 从 start 到 end)
        const p1 = worldToScreen(guide.pos, guide.start);
        const p2 = worldToScreen(guide.pos, guide.end);

        ctx.beginPath();
        // 细微虚线间隔 4, 3
        ctx.setLineDash([4, 3]);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // 两端绘制端点菱形标记
        ctx.setLineDash([]);
        this._drawDiamond(ctx, p1.x, p1.y, 4);
        this._drawDiamond(ctx, p2.x, p2.y, 4);
      } else if (guide.axis === 'y') {
        // 水平线 (y 恒定，x 从 start 到 end)
        const p1 = worldToScreen(guide.start, guide.pos);
        const p2 = worldToScreen(guide.end, guide.pos);

        ctx.beginPath();
        ctx.setLineDash([4, 3]);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        ctx.setLineDash([]);
        this._drawDiamond(ctx, p1.x, p1.y, 4);
        this._drawDiamond(ctx, p2.x, p2.y, 4);
      }
    }

    ctx.restore();
  }

  /**
   * 绘制小菱形端点标记
   * @private
   */
  static _drawDiamond(ctx, cx, cy, radius) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx + radius, cy);
    ctx.lineTo(cx, cy + radius);
    ctx.lineTo(cx - radius, cy);
    ctx.closePath();
    ctx.fill();
  }
}
