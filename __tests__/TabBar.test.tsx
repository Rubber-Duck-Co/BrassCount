import { StyleSheet } from 'react-native';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { Icon } from '../src/components/Icon';
import { Typography } from '../src/components/Typography';
import { TabBar } from '../src/navigation/TabBar';
import { lightTheme } from '../src/theme/theme';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const routes = [
  { key: 'c', name: 'Calibration' },
  { key: 'd', name: 'Drills' },
  { key: 't', name: 'Timer' },
] as const;

const titles: Record<string, string> = {
  Calibration: 'Calibrate',
  Drills: 'Drills',
  Timer: 'Timer',
};

type Navigation = {
  emit: jest.Mock;
  navigate: jest.Mock;
};

const render = (): { tree: ReactTestRenderer; navigation: Navigation } => {
  const navigation: Navigation = {
    emit: jest.fn(() => ({ defaultPrevented: false })),
    navigate: jest.fn(),
  };
  const props = {
    state: { index: 2, routes },
    descriptors: Object.fromEntries(
      routes.map(route => [
        route.key,
        { options: { title: titles[route.name] } },
      ]),
    ),
    navigation,
  } as unknown as React.ComponentProps<typeof TabBar>;

  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <TabBar {...props} />
      </SafeAreaProvider>,
    );
  });
  if (tree === undefined) {
    throw new Error('render failed');
  }
  return { tree, navigation };
};

const tabOf = (tree: ReactTestRenderer, name: string) =>
  tree.root.findAllByProps({ testID: `tab-${name}` })[0];

describe('TabBar', () => {
  it('keeps every label on one line, shrinking it rather than breaking a word', () => {
    const { tree } = render();

    const labels = tree.root.findAllByType(Typography);

    expect(labels).toHaveLength(routes.length);
    for (const label of labels) {
      expect(label.props.numberOfLines).toBe(1);
      expect(label.props.adjustsFontSizeToFit).toBe(true);
    }
  });

  it('caps how far the system font size can grow a label', () => {
    const { tree } = render();

    for (const label of tree.root.findAllByType(Typography)) {
      expect(label.props.maxFontSizeMultiplier).toBeLessThanOrEqual(1.3);
    }
  });

  it('marks only the current tab as selected', () => {
    const { tree } = render();

    expect(tabOf(tree, 'Timer').props.accessibilityState).toEqual({
      selected: true,
    });
    expect(tabOf(tree, 'Drills').props.accessibilityState).toEqual({
      selected: false,
    });
  });

  it('shows text labels only, with no icons', () => {
    const { tree } = render();

    expect(tree.root.findAllByType(Icon)).toHaveLength(0);
    expect(
      tree.root
        .findAllByType(Typography)
        .map(label => label.props.children as string),
    ).toEqual(['CALIBRATE', 'DRILLS', 'TIMER']);
  });

  it('inverts only the active tab', () => {
    const { tree } = render();
    const fill = (name: string) =>
      StyleSheet.flatten(tabOf(tree, name).props.style).backgroundColor;
    const labelColor = (name: string) =>
      tabOf(tree, name).findByType(Typography).props.color;

    expect(fill('Timer')).toBe(lightTheme.colors.inverse);
    expect(labelColor('Timer')).toBe('textOnInverse');
    expect(fill('Drills')).not.toBe(lightTheme.colors.inverse);
    expect(labelColor('Drills')).toBe('textPrimary');
  });

  it('navigates to another tab when it is pressed', () => {
    const { tree, navigation } = render();

    act(() => tabOf(tree, 'Drills').props.onPress());

    expect(navigation.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'tabPress', target: 'd' }),
    );
    expect(navigation.navigate).toHaveBeenCalledWith('Drills');
  });

  it('stays put when the current tab is pressed', () => {
    const { tree, navigation } = render();

    act(() => tabOf(tree, 'Timer').props.onPress());

    expect(navigation.navigate).not.toHaveBeenCalled();
  });
});
