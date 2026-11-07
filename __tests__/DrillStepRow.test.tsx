import { AccessibilityInfo } from 'react-native';

import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';

import { DrillStepRow } from '../src/components/DrillStepRow';
import { Icon } from '../src/components/Icon';
import type { DrillStep } from '../src/types/drill';

type RowProps = Parameters<typeof DrillStepRow>[0];

const SHOT: DrillStep = { id: 'step-b', type: 'shot', par: 0.25 };

const handlers = () => ({
  onEditType: jest.fn<void, [string]>(),
  onEditPar: jest.fn<void, [string]>(),
  onRemove: jest.fn<void, [string]>(),
  onMove: jest.fn<void, [string, number]>(),
});

const renderRow = (props: Partial<RowProps> = {}) => {
  const callbacks = handlers();
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      <DrillStepRow
        step={SHOT}
        position={1}
        canMoveUp
        canMoveDown
        label="Shot 1"
        labelMinWidth={112}
        {...callbacks}
        {...props}
      />,
    );
  });
  if (tree === undefined) {
    throw new Error('render failed');
  }
  return { tree, ...callbacks };
};

const byTestId = (tree: ReactTestRenderer, testID: string) =>
  tree.root.findAllByProps({ testID });

const has = (tree: ReactTestRenderer, testID: string): boolean =>
  byTestId(tree, testID).length > 0;

/** The element with this `testID` that takes presses. */
const pressable = (
  tree: ReactTestRenderer,
  testID: string,
): ReactTestInstance => {
  const node = byTestId(tree, testID).find(
    candidate => candidate.props.onPress !== undefined,
  );
  if (node === undefined) {
    throw new Error(`nothing pressable is rendered for "${testID}"`);
  }
  return node;
};

const press = (tree: ReactTestRenderer, testID: string) => {
  act(() => {
    pressable(tree, testID).props.onPress();
  });
};

/** Every string rendered under `node`, in the order it is shown. */
const textsUnder = (node: ReactTestInstance): string[] =>
  node.children.flatMap(child =>
    typeof child === 'string' ? [child] : textsUnder(child),
  );

const textOf = (tree: ReactTestRenderer, testID: string): string =>
  textsUnder(pressable(tree, testID)).join('');

