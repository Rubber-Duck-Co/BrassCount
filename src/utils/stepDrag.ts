import type { DrillStep } from '@/types/drill';

import { canMoveStep } from './drillDraft';

/**
 * The maths of dragging a step up or down the drill editor's list, kept
 * apart from the gesture so it can be tested. Heights come from measuring
 * the rows, since large text makes some taller than others. Everything is
 * measured from where the rows sat when the drag began: they are moved out
 * of the way with transforms, so their layout does not change until the
 * step is dropped.
 */

/** How long a row takes to slide aside, or into its place when dropped. */
export const STEP_DRAG_SETTLE_MS = 120;

const heightAt = (heights: readonly number[], position: number): number =>
  heights[position] ?? 0;

/** How far down the list the row at `position` starts. */
const topOf = (heights: readonly number[], position: number): number =>
  heights.slice(0, position).reduce((sum, height) => sum + height, 0);

/**
 * Which position, counted from 0, the dragged step would take if let go
 * now, or -1 if it is not in the list. The step passes a neighbour once its
 * leading edge is past the neighbour's middle, and it stops at the nearest
 * place `canMoveStep` allows, so it never lands above an opening draw.
 */
export const dropPosition = ({
  steps,
  id,
  heights,
  translationY,
}: {
  steps: readonly DrillStep[];
  id: string;
  heights: readonly number[];
  translationY: number;
}): number => {
  const from = steps.findIndex(step => step.id === id);
  if (from < 0) {
    return -1;
  }
  const middleOf = (position: number): number =>
    topOf(heights, position) + heightAt(heights, position) / 2;
  const top = topOf(heights, from) + translationY;
  const bottom = top + heightAt(heights, from);

  let to = from;
  for (let i = from + 1; i < steps.length && bottom > middleOf(i); i += 1) {
    to = i;
  }
  for (let i = from - 1; i >= 0 && top < middleOf(i); i -= 1) {
    to = i;
  }

  const towardsStart = to > from ? -1 : 1;
  while (to !== from && !canMoveStep(steps, id, to)) {
    to += towardsStart;
  }
  return to;
};

/**
 * How far the row at `position` moves aside while the dragged step would
 * land at `to`: the rows between close up behind it and open up ahead of it.
 */
export const stepShift = ({
  position,
  from,
  to,
  draggedHeight,
}: {
  position: number;
  from: number;
  to: number;
  draggedHeight: number;
}): number => {
  if (position > from && position <= to) {
    return -draggedHeight;
  }
  if (position < from && position >= to) {
    return draggedHeight;
  }
  return 0;
};

/** How far down the list the dragged step would land at `to`. */
export const slotOffset = ({
  heights,
  from,
  to,
}: {
  heights: readonly number[];
  from: number;
  to: number;
}): number => {
  const others = heights.filter((_, position) => position !== from);
  return topOf(others, to);
};

/**
 * How many points to scroll this frame with the finger at `fingerY`: none
 * outside the `zone` at each edge of the viewport, then faster the nearer
 * the edge, up to `maxStep`. Negative scrolls up.
 */
export const edgeScrollStep = ({
  fingerY,
  viewport,
  zone,
  maxStep,
}: {
  fingerY: number;
  viewport: { top: number; bottom: number };
  zone: number;
  maxStep: number;
}): number => {
  const intoTop = viewport.top + zone - fingerY;
  if (intoTop > 0) {
    return -maxStep * Math.min(intoTop / zone, 1);
  }
  const intoBottom = fingerY - (viewport.bottom - zone);
  if (intoBottom > 0) {
    return maxStep * Math.min(intoBottom / zone, 1);
  }
  return 0;
};

/**
 * `translationY` kept to the list, so the row stays on it however far the
 * finger goes, and never over what comes before or after it.
 */
export const clampTranslation = ({
  heights,
  from,
  translationY,
}: {
  heights: readonly number[];
  from: number;
  translationY: number;
}): number => {
  const top = topOf(heights, from);
  const lowest = topOf(heights, heights.length) - heightAt(heights, from) - top;
  return Math.min(lowest, Math.max(-top, translationY));
};

/** The distance from the top of the row at `from` to its landing place. */
export const dropTranslation = ({
  heights,
  from,
  to,
}: {
  heights: readonly number[];
  from: number;
  to: number;
}): number => slotOffset({ heights, from, to }) - topOf(heights, from);
