import { StyleSheet } from 'react-native';

import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { SectionHeader } from '../src/components/SectionHeader';
import { Typography } from '../src/components/Typography';

const render = (header: React.ReactElement): ReactTestRenderer => {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(header);
  });
  if (tree === undefined) {
    throw new Error('render failed');
  }
  return tree;
};

/** The native view (or touchable) a `testID` lands on. */
const host = (tree: ReactTestRenderer, testID: string) =>
  tree.root.findAll(
    node => typeof node.type === 'string' && node.props.testID === testID,
  )[0];

const text = (tree: ReactTestRenderer, value: string) =>
  tree.root
    .findAllByType(Typography)
    .find(node => node.props.children === value);

describe('SectionHeader', () => {
  it('sets its title as a muted section label in capitals', () => {
    const tree = render(<SectionHeader title="Saved drills" />);
    const title = text(tree, 'Saved drills');

    expect(title?.props).toMatchObject({
      variant: 'sectionLabel',
      color: 'textSecondary',
    });
    expect(StyleSheet.flatten(title?.props.style).textTransform).toBe(
      'uppercase',
    );
  });

  it('is announced as a heading, in the words as written', () => {
    const tree = render(<SectionHeader title="Splits" />);

    // Capitals come from the style, so TalkBack reads "Splits" as a word
    // instead of spelling out S-P-L-I-T-S.
    expect(text(tree, 'SPLITS')).toBeUndefined();
    expect(text(tree, 'Splits')?.props.accessibilityRole).toBe('header');
  });

  it('draws its action as underlined Ink text in capitals', () => {
    const tree = render(
      <SectionHeader
        title="Steps"
        actionLabel="Done"
        onActionPress={jest.fn()}
      />,
    );
    const action = text(tree, 'Done');

    expect(action?.props.color).toBe('textPrimary');
    expect(StyleSheet.flatten(action?.props.style)).toMatchObject({
      textDecorationLine: 'underline',
      textTransform: 'uppercase',
    });
  });

  it('announces its action as written, or by its own label', () => {
    const asWritten = render(
      <SectionHeader
        title="Steps"
        actionLabel="Reorder"
        onActionPress={jest.fn()}
        actionTestID="action"
      />,
    );
    const labelled = render(
      <SectionHeader
        title="Steps"
        actionLabel="Done"
        actionAccessibilityLabel="Done reordering"
        onActionPress={jest.fn()}
        actionTestID="action"
      />,
    );

    expect(host(asWritten, 'action').props.accessibilityLabel).toBe('Reorder');
    expect(host(labelled, 'action').props.accessibilityLabel).toBe(
      'Done reordering',
    );
  });

  it('calls onActionPress when its action is pressed', () => {
    const onActionPress = jest.fn();
    const tree = render(
      <SectionHeader
        title="Steps"
        actionLabel="Reorder"
        onActionPress={onActionPress}
        actionTestID="action"
      />,
    );

    act(() => {
      host(tree, 'action').props.onClick();
    });

    expect(host(tree, 'action').props.accessibilityRole).toBe('button');
    expect(onActionPress).toHaveBeenCalledTimes(1);
  });

  it('shows no action without a handler', () => {
    const tree = render(
      <SectionHeader title="Steps" actionLabel="Reorder" actionTestID="a" />,
    );

    expect(host(tree, 'a')).toBeUndefined();
    expect(text(tree, 'Reorder')).toBeUndefined();
  });

  it('shows a hint opposite the title, hidden from a screen reader', () => {
    const tree = render(
      <SectionHeader
        title="Saved · 2"
        hint="Swipe left to delete"
        testID="header"
      />,
    );
    const hint = text(tree, 'Swipe left to delete');

    expect(hint?.props).toMatchObject({
      variant: 'sectionLabel',
      color: 'textSecondary',
    });
    expect(StyleSheet.flatten(hint?.props.style).textTransform).toBe(
      'uppercase',
    );
    expect(host(tree, 'header-hint').props.importantForAccessibility).toBe(
      'no-hide-descendants',
    );
  });

  it('keeps the title whole beside a hint, leaving the hint to wrap', () => {
    const tree = render(
      <SectionHeader title="Saved · 3" hint="Swipe left to delete" />,
    );

    expect(
      StyleSheet.flatten(text(tree, 'Saved · 3')?.props.style).flexShrink,
    ).toBe(0);
  });

  it('leaves the hint out when there is an action', () => {
    const tree = render(
      <SectionHeader
        title="Steps"
        hint="Swipe left to delete"
        actionLabel="Reorder"
        onActionPress={jest.fn()}
      />,
    );

    expect(text(tree, 'Swipe left to delete')).toBeUndefined();
    expect(text(tree, 'Reorder')).toBeDefined();
  });
});
