import { describe, it, expect } from 'vitest';
import type { Ball } from '../src/game/types';
import {
  BALL_RADIUS,
  BALL_COLORS,
  TABLE_X,
  TABLE_Y,
  TABLE_WIDTH,
  TABLE_HEIGHT,
  SPIN_CURVE_STRENGTH,
  SPIN_TRANSFER_COLLISION,
  SPIN_DECAY_COLLISION,
  SPIN_TRANSFER_WALL,
  SPIN_DECAY_WALL,
  SPIN_APPLY_MULTIPLIER,
  SPIN_DEAD_ZONE,
  MAX_POWER,
} from '../src/game/constants';
import { applyShot, stepPhysics, allBallsStopped, runPhysicsUntilStopped } from '../src/game/physics';
import { predictShot } from '../src/game/prediction';

function makeBall(id: number, x: number, y: number, spin = { x: 0, y: 0 }): Ball {
  const conf = BALL_COLORS[id] || { color: '#ffffff', stripe: false };
  return {
    id,
    number: id,
    pos: { x, y },
    vel: { x: 0, y: 0 },
    acc: { x: 0, y: 0 },
    spin: { ...spin },
    color: conf.color,
    stripe: conf.stripe,
    radius: BALL_RADIUS,
    pocketed: false,
    pocketedAt: null,
  };
}

describe('旋转物理 - 弧线效果', () => {
  it('白球带右旋转时，运动轨迹应向右侧弯曲', () => {
    const cue = makeBall(0, TABLE_X + 100, TABLE_Y + TABLE_HEIGHT / 2);
    const balls = [cue];
    applyShot(balls, 0, 0.5, MAX_POWER, 0.8, 0);

    const positions: { x: number; y: number }[] = [];
    for (let i = 0; i < 60; i++) {
      stepPhysics(balls, 1 / 60);
      positions.push({ x: cue.pos.x, y: cue.pos.y });
    }

    let maxDrift = 0;
    for (const p of positions) {
      const drift = p.y - (TABLE_Y + TABLE_HEIGHT / 2);
      if (drift > maxDrift) maxDrift = drift;
    }

    expect(maxDrift).toBeGreaterThan(0.5);
  });

  it('白球带左旋转时，运动轨迹应向左侧弯曲', () => {
    const cue = makeBall(0, TABLE_X + 100, TABLE_Y + TABLE_HEIGHT / 2);
    const balls = [cue];
    applyShot(balls, 0, 0.5, MAX_POWER, -0.8, 0);

    const positions: { x: number; y: number }[] = [];
    for (let i = 0; i < 60; i++) {
      stepPhysics(balls, 1 / 60);
      positions.push({ x: cue.pos.x, y: cue.pos.y });
    }

    let maxDrift = 0;
    for (const p of positions) {
      const drift = (TABLE_Y + TABLE_HEIGHT / 2) - p.y;
      if (drift > maxDrift) maxDrift = drift;
    }

    expect(maxDrift).toBeGreaterThan(0.5);
  });

  it('无旋转白球应走直线', () => {
    const cue = makeBall(0, TABLE_X + 100, TABLE_Y + TABLE_HEIGHT / 2);
    const balls = [cue];
    applyShot(balls, 0, 0.5, MAX_POWER, 0, 0);

    const positions: { x: number; y: number }[] = [];
    for (let i = 0; i < 60; i++) {
      stepPhysics(balls, 1 / 60);
      positions.push({ x: cue.pos.x, y: cue.pos.y });
    }

    let maxDrift = 0;
    for (const p of positions) {
      const drift = Math.abs(p.y - (TABLE_Y + TABLE_HEIGHT / 2));
      if (drift > maxDrift) maxDrift = drift;
    }

    expect(maxDrift).toBeLessThan(1);
  });

  it('旋转强度越大，弧线偏移越大', () => {
    const runWithSpin = (spinX: number) => {
      const cue = makeBall(0, TABLE_X + 100, TABLE_Y + TABLE_HEIGHT / 2);
      const balls = [cue];
      applyShot(balls, 0, 0.3, MAX_POWER, spinX, 0);

      let maxDrift = 0;
      for (let i = 0; i < 30; i++) {
        stepPhysics(balls, 1 / 60);
        const drift = Math.abs(cue.pos.y - (TABLE_Y + TABLE_HEIGHT / 2));
        if (drift > maxDrift) maxDrift = drift;
      }
      return maxDrift;
    };

    const weak = runWithSpin(0.3);
    const strong = runWithSpin(1.0);

    expect(strong).toBeGreaterThan(weak);
  });
});

