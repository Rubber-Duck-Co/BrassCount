import type { ComponentProps } from 'react';

import { Dimensions, StyleSheet } from 'react-native';

import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { SaveRunPrompt } from '../src/components/SaveRunPrompt';

type Props = ComponentProps<typeof SaveRunPrompt>;

const defaults: Props = {
  completed: true,
  status: 'unsaved',
  failure: null,
  onSave: () => {},
  onDiscard: () => {},
  onView: () => {},
};

const render = (props: Partial<Props> = {}): ReactTestRenderer => {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(<SaveRunPrompt {...defaults} {...props} />);
  });
  if (tree === undefined) {
    throw new Error('render failed');
  }
  return tree;
};

const first = (tree: ReactTestRenderer, testID: string) =>
  tree.root.findAllByProps({ testID })[0];

const has = (tree: ReactTestRenderer, testID: string): boolean =>
  tree.root.findAllByProps({ testID }).length > 0;

const textsUnder = (tree: ReactTestRenderer, testID: string): string[] =>
  first(tree, testID)
    .findAll(
      node =>
        typeof node.type === 'string' &&
        typeof node.props.children === 'string',
    )
    .map(node => node.props.children);

/** Reports a new system font scale the way the OS does, as a window change. */
const setFontScale = (fontScale: number): void => {
  act(() => {
    Dimensions.set({
      window: { ...Dimensions.get('window'), fontScale },
      screen: Dimensions.get('screen'),
    });
  });
};

describe('SaveRunPrompt', () => {
  const initialWindow = Dimensions.get('window');

  afterEach(() => setFontScale(initialWindow.fontScale));

  it('makes Save run the main action, with Discard beside it', () => {
    const tree = render();

    expect(first(tree, 'btn-save-run').props).toMatchObject({
      label: 'Save run',
      variant: 'primary',
      size: 'main',
    });
    expect(first(tree, 'btn-discard-run').props).toMatchObject({
      label: 'Discard',
      variant: 'secondary',
      accessibilityLabel: 'Discard run',
    });
  });

  it('says nothing more about a completed run', () => {
    const tree = render();

    expect(has(tree, 'text-save-run-note')).toBe(false);
    expect(has(tree, 'text-save-run-error')).toBe(false);
  });

  it('says a run stopped early saves as incomplete', () => {
    const tree = render({ completed: false });

    expect(first(tree, 'text-save-run-note').props.children).toBe(
      'Saves as incomplete, left out of your best and average.',
    );
    expect(first(tree, 'btn-save-run').props).toMatchObject({
      label: 'Save run',
      accessibilityLabel: 'Save run as incomplete',
    });
  });

  it('calls back on Save and on Discard', () => {
    const onSave = jest.fn();
    const onDiscard = jest.fn();
    const tree = render({ onSave, onDiscard });

    act(() => first(tree, 'btn-save-run').props.onPress());
    act(() => first(tree, 'btn-discard-run').props.onPress());

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('turns both buttons off while saving', () => {
    const tree = render({ status: 'saving' });

    expect(first(tree, 'btn-save-run').props).toMatchObject({
      label: 'Saving…',
      busy: true,
      disabled: true,
    });
    expect(first(tree, 'btn-discard-run').props.disabled).toBe(true);
  });

  it('offers a retry when the device storage failed', () => {
    const tree = render({ failure: 'failed' });

    expect(first(tree, 'text-save-run-error').props.children).toBe(
      'Could not save this run. Try again.',
    );
    expect(first(tree, 'btn-save-run').props.disabled).toBe(false);
  });

  it('offers no retry for a run storage turned down, but can still discard it', () => {
    const tree = render({ failure: 'invalid' });

    expect(first(tree, 'text-save-run-error').props.children).toBe(
      'This run cannot be saved.',
    );
    expect(first(tree, 'btn-save-run').props.disabled).toBe(true);
    expect(first(tree, 'btn-discard-run').props.disabled).toBe(false);
  });

  it('keeps the actions side by side, Save the wider, at a normal text size', () => {
    setFontScale(1);
    const tree = render();

    const row = StyleSheet.flatten(
      first(tree, 'row-save-run-actions').props.style,
    );
    expect(row.flexDirection).toBe('row');
    const save = StyleSheet.flatten(first(tree, 'btn-save-run').props.style);
    const discard = StyleSheet.flatten(
      first(tree, 'btn-discard-run').props.style,
    );
    expect(save.flex).toBe(2);
    expect(discard.flex).toBe(1);
  });

  it('stacks its actions at a large text size', () => {
    // Jest's window has a font scale of 2.
    const tree = render();

    const row = StyleSheet.flatten(
      first(tree, 'row-save-run-actions').props.style,
    );
    expect(row.flexDirection).toBe('column');
  });

  it('says the run is saved in place of the actions, with a way to view it', () => {
    const onView = jest.fn();
    const tree = render({ status: 'saved', onView });

    expect(textsUnder(tree, 'text-run-saved')).toEqual(['Saved to History']);
    expect(has(tree, 'btn-save-run')).toBe(false);
    expect(has(tree, 'btn-discard-run')).toBe(false);

    act(() => first(tree, 'btn-view-run').props.onPress());
    expect(onView).toHaveBeenCalledTimes(1);
    expect(first(tree, 'btn-view-run').props).toMatchObject({
      accessibilityRole: 'button',
      accessibilityLabel: 'View in History',
    });
  });

  it('says a run stopped early was saved as incomplete', () => {
    const tree = render({ status: 'saved', completed: false });

    expect(textsUnder(tree, 'text-run-saved')).toEqual([
      'Saved to History as incomplete',
    ]);
  });
});
