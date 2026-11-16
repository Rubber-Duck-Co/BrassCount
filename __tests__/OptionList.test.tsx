import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { Icon } from '../src/components/Icon';
import { OptionList, type OptionItem } from '../src/components/OptionList';
import { Typography } from '../src/components/Typography';

type Fruit = 'apple' | 'pear' | 'plum';

const OPTIONS: OptionItem<Fruit>[] = [
  { value: 'apple', label: 'Apple', description: 'Crisp' },
  { value: 'pear', label: 'Pear', description: 'Soft' },
  {
    value: 'plum',
    label: 'Plum',
    description: 'Tart',
    accessibilityLabel: 'Plum, the tart one',
  },
];

const render = (
  selected: Fruit,
  onSelect: (value: Fruit) => void = () => {},
): ReactTestRenderer => {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      <OptionList
        options={OPTIONS}
        selected={selected}
        onSelect={onSelect}
        testIDPrefix="opt-fruit"
      />,
    );
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

const row = (tree: ReactTestRenderer, value: Fruit) =>
  tree.root.findAllByProps({ testID: `opt-fruit-${value}` })[0];

describe('OptionList', () => {
  it('groups the options as a radio group', () => {
    const tree = render('apple');

    expect(host(tree, 'opt-fruit').props.accessibilityRole).toBe('radiogroup');
  });

  it('marks only the chosen option checked, for a screen reader', () => {
    const tree = render('pear');

    const states = OPTIONS.map(({ value }) => ({
      role: row(tree, value).props.accessibilityRole,
      checked: row(tree, value).props.accessibilityState.checked,
    }));
    expect(states).toEqual([
      { role: 'radio', checked: false },
      { role: 'radio', checked: true },
      { role: 'radio', checked: false },
    ]);
  });

  it('draws the check on the chosen row only, so the choice does not rest on colour', () => {
    const tree = render('pear');

    expect(row(tree, 'apple').findAllByType(Icon)).toHaveLength(0);
    expect(row(tree, 'plum').findAllByType(Icon)).toHaveLength(0);
    const checks = row(tree, 'pear').findAllByType(Icon);
    expect(checks.map(icon => icon.props.name)).toEqual(['check']);
  });

  it('keeps every label the same colour, never Signal, whichever is chosen', () => {
    const tree = render('pear');

    const labelColors = OPTIONS.map(
      ({ value, label }) =>
        row(tree, value)
          .findAllByType(Typography)
          .find(text => text.props.children === label)?.props.color,
    );
    expect(new Set(labelColors).size).toBe(1);
    expect(labelColors).not.toContain('primary');
  });

  it('calls onSelect with the pressed option', () => {
    const onSelect = jest.fn();
    const tree = render('apple', onSelect);

    act(() => row(tree, 'plum').props.onPress());

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('plum');
  });

  it('reads the label and description when no spoken label is given', () => {
    const tree = render('apple');

    expect(row(tree, 'apple').props.accessibilityLabel).toBe('Apple, Crisp');
  });

  it('reads the spoken label when one is given', () => {
    const tree = render('apple');

    expect(row(tree, 'plum').props.accessibilityLabel).toBe(
      'Plum, the tart one',
    );
  });

  it('shows each option with its description', () => {
    const tree = render('apple');

    const texts = row(tree, 'pear')
      .findAllByType(Typography)
      .map(text => text.props.children);
    expect(texts).toEqual(['Pear', 'Soft']);
  });
});
