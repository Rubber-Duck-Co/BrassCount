import { AccessibilityInfo, StyleSheet } from 'react-native';

import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { Icon } from '../src/components/Icon';
import {
  REFRESH_FAILED_MESSAGE,
  RefreshFailedNotice,
} from '../src/components/RefreshFailedNotice';
import { Typography } from '../src/components/Typography';
import { lightTheme, sizes } from '../src/theme/theme';

const render = (notice: React.ReactElement): ReactTestRenderer => {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(notice);
  });
  if (tree === undefined) {
    throw new Error('render failed');
  }
  return tree;
};

/** The native view the notice's `testID` lands on. */
const host = (tree: ReactTestRenderer) =>
  tree.root.findAll(
    node => typeof node.type === 'string' && node.props.testID === 'notice',
  )[0];

describe('RefreshFailedNotice', () => {
  let announce: jest.SpyInstance;

  beforeEach(() => {
    announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    announce.mockRestore();
  });

  it('is a status read as one item', () => {
    const tree = render(<RefreshFailedNotice testID="notice" />);

    expect(host(tree).props).toMatchObject({
      role: 'status',
      accessible: true,
      accessibilityLabel: REFRESH_FAILED_MESSAGE,
    });
  });

  it('says the list may be out of date, in Ink body text', () => {
    const tree = render(<RefreshFailedNotice testID="notice" />);
    const message = tree.root
      .findAllByType(Typography)
      .find(node => node.props.children === REFRESH_FAILED_MESSAGE);

    expect(message?.props).toMatchObject({
      variant: 'body',
      color: 'textPrimary',
    });
  });

  it('sits in an outlined box on the screen ground with a refresh mark', () => {
    const tree = render(<RefreshFailedNotice testID="notice" />);

    expect(StyleSheet.flatten(host(tree).props.style)).toMatchObject({
      borderWidth: sizes.border,
      borderColor: lightTheme.colors.outline,
      backgroundColor: lightTheme.colors.background,
      borderRadius: 0,
    });
    expect(tree.root.findByType(Icon).props.name).toBe('refresh');
  });

  it('announces the message once when it appears', () => {
    const tree = render(<RefreshFailedNotice testID="notice" />);
    act(() => {
      tree.update(<RefreshFailedNotice testID="notice" />);
    });

    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(REFRESH_FAILED_MESSAGE);
  });
});
