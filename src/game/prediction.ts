import type { Ball, Vec2 } from './types';
import {
  BALL_RADIUS,
  PLAYFIELD_LEFT,
  PLAYFIELD_RIGHT,
  PLAYFIELD_TOP,
  PLAYFIELD_BOTTOM,
  POCKETS,
  MAX_POWER,
} from './constants';
import { applyShot, stepPhysics } from './physics';
import { v } from '../utils/math';

export interface PredictionSegment {
  start: Vec2;
  end: Vec2;
  isCuePath: boolean;
  isSolid: boolean;
  points: Vec2[];
}

export interface PredictionResult {
  segments: PredictionSegment[];
  firstHitBallId: number | null;
  targetBallPath: { start: Vec2; end: Vec2 } | null;
  willPocket: number[];
}

const POINT_INTERVAL = 3;

export function predictShot(
  balls: Ball[],
  cueAngle: number,
  cuePower: number,
  maxBounces = 2,
  maxSteps = 200,
  spinX = 0,
): PredictionResult {
  const segments: PredictionSegment[] = [];
  const willPocket: number[] = [];

  const cueBall = balls.find((b) => b.id === 0 && !b.pocketed);
  if (!cueBall) return { segments, firstHitBallId: null, targetBallPath: null, willPocket };

  const simBalls = balls.map((b) => ({
    ...b,
    pos: { ...b.pos },
    vel: { ...b.vel },
    spin: { ...b.spin },
    pocketed: b.pocketed,
  }));

  applyShot(simBalls, cueAngle, cuePower, MAX_POWER, spinX, 0);

  const simCue = simBalls.find((b) => b.id === 0)!;
  let currentPos = { ...simCue.pos };
  let firstHitId: number | null = null;
  let targetBallPath: { start: Vec2; end: Vec2 } | null = null;
  let bounces = 0;
  let currentPoints: Vec2[] = [{ ...currentPos }];
  let currentIsSolid = true;
  let stepInSegment = 0;

  const flushSegment = (endPos: Vec2, isSolid: boolean, isCuePath: boolean) => {
    if (currentPoints.length >= 2) {
      const pts = [...currentPoints, { ...endPos }];
      segments.push({
        start: { ...currentPoints[0] },
        end: { ...endPos },
        isCuePath,
        isSolid,
        points: pts,
      });
    }
    currentPoints = [{ ...endPos }];
    currentIsSolid = isSolid;
    stepInSegment = 0;
  };

  for (let step = 0; step < maxSteps; step++) {
    const result = stepPhysics(simBalls, 1 / 60);

    stepInSegment++;
    if (stepInSegment % POINT_INTERVAL === 0) {
      currentPoints.push({ ...simCue.pos });
    }

    const cueCollisions = result.ballCollisions.filter(
      (c) => c.a === 0 || c.b === 0,
    );

    if (cueCollisions.length > 0) {
      flushSegment({ ...simCue.pos }, currentIsSolid, true);

      if (firstHitId === null) {
        const hit = cueCollisions[0];
        const hitBallId = hit.a === 0 ? hit.b : hit.a;
        firstHitId = hitBallId;

        const hitBall = simBalls.find((b) => b.id === hitBallId);
        if (hitBall) {
          const targetStart = { ...hitBall.pos };
          const targetEnd = { x: targetStart.x, y: targetStart.y };
          let tv = { ...hitBall.vel };

          for (let t = 0; t < 80; t++) {
            targetEnd.x += tv.x;
            targetEnd.y += tv.y;
            tv.x *= 0.988;
            tv.y *= 0.988;

            if (targetEnd.x - BALL_RADIUS < PLAYFIELD_LEFT || targetEnd.x + BALL_RADIUS > PLAYFIELD_RIGHT ||
                targetEnd.y - BALL_RADIUS < PLAYFIELD_TOP || targetEnd.y + BALL_RADIUS > PLAYFIELD_BOTTOM) {
              break;
            }

            for (const pocket of POCKETS) {
              if (v.dist(targetEnd, pocket.pos) < pocket.radius - BALL_RADIUS * 0.4) {
                willPocket.push(hitBallId);
                break;
              }
            }
          }

          targetBallPath = { start: targetStart, end: targetEnd };
          segments.push({
            start: targetStart,
            end: targetEnd,
            isCuePath: false,
            isSolid: false,
            points: [targetStart, targetEnd],
          });
        }
      }

      currentPos = { ...simCue.pos };
      continue;
    }

    const cueWallHit = result.wallCollisions.some((c) => c.ballId === 0);
    if (cueWallHit) {
      bounces++;
      flushSegment({ ...simCue.pos }, false, true);
      if (bounces >= maxBounces) break;
      currentPos = { ...simCue.pos };
      continue;
    }

    const cuePocketed = result.pocketedBalls.includes(0);
    if (cuePocketed) {
      flushSegment({ ...simCue.pos }, false, true);
      willPocket.push(0);
      break;
    }

    for (const id of result.pocketedBalls) {
      if (id !== 0 && !willPocket.includes(id)) {
        willPocket.push(id);
      }
    }

    currentPos = { ...simCue.pos };

    const speed = Math.sqrt(simCue.vel.x * simCue.vel.x + simCue.vel.y * simCue.vel.y);
    if (speed < 0.05 && simCue.vel.x === 0 && simCue.vel.y === 0) {
      break;
    }
  }

  if (currentPoints.length >= 1) {
    const lastPt = currentPoints[currentPoints.length - 1];
    if (v.dist(lastPt, simCue.pos) > 1) {
      currentPoints.push({ ...simCue.pos });
    }
    if (currentPoints.length >= 2) {
      segments.push({
        start: { ...currentPoints[0] },
        end: { ...simCue.pos },
        isCuePath: true,
        isSolid: segments.length === 0,
        points: [...currentPoints],
      });
    }
  }

  if (segments.length > 0) {
    segments[0].isSolid = true;
  }

  return {
    segments,
    firstHitBallId: firstHitId,
    targetBallPath,
    willPocket,
  };
}
