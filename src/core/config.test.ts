/**
 * Task 2.2 - Unit tests asserting all documented defaults are members of their
 * option sets / valid ranges.
 *
 * Validates: Requirements 2.5
 */

import { describe, it, expect } from 'vitest';
import type { InsulationLevel, RoomType, WindowType } from './types';
import {
  DEFAULT_ROOM_TYPE,
  DEFAULT_INSULATION,
  DEFAULT_WINDOW_TYPE,
  DEFAULT_EXTERNAL_WALLS,
  ROOM_TYPE_DEFAULT_TEMP_C,
  INSULATION_MULTIPLIER,
  WINDOW_MULTIPLIER,
  ROOM_TYPE_MULTIPLIER,
  WALL_MULTIPLIER,
} from './config';

// The canonical option sets for each categorical dimension.
const ROOM_TYPES: RoomType[] = ['Lounge', 'Bedroom', 'Kitchen', 'Bathroom', 'Hallway'];
const INSULATION_LEVELS: InsulationLevel[] = ['Poor', 'Average', 'Good'];
const WINDOW_TYPES: WindowType[] = ['Single_Glazed', 'Double_Glazed', 'Triple_Glazed'];

describe('config defaults are valid members of their option sets (Requirement 2.5)', () => {
  it('DEFAULT_ROOM_TYPE is one of the documented room types', () => {
    expect(ROOM_TYPES).toContain(DEFAULT_ROOM_TYPE);
  });

  it('DEFAULT_INSULATION is one of the documented insulation levels', () => {
    expect(INSULATION_LEVELS).toContain(DEFAULT_INSULATION);
  });

  it('DEFAULT_WINDOW_TYPE is one of the documented window types', () => {
    expect(WINDOW_TYPES).toContain(DEFAULT_WINDOW_TYPE);
  });

  it('DEFAULT_EXTERNAL_WALLS is a whole number in [0,4] and a valid index into WALL_MULTIPLIER', () => {
    expect(Number.isInteger(DEFAULT_EXTERNAL_WALLS)).toBe(true);
    expect(DEFAULT_EXTERNAL_WALLS).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_EXTERNAL_WALLS).toBeLessThanOrEqual(4);
    // Valid index into WALL_MULTIPLIER (entry must exist and be defined).
    expect(DEFAULT_EXTERNAL_WALLS).toBeLessThan(WALL_MULTIPLIER.length);
    expect(WALL_MULTIPLIER[DEFAULT_EXTERNAL_WALLS]).toBeTypeOf('number');
  });
});

describe('ROOM_TYPE_DEFAULT_TEMP_C covers every room type within [10.0, 30.0]', () => {
  it('has an entry for every room type', () => {
    expect(Object.keys(ROOM_TYPE_DEFAULT_TEMP_C).sort()).toEqual([...ROOM_TYPES].sort());
  });

  it.each(ROOM_TYPES)('default temp for %s is within [10.0, 30.0]', (roomType) => {
    const temp = ROOM_TYPE_DEFAULT_TEMP_C[roomType];
    expect(temp).toBeTypeOf('number');
    expect(Number.isFinite(temp)).toBe(true);
    expect(temp).toBeGreaterThanOrEqual(10.0);
    expect(temp).toBeLessThanOrEqual(30.0);
  });
});

describe('multiplier tables cover all options with positive numeric multipliers', () => {
  it('INSULATION_MULTIPLIER covers all insulation levels with positive values', () => {
    expect(Object.keys(INSULATION_MULTIPLIER).sort()).toEqual([...INSULATION_LEVELS].sort());
    for (const level of INSULATION_LEVELS) {
      const m = INSULATION_MULTIPLIER[level];
      expect(m).toBeTypeOf('number');
      expect(Number.isFinite(m)).toBe(true);
      expect(m).toBeGreaterThan(0);
    }
  });

  it('WINDOW_MULTIPLIER covers all window types with positive values', () => {
    expect(Object.keys(WINDOW_MULTIPLIER).sort()).toEqual([...WINDOW_TYPES].sort());
    for (const wt of WINDOW_TYPES) {
      const m = WINDOW_MULTIPLIER[wt];
      expect(m).toBeTypeOf('number');
      expect(Number.isFinite(m)).toBe(true);
      expect(m).toBeGreaterThan(0);
    }
  });

  it('ROOM_TYPE_MULTIPLIER covers all room types with positive values', () => {
    expect(Object.keys(ROOM_TYPE_MULTIPLIER).sort()).toEqual([...ROOM_TYPES].sort());
    for (const rt of ROOM_TYPES) {
      const m = ROOM_TYPE_MULTIPLIER[rt];
      expect(m).toBeTypeOf('number');
      expect(Number.isFinite(m)).toBe(true);
      expect(m).toBeGreaterThan(0);
    }
  });

  it('WALL_MULTIPLIER has positive entries for indices 0..4', () => {
    expect(WALL_MULTIPLIER.length).toBeGreaterThanOrEqual(5);
    for (let i = 0; i <= 4; i++) {
      const m = WALL_MULTIPLIER[i];
      expect(m).toBeTypeOf('number');
      expect(Number.isFinite(m)).toBe(true);
      expect(m).toBeGreaterThan(0);
    }
  });
});
