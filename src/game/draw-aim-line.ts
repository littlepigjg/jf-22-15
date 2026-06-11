import type { Vec2 } from './types';
import type { predictShot } from './prediction';

export function drawAimLine(
  ctx: CanvasRenderingContext2D,
  cuePos: Vec2,
  prediction: ReturnType<typeof predictShot>,
): void {
  for (let i = 0; i < prediction.segments.length; i++) {
    const seg = prediction.segments[i];
    if (!seg.isCuePath) continue;

    const points = seg.points;
    if (points.length < 2) continue;

    ctx.save();
    ctx.strokeStyle = seg.isSolid ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash(seg.isSolid ? [] : [6, 6]);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    if (points.length === 2) {
      ctx.lineTo(points[1].x, points[1].y);
    } else {
      for (let j = 1; j < points.length - 1; j++) {
        const midX = (points[j].x + points[j + 1].x) / 2;
        const midY = (points[j].y + points[j + 1].y) / 2;
        ctx.quadraticCurveTo(points[j].x, points[j].y, midX, midY);
      }
      const last = points[points.length - 1];
      ctx.lineTo(last.x, last.y);
    }

    ctx.stroke();
    ctx.restore();
  }

  if (prediction.targetBallPath) {
    ctx.save();
    ctx.strokeStyle = 'rgba(245,208,51,0.6)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(prediction.targetBallPath.start.x, prediction.targetBallPath.start.y);
    ctx.lineTo(prediction.targetBallPath.end.x, prediction.targetBallPath.end.y);
    ctx.stroke();
    ctx.restore();
  }

  if (prediction.willPocket.length > 0) {
    ctx.save();
    ctx.fillStyle = 'rgba(74,222,128,0.85)';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    const ids = prediction.willPocket.filter((i) => i !== 0).join(', ');
    if (ids) {
      ctx.fillText(`预测进球: ${ids}号`, cuePos.x + 20, cuePos.y - 25);
    }
    if (prediction.willPocket.includes(0)) {
      ctx.fillStyle = 'rgba(248,113,113,0.9)';
      ctx.fillText('⚠ 白球可能落袋', cuePos.x + 20, cuePos.y - 45);
    }
    ctx.restore();
  }
}
