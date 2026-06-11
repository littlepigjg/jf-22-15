import type { Ball } from './types';
import { BALL_RADIUS } from './constants';

export function drawCue(
  ctx: CanvasRenderingContext2D,
  cue: Ball,
  angle: number,
  pwr: number,
  cueShrink: number,
  sx: number,
): void {
  const dist = BALL_RADIUS * 2 + 18 - cueShrink * 50;
  const startX = cue.pos.x + Math.cos(angle + Math.PI) * dist;
  const startY = cue.pos.y + Math.sin(angle + Math.PI) * dist;
  const endX = startX + Math.cos(angle + Math.PI) * 220;
  const endY = startY + Math.sin(angle + Math.PI) * 220;

  ctx.save();

  ctx.strokeStyle = '#f7f1e0';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  const tipEndX = cue.pos.x + Math.cos(angle + Math.PI) * (BALL_RADIUS + 2);
  const tipEndY = cue.pos.y + Math.sin(angle + Math.PI) * (BALL_RADIUS + 2);
  const tipStartX = startX + Math.cos(angle) * 8;
  const tipStartY = startY + Math.sin(angle) * 8;
  ctx.strokeStyle = '#2a6a3f';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(tipStartX, tipStartY);
  ctx.lineTo(tipEndX, tipEndY);
  ctx.stroke();

  const tipTipX = cue.pos.x + Math.cos(angle + Math.PI) * (BALL_RADIUS + 1);
  const tipTipY = cue.pos.y + Math.sin(angle + Math.PI) * (BALL_RADIUS + 1);
  ctx.strokeStyle = '#11331f';
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(tipEndX, tipEndY);
  ctx.lineTo(tipTipX, tipTipY);
  ctx.stroke();

  ctx.strokeStyle = '#3d2817';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(startX + Math.cos(angle + Math.PI) * 40, startY + Math.sin(angle + Math.PI) * 40);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  ctx.strokeStyle = '#d4a84b';
  ctx.lineWidth = 2;
  for (let i = 1; i <= 3; i++) {
    const tt = 50 + i * 35;
    const x1 = startX + Math.cos(angle + Math.PI) * tt;
    const y1 = startY + Math.sin(angle + Math.PI) * tt;
    const x2 = x1 + Math.cos(angle + Math.PI) * 4;
    const y2 = y1 + Math.sin(angle + Math.PI) * 4;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  drawSpinIndicator(ctx, startX, startY, angle, sx);

  ctx.restore();
}

export function drawSpinIndicator(
  ctx: CanvasRenderingContext2D,
  cueStartX: number,
  cueStartY: number,
  angle: number,
  sx: number,
): void {
  if (Math.abs(sx) < 0.02) return;

  const perpX = -Math.sin(angle);
  const perpY = Math.cos(angle);
  const indicatorLen = 45 * Math.abs(sx);
  const indicatorX = cueStartX + perpX * sx * indicatorLen;
  const indicatorY = cueStartY + perpY * sx * indicatorLen;

  const isRight = sx > 0;
  const color = isRight ? '#ef4444' : '#3b82f6';
  const absSx = Math.abs(sx);

  ctx.strokeStyle = color;
  ctx.lineWidth = 4 + absSx * 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cueStartX, cueStartY);
  ctx.lineTo(indicatorX, indicatorY);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(indicatorX, indicatorY, 5 + absSx * 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = isRight ? `右塞 ${Math.round(absSx * 100)}%` : `左塞 ${Math.round(absSx * 100)}%`;
  ctx.fillText(label, cueStartX, cueStartY - 30);
}
