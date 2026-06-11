import type { Ball } from './types';
import type { predictShot } from './prediction';

export function drawAimLine(
  ctx: CanvasRenderingContext2D,
  curBalls: Ball[],
  prediction: ReturnType<typeof predictShot>,
): void {
  const cue = curBalls.find((b) => b.id === 0);
  if (!cue) return;

  for (let i = 0; i < prediction.segments.length; i++) {
    const seg = prediction.segments[i];
    if (!seg.isCuePath) continue;

    ctx.save();
    ctx.strokeStyle = seg.isSolid ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash(seg.isSolid ? [] : [6, 6]);
    ctx.lineDashOffset = 0;
    ctx.beginPath();
    ctx.moveTo(seg.start.x, seg.start.y);
    ctx.lineTo(seg.end.x, seg.end.y);
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
      ctx.fillText(`预测进球: ${ids}号`, cue.pos.x + 20, cue.pos.y - 25);
    }
    if (prediction.willPocket.includes(0)) {
      ctx.fillStyle = 'rgba(248,113,113,0.9)';
      ctx.fillText('⚠ 白球可能落袋', cue.pos.x + 20, cue.pos.y - 45);
    }
    ctx.restore();
  }
}
