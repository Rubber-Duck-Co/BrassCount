import { Modal, Text } from 'react-native';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';

import { ConfirmSheet } from '../src/components/ConfirmSheet';
import { lightTheme, sizes } from '../src/theme/theme';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const SHEET = 'sheet-delete';

type Props = {
  busy?: boolean;
  error?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
};

const render = ({
  busy,
  error,
  onConfirm = jest.fn(),
  onCancel = jest.fn(),
}: Props = {}): ReactTestRenderer => {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      <SafeAreaProvider initialMetrics={metrics}>
        <ConfirmSheet
          visible
          title="Delete “Bill Drill”?"
          message="This removes the drill and every run saved with it."
          confirmLabel="Delete drill"
          busyLabel="Deleting…"
          busy={busy}
          error={error}
          onConfirm={onConfirm}
          onCancel={onCancel}
          testID={SHEET}
        />
      </SafeAreaProvider>,
    );
  });
  if (tree === undefined) {
    throw new Error('render failed');
  }
  return tree;
};

const first = (tree: ReactTestRenderer, suffix: string): ReactTestInstance =>
  tree.root.findAllByProps({ testID: `${SHEET}-${suffix}` })[0];

/** The host view a screen reader reads the control's state from. */
const host = (tree: ReactTestRenderer, suffix: string): ReactTestInstance =>
  tree.root.findAll(
    node =>
      typeof node.type === 'string' &&
      node.props.testID === `${SHEET}-${suffix}`,
  )[0];

const press = (tree: ReactTestRenderer, suffix: string) =>
  act(() => first(tree, suffix).props.onPress?.());

const textsOf = (node: ReactTestInstance): string[] =>
  node.findAllByType(Text).map(text => String(text.props.children));

const requestClose = (tree: ReactTestRenderer) =>
  act(() => tree.root.findByType(Modal).props.onRequestClose());

/** One style property of a button's host view, as it is finally drawn. */
const styleOf = (
  tree: ReactTestRenderer,
  suffix: string,
  key: string,
): unknown => {
  const flat = [host(tree, suffix).props.style].flat(Infinity) as Record<
    string,
    unknown
  >[];
  return flat.reduce<unknown>(
    (value, style) => style?.[key] ?? value,
    undefined,
  );
};

/** The fill colour of a button's host view. */
const fillOf = (tree: ReactTestRenderer, suffix: string): unknown =>
  styleOf(tree, suffix, 'backgroundColor');

describe('ConfirmSheet', () => {
  it('shows the title as a header next to a close button', () => {
    const tree = render();

    const header = tree.root.findAll(
      node =>
        typeof node.type === 'string' &&
        node.props.accessibilityRole === 'header',
    );
    expect(header.map(node => node.props.accessibilityLabel)).toEqual([
      'Delete “Bill Drill”?',
    ]);
    expect(first(tree, 'close').props).toMatchObject({
      accessibilityRole: 'button',
      accessibilityLabel: 'Close',
    });
  });

  it('shows the message', () => {
    const tree = render();

    expect(textsOf(tree.root)).toContain(
      'This removes the drill and every run saved with it.',
    );
  });

  it('calls onConfirm from the confirm button', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const tree = render({ onConfirm, onCancel });

    press(tree, 'confirm');

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it.each(['cancel', 'close', 'backdrop'])(
    'calls onCancel from the %s control',
    suffix => {
      const onCancel = jest.fn();
      const tree = render({ onCancel });

      press(tree, suffix);

      expect(onCancel).toHaveBeenCalledTimes(1);
    },
  );

  it('calls onCancel on the system back button and Escape', () => {
    const onCancel = jest.fn();
    const tree = render({ onCancel });

    requestClose(tree);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('puts Cancel on the left and the confirm button, in the primary fill, on the right', () => {
    const tree = render();

    const order = tree.root
      .findAll(
        node =>
          typeof node.type === 'string' &&
          [`${SHEET}-cancel`, `${SHEET}-confirm`].includes(node.props.testID),
      )
      .map(node => node.props.testID);

    expect(order).toEqual([`${SHEET}-cancel`, `${SHEET}-confirm`]);
    expect(fillOf(tree, 'confirm')).toBe(lightTheme.colors.primary);
  });

  it.each(['cancel', 'confirm'])(
    'makes the %s button at least the sheet action height',
    suffix => {
      const tree = render();

      expect(styleOf(tree, suffix, 'minHeight')).toBe(sizes.sheetActionMin);
    },
  );

  describe('while busy', () => {
    it('shows the busy label and announces the confirm button as busy', () => {
      const tree = render({ busy: true });

      expect(textsOf(first(tree, 'confirm'))).toEqual(['Deleting…']);
      expect(host(tree, 'confirm').props.accessibilityState).toMatchObject({
        busy: true,
      });
    });

    it('disables Cancel', () => {
      const tree = render({ busy: true });

      expect(host(tree, 'cancel').props.accessibilityState).toMatchObject({
        disabled: true,
      });
    });

    it('cannot be dismissed by close, the backdrop or back', () => {
      const onCancel = jest.fn();
      const tree = render({ busy: true, onCancel });

      press(tree, 'close');
      press(tree, 'backdrop');
      requestClose(tree);

      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  it('shows the error inside a polite live region', () => {
    const tree = render({ error: 'Could not delete Bill Drill. Try again.' });

    const region = tree.root.findAll(
      node =>
        typeof node.type === 'string' &&
        node.props.accessibilityLiveRegion === 'polite',
    );

    expect(region).toHaveLength(1);
    expect(textsOf(region[0])).toEqual([
      'Could not delete Bill Drill. Try again.',
    ]);
  });

  it('keeps the live region inside the message block, so an empty one adds no gap', () => {
    const tree = render();

    const region = tree.root.findAll(
      node =>
        typeof node.type === 'string' &&
        node.props.accessibilityLiveRegion === 'polite',
    )[0];

    let block = region.parent;
    while (block !== null && typeof block.type !== 'string') {
      block = block.parent;
    }

    const texts = textsOf(block as ReactTestInstance);
    expect(texts).toContain(
      'This removes the drill and every run saved with it.',
    );
    expect(texts).not.toContain('Cancel');
  });

  it('keeps the live region mounted with no error', () => {
    const tree = render();

    expect(
      tree.root.findAll(
        node =>
          typeof node.type === 'string' &&
          node.props.accessibilityLiveRegion === 'polite',
      ),
    ).toHaveLength(1);
    expect(first(tree, 'error')).toBeUndefined();
  });
});
