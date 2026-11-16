import { StyleSheet } from 'react-native';

import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { CalibrationMeter } from '../src/components/CalibrationMeter';

const render = (
  levelDbfs: number | null,
  thresholdDbfs: number | null,
): ReactTestRenderer => {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      <CalibrationMeter
        levelDbfs={levelDbfs}
        thresholdDbfs={thresholdDbfs}
        testID="meter"
      />,
    );
  });
  if (tree === undefined) {
    throw new Error('render failed');
  }
  return tree;
};

const styleOf = (tree: ReactTestRenderer, testID: string) => {
  const nodes = tree.root.findAll(
    node => node.props.testID === testID && node.props.style !== undefined,
  );
  return nodes.length === 0 ? null : StyleSheet.flatten(nodes[0].props.style);
};

describe('CalibrationMeter', () => {
  it('fills the bar to the level, from the floor to full scale', () => {
    expect(styleOf(render(-30, null), 'meter-fill')?.width).toBe('50%');
    expect(styleOf(render(0, null), 'meter-fill')?.width).toBe('100%');
  });

  it('draws an empty bar for no level and for one below the floor', () => {
    expect(styleOf(render(null, null), 'meter-fill')?.width).toBe('0%');
    expect(styleOf(render(-160, null), 'meter-fill')?.width).toBe('0%');
  });

  it('keeps a level above full scale at the end of the bar', () => {
    expect(styleOf(render(3, null), 'meter-fill')?.width).toBe('100%');
  });

  it('marks the threshold only when one is set', () => {
    expect(styleOf(render(-30, null), 'meter-threshold')).toBeNull();
    expect(styleOf(render(-30, -15), 'meter-threshold')?.left).toBe('75%');
  });

  it('is hidden from a screen reader, which hears the levels in words', () => {
    const tree = render(-30, -15);

    const [meter] = tree.root.findAll(
      node =>
        node.props.testID === 'meter' &&
        node.props.importantForAccessibility !== undefined,
    );
    expect(meter.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});
