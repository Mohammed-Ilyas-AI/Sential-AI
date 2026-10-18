import { describe, expect, it } from 'vitest';
import { GlobeOrientation } from './operations-globe';

describe('GlobeOrientation', () => {
  it('stays exactly where a drag leaves it: nothing pulls it back', () => {
    const orientation = new GlobeOrientation();
    const start = { longitude: orientation.longitude, tilt: orientation.tilt };
    orientation.drag(100, -20);
    const left = { longitude: orientation.longitude, tilt: orientation.tilt };
    expect(left).toEqual({ longitude: start.longitude - 30, tilt: start.tilt - 4 });
  });

  it('turns with the arrow keys, ignores other keys and clamps the tilt', () => {
    const orientation = new GlobeOrientation();
    const start = orientation.longitude;
    expect(orientation.step('ArrowLeft')).toBe(true);
    expect(orientation.longitude).toBe(start + 10);
    expect(orientation.step('Enter')).toBe(false);
    for (let press = 0; press < 30; press += 1) orientation.step('ArrowUp');
    expect(orientation.tilt).toBe(60);
    orientation.drag(0, -10_000);
    expect(orientation.tilt).toBe(-60);
  });

  it('returns to the starting view only through the locate control', () => {
    const orientation = new GlobeOrientation();
    const start = { longitude: orientation.longitude, tilt: orientation.tilt };
    orientation.drag(50, 50);
    orientation.reset();
    expect({ longitude: orientation.longitude, tilt: orientation.tilt }).toEqual(start);
  });
});
