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
  const lockedAngleRef = useRef<number | null>(null);

  const showAimLine = useGameStore((s) => s.showAimLine);
  const freeBall = useGameStore((s) => s.freeBall);
  const currentPlayerId = useGameStore((s) => s.currentPlayerId);
  const players = useGameStore((s) => s.players);
  const table = useGameStore((s) => s.table);
  const foulMessage = useGameStore((s) => s.foulMessage);
  const winner = useGameStore((s) => s.winner);

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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    let lastAITime = 0;

    const loop = (time: number) => {
      const dt = Math.min(0.05, (time - lastTimeRef.current) / 1000);
      lastTimeRef.current = time;

      const state = useGameStore.getState();
      const curPhase = state.phase;
      const curBalls = state.balls;
      const curPower = state.power;
      const curSpinX = state.spinX;
      const curAimAngle = state.aimAngle;

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

      if (curPhase === 'aiming' && !state.freeBall) {
        const curPlayer = state.players.find((p) => p.id === state.currentPlayerId);
        if (curPlayer?.isAI && time - lastAITime > 800) {
          lastAITime = time;
          aiTakeTurn();
        }
      }

      draw(ctx, curBalls, table, curPhase, curPower, curSpinX, curAimAngle, state.freeBall, state.foulMessage, state.winner, state.currentPlayerId, state.players);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [table, updateCharge, simulateStep, resolveTurn, aiTakeTurn]);

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

      const state = useGameStore.getState();

      if (state.phase === 'charging') {
        if (lockedAngleRef.current !== null && state.aimAngle !== lockedAngleRef.current) {
          setAimAngle(lockedAngleRef.current);
        }
        const startX = chargeStartMouseRef.current.x;
        const dx = pt.x - startX;
        const spin = Math.max(-1, Math.min(1, dx / 150));
        setSpinX(spin);
        return;
      }

      if (state.phase === 'aiming' && !state.freeBall) {
        const cue = state.balls.find((b) => b.id === 0);
        if (cue) {
          const dx = pt.x - cue.pos.x;
          const dy = pt.y - cue.pos.y;
          if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            const rawAngle = Math.atan2(dy, dx);
            const curAngle = state.aimAngle;
            let diff = rawAngle - curAngle;
            while (diff > Math.PI) diff -= 2 * Math.PI;
            while (diff < -Math.PI) diff += 2 * Math.PI;
            const smoothed = curAngle + diff * 0.4;
            setAimAngle(smoothed);
          }
        }
      }
    };

    const onDown = (e: MouseEvent) => {
      const pt = toLocal(e);
      const state = useGameStore.getState();

      if (state.freeBall) {
        placeFreeBall(pt.x, pt.y);
        return;
      }
      if (state.phase === 'aiming') {
        const curPlayer = state.players.find((p) => p.id === state.currentPlayerId);
        if (!curPlayer?.isAI) {
          lockedAngleRef.current = state.aimAngle;
          chargeStartMouseRef.current = pt;
          startCharge();
          isChargingRef.current = true;
        }
      }
    };

    const onUp = () => {
      if (isChargingRef.current) {
        releaseShot();
        isChargingRef.current = false;
        lockedAngleRef.current = null;
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
    curAimAngle: number,
    curFreeBall: boolean,
    curFoulMessage: string | null,
    curWinner: { name: string } | null,
    curCurrentPlayerId: number,
    curPlayers: { id: number; name: string; isAI: boolean }[],
  ) => {
    ctx.fillStyle = '#0a0f0a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    drawTable(ctx, t);

    if (showAimLine && (curPhase === 'aiming' || curPhase === 'charging') && !curFreeBall) {
      const cue = curBalls.find((bb) => bb.id === 0);
      const activePower = curPower > 0 ? curPower : 0.5;
      const prediction = predictShot(curBalls, curAimAngle, activePower, 1, 120, curSpinX);
      if (cue) drawAimLine(ctx, cue.pos, prediction);
    }

    if (curFreeBall) {
      drawFreeBallHint(ctx);
    }

    for (const b of curBalls) {
      if (!b.pocketed) drawBall(ctx, b);
    }

    if ((curPhase === 'aiming' || curPhase === 'charging') && !curFreeBall) {
      const cue = curBalls.find((bb) => bb.id === 0);
      const curPlayer = curPlayers.find((p) => p.id === curCurrentPlayerId);
      if (cue && !curPlayer?.isAI) {
        drawCue(ctx, cue, curAimAngle, curPower, animRef.current.cueShrink, curSpinX);
      }
    }

    if (curFoulMessage && curPhase !== 'gameover') {
      drawFoulBanner(ctx, curFoulMessage);
    }

    if (curWinner) {
      drawWinnerBanner(ctx, curWinner.name);
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