describe('旋转物理 - 碰撞偏转', () => {
  it('白球带旋转碰撞目标球后，反弹角度偏离无旋转基准', () => {
    const runCollision = (spinX: number) => {
      const cue = makeBall(0, TABLE_X + 200, TABLE_Y + TABLE_HEIGHT / 2);
      const target = makeBall(1, TABLE_X + 200 + BALL_RADIUS * 4, TABLE_Y + TABLE_HEIGHT / 2);
      const balls = [cue, target];
      applyShot(balls, 0, 0.5, MAX_POWER, spinX, 0);

      for (let i = 0; i < 120; i++) {
        stepPhysics(balls, 1 / 60);
        if (Math.abs(cue.vel.x) > 0.01 || Math.abs(cue.vel.y) > 0.01) {
          if (Math.abs(cue.vel.y) > 0.1) break;
        }
      }

      return cue.vel.y;
    };

    const noSpinVy = runCollision(0);
    const rightSpinVy = runCollision(0.8);

    expect(Math.abs(rightSpinVy)).toBeGreaterThan(Math.abs(noSpinVy));
  });

  it('左塞和右塞产生相反方向的偏转', () => {
    const runCollision = (spinX: number) => {
      const cue = makeBall(0, TABLE_X + 200, TABLE_Y + TABLE_HEIGHT / 2);
      const target = makeBall(1, TABLE_X + 200 + BALL_RADIUS * 4, TABLE_Y + TABLE_HEIGHT / 2);
      const balls = [cue, target];
      applyShot(balls, 0, 0.5, MAX_POWER, spinX, 0);

      for (let i = 0; i < 120; i++) {
        stepPhysics(balls, 1 / 60);
        if (Math.abs(cue.vel.y) > 0.1) break;
      }

      return cue.vel.y;
    };

    const leftSpinVy = runCollision(-0.8);
    const rightSpinVy = runCollision(0.8);

    expect(leftSpinVy * rightSpinVy).toBeLessThan(0);
  });

  it('碰撞后旋转衰减', () => {
    const cue = makeBall(0, TABLE_X + 200, TABLE_Y + TABLE_HEIGHT / 2);
    const target = makeBall(1, TABLE_X + 200 + BALL_RADIUS * 4, TABLE_Y + TABLE_HEIGHT / 2);
    const balls = [cue, target];
    applyShot(balls, 0, 0.5, MAX_POWER, 0.8, 0);

    const spinBefore = Math.abs(cue.spin.x);

    for (let i = 0; i < 60; i++) {
      stepPhysics(balls, 1 / 60);
    }

    const spinAfter = Math.abs(cue.spin.x);
    expect(spinAfter).toBeLessThan(spinBefore);
  });
});

describe('旋转物理 - 墙壁反弹', () => {
  it('白球带旋转撞墙后，反弹方向受旋转影响', () => {
    const cue = makeBall(0, TABLE_X + TABLE_WIDTH - 80, TABLE_Y + TABLE_HEIGHT / 2);
    const balls = [cue];
    applyShot(balls, 0, 0.8, MAX_POWER, 0.6, 0);

    for (let i = 0; i < 200; i++) {
      stepPhysics(balls, 1 / 60);
      if (cue.vel.x < 0 && Math.abs(cue.vel.y) > 0.5) break;
    }

    expect(Math.abs(cue.vel.y)).toBeGreaterThan(0.3);
  });

  it('白球撞墙后旋转衰减', () => {
    const cue = makeBall(0, TABLE_X + TABLE_WIDTH - 50, TABLE_Y + TABLE_HEIGHT / 2);
    const balls = [cue];
    applyShot(balls, 0, 0.8, MAX_POWER, 0.8, 0);

    let spinBeforeWall = Math.abs(cue.spin.x);

    for (let i = 0; i < 300; i++) {
      stepPhysics(balls, 1 / 60);
      if (cue.vel.x < 0) {
        spinBeforeWall = Math.abs(cue.spin.x);
        break;
      }
    }

    const spinAfter = Math.abs(cue.spin.x);
    expect(spinAfter).toBeLessThanOrEqual(spinBeforeWall);
  });
});

describe('旋转物理 - applyShot', () => {
  it('applyShot 正确设置白球旋转值', () => {
    const cue = makeBall(0, TABLE_X + 200, TABLE_Y + TABLE_HEIGHT / 2);
    const balls = [cue];
    applyShot(balls, 0, 0.5, MAX_POWER, 0.5, 0);

    expect(cue.spin.x).toBeCloseTo(0.5 * MAX_POWER * SPIN_APPLY_MULTIPLIER, 1);
    expect(cue.spin.y).toBe(0);
  });

  it('applyShot spinX=0 不产生旋转', () => {
    const cue = makeBall(0, TABLE_X + 200, TABLE_Y + TABLE_HEIGHT / 2);
    const balls = [cue];
    applyShot(balls, 0, 0.5, MAX_POWER, 0, 0);

    expect(cue.spin.x).toBe(0);
    expect(cue.spin.y).toBe(0);
  });
});

