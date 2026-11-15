import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { robotUnload, type PowerReport } from '../game/sim';
import { developedGame } from '../game/testing';
import { BaseView } from './base';

const powered: PowerReport = {
  generation: 5, demand: 2, shortage: false, lifeSupportPowered: true,
  running: { processor: true, robots: true, heating: false, lights: 50 },
};

function robotOf(base: BaseView): THREE.Object3D {
  let r: THREE.Object3D | null = null;
  base.group.traverse((o) => { if (o.userData.id === 'collector-robot') r = o; });
  return r!;
}

describe('collector robot trips', () => {
  it('digs, drives back loaded and unloads into the processor', () => {
    const s = developedGame();
    s.levels.collectorRobot = 1;
    s.res.regolith = 0;
    const base = new BaseView();
    base.sync(s);
    let unloads = 0;
    base.onRobotUnload = () => { unloads += 1; robotUnload(s); };
    let sawCarrying = false;
    for (let i = 0; i < 60 * 90; i++) {
      base.update(s, i / 60, 1 / 60, 0, powered);
      if (robotOf(base).userData.carrying) sawCarrying = true;
    }
    expect(sawCarrying).toBe(true);
    expect(unloads).toBeGreaterThan(0);
    expect(s.res.regolith).toBeGreaterThan(0);
  });

  it('stays put without power', () => {
    const s = developedGame();
    s.levels.collectorRobot = 1;
    const base = new BaseView();
    base.sync(s);
    const start = robotOf(base).position.clone();
    const dark = { ...powered, running: { ...powered.running, robots: false } };
    for (let i = 0; i < 600; i++) base.update(s, i / 60, 1 / 60, 0, dark);
    expect(robotOf(base).position.distanceTo(start)).toBeLessThan(0.01);
  });
});
