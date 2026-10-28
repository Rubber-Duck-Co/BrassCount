import { StyleSheet } from 'react-native';

import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { FailureNotice } from '../src/components/FailureNotice';
import { Icon } from '../src/components/Icon';
import { lightTheme } from '../src/theme/theme';

const render = (
  props: Partial<Parameters<typeof FailureNotice>[0]> = {},
): ReactTestRenderer => {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      <FailureNotice
        message="Calibrate Shot first"
        testID="notice"
        {...props}
      />,
    );
  });
  if (tree === undefined) {
    throw new Error('render failed');
  }
  return tree;
};

const first = (tree: ReactTestRenderer, testID: string) =>
  tree.root.findAllByProps({ testID })[0];

describe('FailureNotice', () => {
  it('says what went wrong, read as one line', () => {
    const tree = render();

    expect(first(tree, 'notice-message').props).toMatchObject({
      accessible: true,
      accessibilityLabel: 'Calibrate Shot first',
    });
  });

  it('is ruled in Signal, with a warning mark', () => {
    const tree = render();

    // The first match is the component itself; the box is the view inside.
    const [view] = tree.root.findAll(
      node => node.props.testID === 'notice' && node.props.style !== undefined,
    );
    const box = StyleSheet.flatten(view.props.style);
    expect(box.borderColor).toBe(lightTheme.colors.warning);
    expect(tree.root.findByType(Icon).props).toMatchObject({
      name: 'warning',
      color: 'warning',
    });
  });

  it('offers no action when there is none to take', () => {
    const tree = render();

    expect(tree.root.findAllByProps({ testID: 'btn-fix' })).toHaveLength(0);
  });

  it('offers the way out when there is one', () => {
    const onPress = jest.fn();
    const tree = render({
      action: { label: 'Go to Calibration', onPress, testID: 'btn-fix' },
    });

    act(() => first(tree, 'btn-fix').props.onPress());

    expect(first(tree, 'btn-fix').props).toMatchObject({
      label: 'Go to Calibration',
      variant: 'secondary',
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
