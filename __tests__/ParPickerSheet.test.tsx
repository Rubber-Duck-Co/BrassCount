import { Dimensions, StyleSheet } from 'react-native';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { ParPickerSheet } from '../src/components/ParPickerSheet';
import { useKeyboardHeight } from '../src/hooks/useKeyboardHeight';

jest.mock('../src/hooks/useKeyboardHeight', () => ({
  useKeyboardHeight: jest.fn(() => 0),
}));

/** Not read from the window: the sheet sizes itself from `Dimensions`. */
const SCREEN_HEIGHT = 844;

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: SCREEN_HEIGHT },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const renderSheet = (): ReactTestRenderer => {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <ParPickerSheet
          visible
          stepNumber={2}
          par={undefined}
          onSelect={() => {}}
          onClose={() => {}}
        />
      </SafeAreaProvider>,
    );
  });
  if (tree === undefined) {
    throw new Error('render failed');
  }
  return tree;
};

/** The tallest the preset grid may get before it scrolls. */
const gridCap = (tree: ReactTestRenderer): number => {
  const grid = tree.root
    .findAllByProps({ testID: 'list-par-presets' })
    .find(node => node.props.style !== undefined);
  if (grid === undefined) {
    throw new Error('the preset grid is not rendered');
  }
  return StyleSheet.flatten(grid.props.style).maxHeight as number;
};

describe('ParPickerSheet', () => {
  const keyboard = jest.mocked(useKeyboardHeight);

  afterEach(() => {
    keyboard.mockReturnValue(0);
  });

  it('lets the preset grid take part of the window before it scrolls', () => {
    const cap = gridCap(renderSheet());

    expect(cap).toBeGreaterThan(0);
    expect(cap).toBeLessThan(Dimensions.get('window').height / 2);
  });

  it('hides the presets while the keyboard is up, so the sheet fits under the status bar', () => {
    keyboard.mockReturnValue(300);

    const tree = renderSheet();

    expect(
      tree.root.findAllByProps({ testID: 'list-par-presets' }),
    ).toHaveLength(0);
    expect(
      tree.root.findAllByProps({ testID: 'input-par-custom' }).length,
    ).toBeGreaterThan(0);
  });

  it('shows the presets again once the keyboard is down', () => {
    keyboard.mockReturnValue(300);
    const tree = renderSheet();

    keyboard.mockReturnValue(0);
    act(() => {
      tree.update(
        <SafeAreaProvider initialMetrics={metrics}>
          <ParPickerSheet
            visible
            stepNumber={2}
            par={undefined}
            onSelect={() => {}}
            onClose={() => {}}
          />
        </SafeAreaProvider>,
      );
    });

    expect(gridCap(tree)).toBeGreaterThan(0);
  });

  describe('how many presets sit side by side', () => {
    /** How many presets each row of the grid holds, top to bottom. */
    const rowSizes = (tree: ReactTestRenderer): number[] => {
      const sizes: number[] = [];
      for (let row = 0; ; row += 1) {
        const [node] = tree.root.findAllByProps({
          testID: `row-par-preset-${row}`,
        });
        if (node === undefined) {
          return sizes;
        }
        const presets = new Set(
          node
            .findAll(
              child =>
                typeof child.props.testID === 'string' &&
                child.props.testID.startsWith('opt-par-'),
            )
            .map(child => child.props.testID as string),
        );
        sizes.push(presets.size);
      }
    };

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('lays the presets out three to a row at the default text size', () => {
      const window = Dimensions.get('window');
      jest
        .spyOn(Dimensions, 'get')
        .mockReturnValue({ ...window, fontScale: 1 });

      expect(rowSizes(renderSheet())).toEqual([3, 3, 3, 2]);
    });

    it('lays them out two to a row at a large font, so no word breaks', () => {
      const window = Dimensions.get('window');
      jest
        .spyOn(Dimensions, 'get')
        .mockReturnValue({ ...window, fontScale: 2 });

      expect(rowSizes(renderSheet())).toEqual([2, 2, 2, 2, 2, 1]);
    });
  });
});
