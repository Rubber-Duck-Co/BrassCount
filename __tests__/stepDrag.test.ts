import type { DrillStep } from '../src/types/drill';
import {
  clampTranslation,
  dropPosition,
  edgeScrollStep,
  slotOffset,
  stepShift,
} from '../src/utils/stepDrag';

const step = (id: string, type: DrillStep['type'] = 'shot'): DrillStep => ({
  id,
  type,
});

const SHOTS = [step('a'), step('b'), step('c'), step('d')];
const OPENS_WITH_DRAW = [step('a', 'draw'), step('b'), step('c'), step('d')];
const HEIGHTS = [60, 60, 60, 60];

describe('dropPosition', () => {
  it('stays where it started until the row passes a neighbour’s middle', () => {
    const at = (translationY: number) =>
      dropPosition({
        steps: SHOTS,
        id: 'b',
        heights: HEIGHTS,
        translationY,
      });

    expect(at(0)).toBe(1);
    expect(at(29)).toBe(1);
    expect(at(-29)).toBe(1);
  });

  it('moves down one place per neighbour passed', () => {
    const at = (translationY: number) =>
      dropPosition({
        steps: SHOTS,
        id: 'a',
        heights: HEIGHTS,
        translationY,
      });

    expect(at(31)).toBe(1);
    expect(at(91)).toBe(2);
    expect(at(151)).toBe(3);
  });

  it('moves up one place per neighbour passed', () => {
    const at = (translationY: number) =>
      dropPosition({
        steps: SHOTS,
        id: 'd',
        heights: HEIGHTS,
        translationY,
      });

    expect(at(-31)).toBe(2);
    expect(at(-91)).toBe(1);
    expect(at(-151)).toBe(0);
  });

  it('stops at the ends of the list', () => {
    expect(
      dropPosition({
        steps: SHOTS,
        id: 'b',
        heights: HEIGHTS,
        translationY: -9000,
      }),
    ).toBe(0);
    expect(
      dropPosition({
        steps: SHOTS,
        id: 'b',
        heights: HEIGHTS,
        translationY: 9000,
      }),
    ).toBe(3);
  });

  it('measures rows of different heights, as large text wraps them', () => {
    const heights = [60, 200, 60, 60];
    const at = (translationY: number) =>
      dropPosition({ steps: SHOTS, id: 'a', heights, translationY });

    // Past the middle of the tall row takes more than a short row would.
    expect(at(99)).toBe(0);
    expect(at(101)).toBe(1);
  });

  it('never drops a step above an opening draw', () => {
    expect(
      dropPosition({
        steps: OPENS_WITH_DRAW,
        id: 'c',
        heights: HEIGHTS,
        translationY: -9000,
      }),
    ).toBe(1);
  });

  it('leaves an opening draw where it is', () => {
    expect(
      dropPosition({
        steps: OPENS_WITH_DRAW,
        id: 'a',
        heights: HEIGHTS,
        translationY: 9000,
      }),
    ).toBe(0);
  });

  it('counts a row not measured yet as no height, and an unknown id as -1', () => {
    expect(
      dropPosition({ steps: SHOTS, id: 'a', heights: [], translationY: 10 }),
    ).toBe(3);
    expect(
      dropPosition({
        steps: SHOTS,
        id: 'nope',
        heights: HEIGHTS,
        translationY: 0,
      }),
    ).toBe(-1);
  });
});

describe('stepShift', () => {
  it('moves the rows between up, to make room when dragging down', () => {
    const shift = (position: number) =>
      stepShift({ position, from: 0, to: 2, draggedHeight: 60 });

    expect(shift(1)).toBe(-60);
    expect(shift(2)).toBe(-60);
    expect(shift(3)).toBe(0);
  });

  it('moves the rows between down, to make room when dragging up', () => {
    const shift = (position: number) =>
      stepShift({ position, from: 3, to: 1, draggedHeight: 60 });

    expect(shift(0)).toBe(0);
    expect(shift(1)).toBe(60);
    expect(shift(2)).toBe(60);
  });

  it('leaves the dragged row itself to the finger', () => {
    expect(stepShift({ position: 1, from: 1, to: 3, draggedHeight: 60 })).toBe(
      0,
    );
  });
});

describe('slotOffset', () => {
  it('is the top of the row’s own place when nothing has moved', () => {
    expect(slotOffset({ heights: HEIGHTS, from: 1, to: 1 })).toBe(60);
  });

  it('sits where the row would land, dragging down or up', () => {
    expect(slotOffset({ heights: [60, 100, 60, 60], from: 0, to: 2 })).toBe(
      160,
    );
    expect(slotOffset({ heights: [60, 100, 60, 60], from: 3, to: 1 })).toBe(60);
  });
});

describe('clampTranslation', () => {
  it('leaves a row alone within the list', () => {
    expect(
      clampTranslation({ heights: HEIGHTS, from: 1, translationY: 40 }),
    ).toBe(40);
  });

  it('stops a row at the top of the list', () => {
    expect(
      clampTranslation({ heights: HEIGHTS, from: 1, translationY: -500 }),
    ).toBe(-60);
  });

  it('stops a row at the bottom of the list', () => {
    expect(
      clampTranslation({ heights: HEIGHTS, from: 1, translationY: 500 }),
    ).toBe(120);
    expect(
      clampTranslation({ heights: [60, 100, 40], from: 2, translationY: 500 }),
    ).toBe(0);
  });
});

describe('edgeScrollStep', () => {
  const viewport = { top: 100, bottom: 900 };
  const zone = 80;
  const maxStep = 20;

  it('does nothing away from the edges', () => {
    expect(edgeScrollStep({ fingerY: 500, viewport, zone, maxStep })).toBe(0);
    expect(edgeScrollStep({ fingerY: 180, viewport, zone, maxStep })).toBe(0);
    expect(edgeScrollStep({ fingerY: 820, viewport, zone, maxStep })).toBe(0);
  });

  it('scrolls up near the top and down near the bottom, faster further in', () => {
    expect(edgeScrollStep({ fingerY: 140, viewport, zone, maxStep })).toBe(-10);
    expect(edgeScrollStep({ fingerY: 100, viewport, zone, maxStep })).toBe(-20);
    expect(edgeScrollStep({ fingerY: 860, viewport, zone, maxStep })).toBe(10);
    expect(edgeScrollStep({ fingerY: 900, viewport, zone, maxStep })).toBe(20);
  });

  it('goes no faster than the most when the finger is past the edge', () => {
    expect(edgeScrollStep({ fingerY: 40, viewport, zone, maxStep })).toBe(-20);
    expect(edgeScrollStep({ fingerY: 990, viewport, zone, maxStep })).toBe(20);
  });
});