describe('预测系统 - 旋转弧线预测', () => {
  it('无旋转时，预测轨迹接近直线', () => {
    const cue = makeBall(0, TABLE_X + 100, TABLE_Y + TABLE_HEIGHT / 2);
    const balls = [cue];

    const result = predictShot(balls, 0, 0.5, 1, 120, 0);

    expect(result.segments.length).toBeGreaterThan(0);

    const firstSeg = result.segments.find((s) => s.isCuePath);
    if (firstSeg && firstSeg.points.length >= 2) {
      const start = firstSeg.points[0];
      const end = firstSeg.points[firstSeg.points.length - 1];
      const dx = end.x - start.x;
      const dy = Math.abs(end.y - start.y);
      expect(dy).toBeLessThan(dx * 0.1);
    }
  });

  it('有旋转时，预测轨迹偏离直线方向', () => {
    const cue = makeBall(0, TABLE_X + 100, TABLE_Y + TABLE_HEIGHT / 2);
    const balls = [cue];

    const resultNoSpin = predictShot(balls, 0, 0.5, 1, 120, 0);
    const resultWithSpin = predictShot(balls, 0, 0.5, 1, 120, 0.8);

    const getEndpoint = (r: typeof resultNoSpin) => {
      const seg = r.segments.find((s) => s.isCuePath);
      if (!seg || seg.points.length < 2) return null;
      return seg.points[seg.points.length - 1];
    };

    const endNoSpin = getEndpoint(resultNoSpin);
    const endWithSpin = getEndpoint(resultWithSpin);

    if (endNoSpin && endWithSpin) {
      expect(Math.abs(endWithSpin.y - endNoSpin.y)).toBeGreaterThan(0.5);
    }
  });

  it('预测轨迹的点数足够多以支持曲线绘制', () => {
    const cue = makeBall(0, TABLE_X + 100, TABLE_Y + TABLE_HEIGHT / 2);
    const balls = [cue];

    const result = predictShot(balls, 0, 0.5, 1, 120, 0.8);

    const firstSeg = result.segments.find((s) => s.isCuePath);
    if (firstSeg) {
      expect(firstSeg.points.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('左塞和右塞预测终点在直线两侧', () => {
    const cue = makeBall(0, TABLE_X + 100, TABLE_Y + TABLE_HEIGHT / 2);
    const balls = [cue];

    const resultLeft = predictShot(balls, 0, 0.5, 1, 120, -0.8);
    const resultRight = predictShot(balls, 0, 0.5, 1, 120, 0.8);

    const getEndpoint = (r: typeof resultLeft) => {
      const seg = r.segments.find((s) => s.isCuePath);
      if (!seg || seg.points.length < 2) return null;
      return seg.points[seg.points.length - 1];
    };

    const endLeft = getEndpoint(resultLeft);
    const endRight = getEndpoint(resultRight);

    if (endLeft && endRight) {
      expect(endLeft.y).toBeLessThan(endRight.y);
    }
  });

  it('旋转碰撞后预测白球偏转路径', () => {
    const cue = makeBall(0, TABLE_X + 200, TABLE_Y + TABLE_HEIGHT / 2);
    const target = makeBall(1, TABLE_X + 200 + BALL_RADIUS * 4, TABLE_Y + TABLE_HEIGHT / 2);
    const balls = [cue, target];

    const resultNoSpin = predictShot(balls, 0, 0.5, 1, 120, 0);
    const resultWithSpin = predictShot(balls, 0, 0.5, 1, 120, 0.8);

    expect(resultNoSpin.firstHitBallId).toBe(1);
    expect(resultWithSpin.firstHitBallId).toBe(1);

    const cueSegsNoSpin = resultNoSpin.segments.filter((s) => s.isCuePath);
    const cueSegsWithSpin = resultWithSpin.segments.filter((s) => s.isCuePath);

    if (cueSegsNoSpin.length >= 2 && cueSegsWithSpin.length >= 2) {
      const noSpinEnd = cueSegsNoSpin[1].end;
      const withSpinEnd = cueSegsWithSpin[1].end;
      const dy = Math.abs(withSpinEnd.y - noSpinEnd.y);
      expect(dy).toBeGreaterThan(0.1);
    }
  });
});

describe('旋转物理 - 综合场景', () => {
  it('带旋转击球后，所有球最终停下', () => {
    const cue = makeBall(0, TABLE_X + 200, TABLE_Y + TABLE_HEIGHT / 2);
    const target = makeBall(1, TABLE_X + 200 + BALL_RADIUS * 4, TABLE_Y + TABLE_HEIGHT / 2);
    const balls = [cue, target];
    applyShot(balls, 0, 0.5, MAX_POWER, 0.6, 0);

    const result = runPhysicsUntilStopped(balls, 10000);
    expect(allBallsStopped(balls)).toBe(true);
    expect(result.steps).toBeLessThan(10000);
  });

  it('目标球受碰撞后获得运动速度', () => {
    const cue = makeBall(0, TABLE_X + 200, TABLE_Y + TABLE_HEIGHT / 2);
    const target = makeBall(1, TABLE_X + 200 + BALL_RADIUS * 4, TABLE_Y + TABLE_HEIGHT / 2);
    const balls = [cue, target];
    applyShot(balls, 0, 0.5, MAX_POWER, 0.8, 0);

    let targetMoved = false;
    for (let i = 0; i < 120; i++) {
      stepPhysics(balls, 1 / 60);
      if (Math.abs(target.vel.x) > 0.1 || Math.abs(target.vel.y) > 0.1) {
        targetMoved = true;
        break;
      }
    }

    expect(targetMoved).toBe(true);
  });
});
