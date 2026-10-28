import { StyleSheet } from 'react-native';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { BottomSheet } from '../src/components/BottomSheet';
import { Icon } from '../src/components/Icon';
import { Select, SelectSheet } from '../src/components/Select';
import { sizes } from '../src/theme/theme';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const options = [
  { value: 'a', label: 'Alpha', description: '6 shots · Par 3.30s' },
  { value: 'b', label: 'Bravo' },
] as const;

const render = (onChange: (next: string) => void): ReactTestRenderer => {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <Select
          value="a"
          options={[...options]}
          onChange={onChange}
          testID="pick"
        />
      </SafeAreaProvider>,
    );
  });
  if (tree === undefined) {
    throw new Error('render failed');
  }
  return tree;
};

/** The pressable a `testID` lands on; the same id also sits on parent elements. */
const first = (tree: ReactTestRenderer, testID: string) =>
  tree.root.findAll(
    node => node.props.testID === testID && node.props.onPress !== undefined,
  )[0];

/** Any node carrying the id, for checking what the sheet announces. */
const announced = (tree: ReactTestRenderer, testID: string) =>
  tree.root.findAll(
    node =>
      node.props.testID === testID &&
      node.props.accessibilityRole !== undefined,
  )[0];

describe('Select', () => {
  it('closes from its backdrop, which is announced as a Close button', () => {
    const tree = render(jest.fn());
    act(() => first(tree, 'pick').props.onPress());

    expect(announced(tree, 'pick-backdrop').props).toMatchObject({
      accessibilityRole: 'button',
      accessibilityLabel: 'Close',
    });

    act(() => first(tree, 'pick-backdrop').props.onPress());

    expect(
      tree.root.findAll(node => node.props.testID === 'pick-option-b'),
    ).toHaveLength(0);
  });

  it('reports the chosen option and closes', () => {
    const onChange = jest.fn();
    const tree = render(onChange);
    act(() => first(tree, 'pick').props.onPress());

    act(() => first(tree, 'pick-option-b').props.onPress());

    expect(onChange).toHaveBeenCalledWith('b');
    expect(
      tree.root.findAll(node => node.props.testID === 'pick-option-b'),
    ).toHaveLength(0);
  });
});

describe('SelectSheet', () => {
  const renderSheet = (
    onChoose: (next: string) => void,
    { figureDescriptions = false }: { figureDescriptions?: boolean } = {},
  ) => {
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(
        <SafeAreaProvider initialMetrics={metrics}>
          <SelectSheet
            visible
            onClose={jest.fn()}
            value="a"
            options={[...options]}
            onChoose={onChoose}
            title="Drill"
            figureDescriptions={figureDescriptions}
            testID="sheet"
          />
        </SafeAreaProvider>,
      );
    });
    if (tree === undefined) {
      throw new Error('render failed');
    }
    return tree;
  };

  it('marks the chosen option as selected', () => {
    const tree = renderSheet(jest.fn());

    expect(announced(tree, 'sheet-option-a').props.accessibilityState).toEqual({
      selected: true,
    });
    expect(announced(tree, 'sheet-option-b').props.accessibilityState).toEqual({
      selected: false,
    });
  });

  it('reports the option pressed', () => {
    const onChoose = jest.fn();
    const tree = renderSheet(onChoose);

    act(() => first(tree, 'sheet-option-b').props.onPress());

    expect(onChoose).toHaveBeenCalledWith('b');
  });

  it('sits on the titled sheet frame, closed from its own close button', () => {
    const tree = renderSheet(jest.fn());

    expect(tree.root.findByType(BottomSheet).props.title).toBe('Drill');
    expect(announced(tree, 'sheet-close').props).toMatchObject({
      accessibilityRole: 'button',
      accessibilityLabel: 'Close',
    });
  });

  it('lists the options in a ruled box, each a full-height row', () => {
    const tree = renderSheet(jest.fn());

    const box = StyleSheet.flatten(
      tree.root.findAll(
        node =>
          node.props.testID === 'sheet-options' &&
          node.props.style !== undefined,
      )[0].props.style,
    );
    expect(box.borderWidth).toBe(sizes.border);
    const row = StyleSheet.flatten(
      announced(tree, 'sheet-option-b').props.style,
    );
    expect(row.minHeight).toBe(sizes.sheetRowMin);
  });

  it('ticks the chosen option in Signal', () => {
    const tree = renderSheet(jest.fn());

    const ticks = tree.root
      .findAllByType(Icon)
      .filter(icon => icon.props.name === 'check');
    expect(ticks).toHaveLength(1);
    expect(ticks[0].props).toMatchObject({ name: 'check', color: 'primary' });
  });

  it('sets the descriptions in Plex Mono when they are figures', () => {
    const plain = renderSheet(jest.fn());
    const figures = renderSheet(jest.fn(), { figureDescriptions: true });

    const variantOf = (tree: ReactTestRenderer) =>
      tree.root.findAll(
        node =>
          node.props.children === '6 shots · Par 3.30s' &&
          node.props.variant !== undefined,
      )[0].props.variant;
    expect(variantOf(plain)).toBe('caption');
    expect(variantOf(figures)).toBe('metricCaption');
  });
});
