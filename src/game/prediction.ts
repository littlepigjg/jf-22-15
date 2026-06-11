import type { Ball, Vec2 } from './types';
import {
  BALL_RADIUS,
  PLAYFIELD_LEFT,
  PLAYFIELD_RIGHT,
  PLAYFIELD_TOP,
  PLAYFIELD_BOTTOM,
  POCKETS,
  FRICTION,
  RESTITUTION_BALL,
  RESTITUTION_WALL,
  SPIN_CURVE_STRENGTH,
  SPIN_TRANSFER_COLLISION,
  SPIN_DECAY_COLLISION,
  SPIN_TRANSFER_WALL,
  SPIN_DECAY_WALL,
  SPIN_APPLY_MULTIPLIER,
  SPIN_DEAD_ZONE,
  MAX_POWER,
} from './constants';
import { v } from '../utils/math';

export interface PredictionSegment {
  start: Vec2;
  end: Vec2;
  isCuePath: boolean;
  isSolid: boolean;
}

export interface PredictionResult {
  segments: PredictionSegment[];
  firstHitBallId: number | null;
  targetBallPath: { start: Vec2; end: Vec2 } | null;
  willPocket: number[];
}

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

  const simCue = simBalls.find((b) => b.id === 0)!;
  const speed = cuePower * 15;
  simCue.vel.x = Math.cos(cueAngle) * speed;
  simCue.vel.y = Math.sin(cueAngle) * speed;
  simCue.spin.x = spinX * MAX_POWER * SPIN_APPLY_MULTIPLIER;
  simCue.spin.y = 0;

  let currentPos = { ...simCue.pos };
  let firstHitId: number | null = null;
  let targetBallPath: { start: Vec2; end: Vec2 } | null = null;
  let bounces = 0;

  for (let step = 0; step < maxSteps; step++) {
    if (v.len(simCue.spin) > SPIN_DEAD_ZONE) {
      const dir = v.norm(simCue.vel);
      const perpX = -dir.y;
      const perpY = dir.x;
      simCue.vel.x += perpX * simCue.spin.x * SPIN_CURVE_STRENGTH;
      simCue.vel.y += perpY * simCue.spin.x * SPIN_CURVE_STRENGTH;
      simCue.spin.x *= 0.99;
    }

    const nextPos = {
      x: currentPos.x + simCue.vel.x,
      y: currentPos.y + simCue.vel.y,
    };

    let hitBall: Ball | null = null;
    let minDist = Infinity;

    for (const other of simBalls) {
      if (other.id === 0 || other.pocketed) continue;

      const dx = nextPos.x - other.pos.x;
      const dy = nextPos.y - other.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < BALL_RADIUS * 2 - 1 && dist < minDist) {
        minDist = dist;
        hitBall = other;
      }
    }

    if (hitBall) {
      segments.push({ start: { ...currentPos }, end: { ...nextPos }, isCuePath: true, isSolid: true });

      if (firstHitId === null) {
        firstHitId = hitBall.id;

        const normal = v.norm(v.sub(nextPos, hitBall.pos));
        const tangent = { x: -normal.y, y: normal.x };
        const speedAlongNormal = v.dot(simCue.vel, normal);

        let cueSpinEffect = 0;
        if (Math.abs(simCue.spin.x) > SPIN_DEAD_ZONE) {
          cueSpinEffect = simCue.spin.x * SPIN_TRANSFER_COLLISION;
        }

        const targetVel = v.mul(normal, speedAlongNormal * 0.9);
        const targetStart = { ...hitBall.pos };
        const targetEnd = { x: targetStart.x, y: targetStart.y };
        let tv = { ...targetVel };

        for (let t = 0; t < 80; t++) {
          targetEnd.x += tv.x;
          targetEnd.y += tv.y;
          tv.x *= Math.pow(FRICTION, 1);
          tv.y *= Math.pow(FRICTION, 1);

          if (targetEnd.x - BALL_RADIUS < PLAYFIELD_LEFT || targetEnd.x + BALL_RADIUS > PLAYFIELD_RIGHT ||
              targetEnd.y - BALL_RADIUS < PLAYFIELD_TOP || targetEnd.y + BALL_RADIUS > PLAYFIELD_BOTTOM) {
            break;
          }

          for (const pocket of POCKETS) {
            if (v.dist(targetEnd, pocket.pos) < pocket.radius - BALL_RADIUS * 0.4) {
              willPocket.push(hitBall!.id);
              break;
            }
          }
        }

        targetBallPath = { start: targetStart, end: targetEnd };
        segments.push({ start: targetStart, end: targetEnd, isCuePath: false, isSolid: false });

        const spinDeflection = tangent;
        const cueReflectBase = v.sub(simCue.vel, v.mul(normal, v.dot(simCue.vel, normal) * (1 + RESTITUTION_BALL) * 0.5));
        if (Math.abs(cueSpinEffect) > SPIN_DEAD_ZONE) {
          cueReflectBase.x += spinDeflection.x * cueSpinEffect;
          cueReflectBase.y += spinDeflection.y * cueSpinEffect;
          simCue.spin.x *= SPIN_DECAY_COLLISION;
        }
        simCue.vel = cueReflectBase;
      } else {
        const normal = v.norm(v.sub(nextPos, hitBall.pos));
        simCue.vel = v.sub(simCue.vel, v.mul(normal, v.dot(simCue.vel, normal) * (1 + RESTITUTION_BALL) * 0.5));
      }

      currentPos = { ...nextPos };
      continue;
    }

    let wallHit = false;
    if (nextPos.x - BALL_RADIUS < PLAYFIELD_LEFT) {
      simCue.vel.x = -simCue.vel.x * RESTITUTION_WALL;
      nextPos.x = PLAYFIELD_LEFT + BALL_RADIUS;
      if (Math.abs(simCue.spin.x) > SPIN_DEAD_ZONE) {
        simCue.vel.y += simCue.spin.x * SPIN_TRANSFER_WALL;
        simCue.spin.x *= SPIN_DECAY_WALL;
      }
      wallHit = true;
    } else if (nextPos.x + BALL_RADIUS > PLAYFIELD_RIGHT) {
      simCue.vel.x = -simCue.vel.x * RESTITUTION_WALL;
      nextPos.x = PLAYFIELD_RIGHT - BALL_RADIUS;
      if (Math.abs(simCue.spin.x) > SPIN_DEAD_ZONE) {
        simCue.vel.y -= simCue.spin.x * SPIN_TRANSFER_WALL;
        simCue.spin.x *= SPIN_DECAY_WALL;
      }
      wallHit = true;
    }
    if (nextPos.y - BALL_RADIUS < PLAYFIELD_TOP) {
      simCue.vel.y = -simCue.vel.y * RESTITUTION_WALL;
      nextPos.y = PLAYFIELD_TOP + BALL_RADIUS;
      if (Math.abs(simCue.spin.x) > SPIN_DEAD_ZONE) {
        simCue.vel.x += simCue.spin.x * SPIN_TRANSFER_WALL;
        simCue.spin.x *= SPIN_DECAY_WALL;
      }
      wallHit = true;
    } else if (nextPos.y + BALL_RADIUS > PLAYFIELD_BOTTOM) {
      simCue.vel.y = -simCue.vel.y * RESTITUTION_WALL;
      nextPos.y = PLAYFIELD_BOTTOM - BALL_RADIUS;
      if (Math.abs(simCue.spin.x) > SPIN_DEAD_ZONE) {
        simCue.vel.x -= simCue.spin.x * SPIN_TRANSFER_WALL;
        simCue.spin.x *= SPIN_DECAY_WALL;
      }
      wallHit = true;
    }

    if (wallHit) {
      bounces++;
      segments.push({ start: { ...currentPos }, end: { ...nextPos }, isCuePath: true, isSolid: false });
      if (bounces >= maxBounces) break;
      currentPos = { ...nextPos };
      simCue.vel.x *= Math.pow(FRICTION, 2);
      simCue.vel.y *= Math.pow(FRICTION, 2);
      continue;
    }

    let pocketed = false;
    for (const pocket of POCKETS) {
      if (v.dist(nextPos, pocket.pos) < pocket.radius - BALL_RADIUS * 0.2) {
        segments.push({ start: { ...currentPos }, end: { ...nextPos }, isCuePath: true, isSolid: false });
        willPocket.push(0);
        pocketed = true;
        break;
      }
    }
    if (pocketed) break;

    currentPos = { ...nextPos };
    simCue.vel.x *= Math.pow(FRICTION, 1);
    simCue.vel.y *= Math.pow(FRICTION, 1);

    if (Math.abs(simCue.vel.x) < 0.05 && Math.abs(simCue.vel.y) < 0.05) {
      break;
    }
  }

  if (segments.length === 0 && (Math.abs(simCue.vel.x) > 0.01 || Math.abs(simCue.vel.y) > 0.01)) {
    const endPos = {
      x: currentPos.x + simCue.vel.x * 30,
      y: currentPos.y + simCue.vel.y * 30,
    };
    segments.push({ start: { ...cueBall.pos }, end: endPos, isCuePath: true, isSolid: false });
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
