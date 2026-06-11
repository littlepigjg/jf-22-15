import {
  PLAYFIELD_LEFT,
  PLAYFIELD_RIGHT,
  PLAYFIELD_TOP,
  PLAYFIELD_BOTTOM,
} from './constants';
import { roundRect } from './draw-helpers';

const CANVAS_W = 880;
const CANVAS_H = 480;

export function drawFreeBallHint(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.fillStyle = 'rgba(245,208,75,0.1)';
  ctx.fillRect(PLAYFIELD_LEFT, PLAYFIELD_TOP, PLAYFIELD_RIGHT - PLAYFIELD_LEFT, PLAYFIELD_BOTTOM - PLAYFIELD_TOP);
  ctx.strokeStyle = 'rgba(245,208,75,0.7)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 4]);
  ctx.strokeRect(PLAYFIELD_LEFT, PLAYFIELD_TOP, PLAYFIELD_RIGHT - PLAYFIELD_LEFT, PLAYFIELD_BOTTOM - PLAYFIELD_TOP);
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(245,208,75,0.95)';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('自由球：点击任意位置放置白球', CANVAS_W / 2, CANVAS_H - 18);
  ctx.restore();
}

export function drawFoulBanner(ctx: CanvasRenderingContext2D, msg: string): void {
  ctx.save();
  const w = 400;
  const h = 44;
  const x = (CANVAS_W - w) / 2;
  const y = 70;
  ctx.fillStyle = 'rgba(127,29,29,0.92)';
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(248,113,113,0.8)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fecaca';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(msg, x + w / 2, y + h / 2);
  ctx.restore();
}

export function drawWinnerBanner(ctx: CanvasRenderingContext2D, name: string): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  const w = 420;
  const h = 120;
  const x = (CANVAS_W - w) / 2;
  const y = (CANVAS_H - h) / 2;
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, '#2a1a0e');
  grad.addColorStop(1, '#5a3a1f');
  ctx.fillStyle = grad;
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.strokeStyle = '#d4a84b';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#d4a84b';
  ctx.font = 'bold 36px "Playfair Display", serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${name} 获胜！`, x + w / 2, y + h / 2 + 10);
  ctx.restore();
}
