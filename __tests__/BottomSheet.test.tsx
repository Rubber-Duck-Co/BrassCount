import { Modal, Text } from 'react-native';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { BottomSheet } from '../src/components/BottomSheet';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

type Options = {
  visible?: boolean;
  title?: string;
  dismissDisabled?: boolean;
};

const render = (
  onClose: () => void,
  { visible = true, title, dismissDisabled }: Options = {},
): ReactTestRenderer => {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <BottomSheet
          visible={visible}
          onClose={onClose}
          closeLabel="Close picker"
          title={title}
          dismissDisabled={dismissDisabled}
          backdropTestID="backdrop"
          closeTestID="close"
          testID="sheet"
        >
          <Text>Inside</Text>
        </BottomSheet>
      </SafeAreaProvider>,
    );
  });
  if (tree === undefined) {
    throw new Error('render failed');
  }
  return tree;
};

const byTestId = (tree: ReactTestRenderer, testID: string) =>
  tree.root.findAllByProps({ testID });

const backdrop = (tree: ReactTestRenderer) => byTestId(tree, 'backdrop')[0];
const closeButton = (tree: ReactTestRenderer) => byTestId(tree, 'close')[0];
const host = (tree: ReactTestRenderer, testID: string) =>
  tree.root.findAll(
    node => typeof node.type === 'string' && node.props.testID === testID,
  )[0];
const requestClose = (tree: ReactTestRenderer) =>
  act(() => tree.root.findByType(Modal).props.onRequestClose());

/** The host elements a screen reader focuses and reads a label for. */
const labelledHosts = (tree: ReactTestRenderer) =>
  tree.root.findAll(
    node =>
      typeof node.type === 'string' &&
      node.props.accessibilityLabel !== undefined &&
      node.props.accessible !== false &&
      node.props.importantForAccessibility !== 'no',
  );

describe('BottomSheet', () => {
  it('gives the backdrop a button role and the close label', () => {
    const tree = render(jest.fn());

    expect(backdrop(tree).props).toMatchObject({
      accessibilityRole: 'button',
      accessibilityLabel: 'Close picker',
    });
  });

  it('closes when the backdrop is pressed', () => {
    const onClose = jest.fn();
    const tree = render(onClose);

    act(() => backdrop(tree).props.onPress());

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on the system back button and Escape', () => {
    const onClose = jest.fn();
    const tree = render(onClose);

    requestClose(tree);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows its children', () => {
    const tree = render(jest.fn());

    expect(tree.root.findAllByType(Text)[0].props.children).toBe('Inside');
  });

  it('renders nothing while hidden', () => {
    const tree = render(jest.fn(), { visible: false });

    expect(tree.root.findAllByType(Text)).toHaveLength(0);
  });

  it('keeps the sheet itself out of the accessibility tree as a labelled element', () => {
    const tree = render(jest.fn());

    expect(
      labelledHosts(tree).map(node => node.props.accessibilityLabel),
    ).toEqual(['Close picker']);
  });

  it('adds no side padding or gap around an untitled sheet, which pads its own content', () => {
    const tree = render(jest.fn());

    const inside = tree.root.findAllByType(Text)[0];
    const paddedAncestors: unknown[] = [];
    for (let node = inside.parent; node !== null; node = node.parent) {
      if (typeof node.type === 'string') {
        const flat = Object.assign({}, ...[node.props.style].flat(Infinity));
        if (flat.paddingHorizontal || flat.gap) {
          paddedAncestors.push(flat);
        }
      }
    }

    expect(paddedAncestors).toEqual([]);
  });

  it('draws no title row or close button without a title', () => {
    const tree = render(jest.fn());

    expect(closeButton(tree)).toBeUndefined();
    expect(
      tree.root.findAll(node => node.props.accessibilityRole === 'header'),
    ).toHaveLength(0);
  });

  describe('with a title', () => {
    it('announces the title as a header, in sentence case', () => {
      const tree = render(jest.fn(), { title: 'Step 4 par' });

      const header = tree.root.findAll(
        node =>
          typeof node.type === 'string' &&
          node.props.accessibilityRole === 'header',
      );

      expect(header).toHaveLength(1);
      expect(header[0].props.accessibilityLabel).toBe('Step 4 par');
    });

    it('shows a close button labelled with the close label', () => {
      const tree = render(jest.fn(), { title: 'Step 4 par' });

      expect(closeButton(tree).props).toMatchObject({
        accessibilityRole: 'button',
        accessibilityLabel: 'Close picker',
      });
    });

    it('closes when the close button is pressed', () => {
      const onClose = jest.fn();
      const tree = render(onClose, { title: 'Step 4 par' });

      act(() => closeButton(tree).props.onPress());

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('reads only the title and one close button, leaving the backdrop to touch', () => {
      const tree = render(jest.fn(), { title: 'Step 4 par' });

      expect(
        labelledHosts(tree).map(node => node.props.accessibilityLabel),
      ).toEqual(['Step 4 par', 'Close picker']);
    });
  });

  describe('while dismissing is disabled', () => {
    const renderLocked = (onClose: () => void) =>
      render(onClose, { title: 'Delete?', dismissDisabled: true });

    it('ignores the backdrop, the close button and back', () => {
      const onClose = jest.fn();
      const tree = renderLocked(onClose);

      act(() => backdrop(tree).props.onPress?.());
      act(() => closeButton(tree).props.onPress?.());
      requestClose(tree);

      expect(onClose).not.toHaveBeenCalled();
    });

    it('announces the close button as disabled', () => {
      const tree = renderLocked(jest.fn());

      expect(host(tree, 'close').props.accessibilityState).toMatchObject({
        disabled: true,
      });
    });
  });
});
