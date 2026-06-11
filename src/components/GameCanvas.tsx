import { useEffect, useRef } from 'react';
import { useGameStore } from '../stores/useGameStore';
import type { Ball, Table } from '../game/types';
import { predictShot } from '../game/prediction';
import { drawTable, drawBall } from '../game/draw-helpers';
import { drawCue } from '../game/draw-cue';
import { drawAimLine } from '../game/draw-aim-line';
import { drawFreeBallHint, drawFoulBanner, drawWinnerBanner } from '../game/draw-overlays';

const CANVAS_W = 880;
const CANVAS_H = 480;

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());
  const mouseRef = useRef({ x: 0, y: 0 });
  const chargeStartMouseRef = useRef({ x: 0, y: 0 });
  const animRef = useRef({ cueShrink: 0 });
  const isChargingRef = useRef(false);

  const phase = useGameStore((s) => s.phase);
  const balls = useGameStore((s) => s.balls);
  const table = useGameStore((s) => s.table);
  const aimAngle = useGameStore((s) => s.aimAngle);
  const power = useGameStore((s) => s.power);
  const spinX = useGameStore((s) => s.spinX);
  const isCharging = useGameStore((s) => s.isCharging);
  const showAimLine = useGameStore((s) => s.showAimLine);
  const freeBall = useGameStore((s) => s.freeBall);
  const foulMessage = useGameStore((s) => s.foulMessage);
  const winner = useGameStore((s) => s.winner);
  const currentPlayerId = useGameStore((s) => s.currentPlayerId);
  const players = useGameStore((s) => s.players);

  const setAimAngle = useGameStore((s) => s.setAimAngle);
  const setSpinX = useGameStore((s) => s.setSpinX);
  const startCharge = useGameStore((s) => s.startCharge);
  const updateCharge = useGameStore((s) => s.updateCharge);
  const releaseShot = useGameStore((s) => s.releaseShot);
  const simulateStep = useGameStore((s) => s.simulateStep);
  const resolveTurn = useGameStore((s) => s.resolveTurn);
  const aiTakeTurn = useGameStore((s) => s.aiTakeTurn);
  const placeFreeBall = useGameStore((s) => s.placeFreeBall);

  useEffect(() => {
    isChargingRef.current = isCharging;
  }, [isCharging]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    let lastAITime = 0;

    const loop = (time: number) => {
      const dt = Math.min(0.05, (time - lastTimeRef.current) / 1000);
      lastTimeRef.current = time;

      const curPhase = useGameStore.getState().phase;
      const curBalls = useGameStore.getState().balls;
      const curPower = useGameStore.getState().power;
      const curSpinX = useGameStore.getState().spinX;

      if (curPhase === 'charging') {
        updateCharge(dt);
        animRef.current.cueShrink = Math.min(0.6, curPower * 0.5);
      } else {
        animRef.current.cueShrink *= 0.9;
      }

      if (curPhase === 'simulating') {
        simulateStep();
      }

      if (curPhase === 'resolving') {
        resolveTurn();
      }

      if (curPhase === 'aiming' && !freeBall) {
        const curPlayer = players.find((p) => p.id === currentPlayerId);
        if (curPlayer?.isAI && time - lastAITime > 800) {
          lastAITime = time;
          aiTakeTurn();
        }
      }

      draw(ctx, curBalls, table, curPhase, curPower, curSpinX);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [freeBall, currentPlayerId, players, updateCharge, simulateStep, resolveTurn, aiTakeTurn, table]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const toLocal = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / rect.width;
      const sy = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * sx,
        y: (e.clientY - rect.top) * sy,
      };
    };

    const onMove = (e: MouseEvent) => {
      const pt = toLocal(e);
      mouseRef.current = pt;

      if (isChargingRef.current) {
        const startX = chargeStartMouseRef.current.x;
        const dx = pt.x - startX;
        const spin = Math.max(-1, Math.min(1, dx / 150));
        setSpinX(spin);
        return;
      }

      const curBalls = useGameStore.getState().balls;
      const curFreeBall = useGameStore.getState().freeBall;
      const cue = curBalls.find((b) => b.id === 0);
      if (cue && !curFreeBall) {
        const dx = pt.x - cue.pos.x;
        const dy = pt.y - cue.pos.y;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          setAimAngle(Math.atan2(dy, dx));
        }
      }
    };

    const onDown = (e: MouseEvent) => {
      const pt = toLocal(e);
      const curFreeBall = useGameStore.getState().freeBall;
      const curPhase = useGameStore.getState().phase;
      const curPlayers = useGameStore.getState().players;
      const curPlayerId = useGameStore.getState().currentPlayerId;

      if (curFreeBall) {
        placeFreeBall(pt.x, pt.y);
        return;
      }
      if (curPhase === 'aiming') {
        const curPlayer = curPlayers.find((p) => p.id === curPlayerId);
        if (!curPlayer?.isAI) {
          chargeStartMouseRef.current = pt;
          startCharge();
        }
      }
    };

    const onUp = () => {
      if (isChargingRef.current) {
        releaseShot();
      }
    };

    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    return () => {
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
    };
  }, [setAimAngle, setSpinX, startCharge, releaseShot, placeFreeBall]);

  const draw = (
    ctx: CanvasRenderingContext2D,
    curBalls: Ball[],
    t: Table,
    curPhase: string,
    curPower: number,
    curSpinX: number,
  ) => {
    ctx.fillStyle = '#0a0f0a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    drawTable(ctx, t);

    if (showAimLine && (curPhase === 'aiming' || curPhase === 'charging') && !freeBall) {
      const activePower = curPower > 0 ? curPower : 0.5;
      const prediction = predictShot(curBalls, aimAngle, activePower, 1, 120, curSpinX);
      drawAimLine(ctx, curBalls, prediction);
    }

    if (freeBall) {
      drawFreeBallHint(ctx);
    }

    for (const b of curBalls) {
      if (!b.pocketed) drawBall(ctx, b);
    }

    if ((curPhase === 'aiming' || curPhase === 'charging') && !freeBall) {
      const cue = curBalls.find((bb) => bb.id === 0);
      const curPlayer = players.find((p) => p.id === currentPlayerId);
      if (cue && !curPlayer?.isAI) {
        drawCue(ctx, cue, aimAngle, curPower, animRef.current.cueShrink, curSpinX);
      }
    }

    if (foulMessage && curPhase !== 'gameover') {
      drawFoulBanner(ctx, foulMessage);
    }

    if (winner) {
      drawWinnerBanner(ctx, winner.name);
    }
  };

  return (
    <div className="relative inline-block">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="rounded-xl shadow-2xl border border-amber-900/60 cursor-crosshair"
        style={{ maxWidth: '100%', height: 'auto' }}
      />
    </div>
  );
}