describe('DrillStepRow', () => {
  let announce: jest.SpyInstance;

  beforeEach(() => {
    announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    announce.mockRestore();
  });

  it('shows what the step is called and what its type means', () => {
    const { tree } = renderRow();

    expect(textOf(tree, 'select-step-1')).toBe('Shot 1One round downrange');
  });

  it('offers to change the type, naming the step by number', () => {
    const { tree } = renderRow();

    const trigger = pressable(tree, 'select-step-1');
    expect(trigger.props.accessibilityRole).toBe('button');
    expect(trigger.props.accessibilityLabel).toBe(
      'Step 2, Shot 1. Change type',
    );
  });

  it('asks for the type of its own step when its name is pressed', () => {
    const { tree, onEditType } = renderRow();

    press(tree, 'select-step-1');

    expect(onEditType).toHaveBeenCalledWith('step-b');
  });

  it('asks for the par of its own step when the par is pressed', () => {
    const { tree, onEditPar } = renderRow();

    press(tree, 'btn-par-step-1');

    expect(onEditPar).toHaveBeenCalledWith('step-b');
  });

  it('shows a set par to the hundredth and says it in words', () => {
    const { tree } = renderRow();

    expect(textOf(tree, 'btn-par-step-1')).toBe('0.25s');
    expect(pressable(tree, 'btn-par-step-1').props.accessibilityLabel).toBe(
      'Change par for step 2, currently 0.25 seconds',
    );
  });

  it('offers a par for an untimed step', () => {
    const { tree } = renderRow({ step: { id: 'step-b', type: 'shot' } });

    expect(textOf(tree, 'btn-par-step-1')).toBe('+ par');
    expect(pressable(tree, 'btn-par-step-1').props.accessibilityLabel).toBe(
      'Set par for step 2',
    );
  });

  it('removes its own step and tells a screen reader which', () => {
    const { tree, onRemove } = renderRow();

    const remove = pressable(tree, 'btn-remove-step-1');
    expect(remove.props.accessibilityLabel).toBe('Remove step 2, Shot 1');
    press(tree, 'btn-remove-step-1');

    expect(onRemove).toHaveBeenCalledWith('step-b');
    expect(announce).toHaveBeenCalledWith('Removed step 2, Shot 1');
  });

  /** The move actions a screen reader is offered on the step's name. */
  const moveActions = (tree: ReactTestRenderer): string[] =>
    pressable(tree, 'select-step-1').props.accessibilityActions.map(
      (action: { label: string }) => action.label,
    );

  const hasGrip = (tree: ReactTestRenderer, position = 1): boolean =>
    tree.root
      .findAllByProps({ testID: `grip-step-${position}` })[0]
      .findAllByType(Icon).length > 0;

  it('keeps its par and remove controls, with no move buttons', () => {
    const { tree } = renderRow();

    expect(has(tree, 'btn-par-step-1')).toBe(true);
    expect(has(tree, 'btn-remove-step-1')).toBe(true);
    expect(has(tree, 'btn-move-up-step-1')).toBe(false);
    expect(has(tree, 'btn-move-down-step-1')).toBe(false);
  });

  it('offers a screen reader a move each way', () => {
    const { tree } = renderRow();

    expect(moveActions(tree)).toEqual(['Move up', 'Move down']);
  });

  it('offers no move up to a step that cannot go up', () => {
    const { tree } = renderRow({ canMoveUp: false });

    expect(moveActions(tree)).toEqual(['Move down']);
  });

  it('offers no move down to a step that cannot go down', () => {
    const { tree } = renderRow({ canMoveDown: false });

    expect(moveActions(tree)).toEqual(['Move up']);
  });

  it('moves its step from the action and says where it went', () => {
    const { tree, onMove } = renderRow();

    act(() =>
      pressable(tree, 'select-step-1').props.onAccessibilityAction({
        nativeEvent: { actionName: 'moveDown' },
      }),
    );

    expect(onMove).toHaveBeenCalledWith('step-b', 2);
    expect(announce).toHaveBeenCalledWith(
      'Moved step 2, Shot 1, down to step 3',
    );
  });

  it('ignores an action that is not a move', () => {
    const { tree, onMove } = renderRow();

    act(() =>
      pressable(tree, 'select-step-1').props.onAccessibilityAction({
        nativeEvent: { actionName: 'activate' },
      }),
    );

    expect(onMove).not.toHaveBeenCalled();
    expect(announce).not.toHaveBeenCalled();
  });

  it('leaves a double-tap to open the type sheet', () => {
    const { tree } = renderRow();

    // Claiming `activate` would route TalkBack's double-tap to the action
    // handler instead of the press, so the row offers the moves alone.
    expect(
      pressable(tree, 'select-step-1').props.accessibilityActions.map(
        (offered: { name: string }) => offered.name,
      ),
    ).toEqual(['moveUp', 'moveDown']);
  });

  it('shows a grip only on a step that can move', () => {
    expect(hasGrip(renderRow().tree)).toBe(true);
    expect(
      hasGrip(renderRow({ canMoveUp: false, canMoveDown: false }).tree),
    ).toBe(false);
  });

  it('hands the screen its remove button, and takes it back when it goes', () => {
    const registerRemove = jest.fn();
    const { tree } = renderRow({ registerRemove });

    expect(registerRemove).toHaveBeenLastCalledWith(
      'step-b',
      expect.anything(),
    );

    act(() => {
      tree.unmount();
    });
    expect(registerRemove).toHaveBeenLastCalledWith('step-b', null);
  });
});
