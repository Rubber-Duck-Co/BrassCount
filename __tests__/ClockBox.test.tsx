import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { ClockBox } from '../src/components/ClockBox';

type Props = Parameters<typeof ClockBox>[0];

const BASE: Props = {
  running: false,
  finalSeconds: null,
  parSeconds: 2.5,
  readElapsed: () => 0,
  meta: '3 SHOTS · PAR 2.50',
  caption: 'SECONDS',
};

const first = (tree: ReactTestRenderer, testID: string) =>
  tree.root.findAllByProps({ testID })[0];

const render = (props: Partial<Props> = {}): ReactTestRenderer => {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(<ClockBox {...BASE} {...props} />);
  });
  if (tree === undefined) {
    throw new Error('render failed');
  }
  return tree;
};

const figure = (tree: ReactTestRenderer) => first(tree, 'text-elapsed').props;
const caption = (tree: ReactTestRenderer) =>
  first(tree, 'text-elapsed-caption').props;

describe('ClockBox', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows zero, the caption and the meta line before a run', () => {
    const tree = render();

    expect(figure(tree).children).toBe('0.00');
    expect(caption(tree).children).toBe('SECONDS');
    expect(first(tree, 'text-clock-meta').props.children).toBe(
      '3 SHOTS · PAR 2.50',
    );
  });

  it('greys the figure while the run has not begun', () => {
    expect(figure(render({ dimmed: true })).color).toBe('disabled');
    expect(figure(render()).color).toBe('textPrimary');
  });

  it('ticks from the run clock while running, and goes back to zero after', () => {
    let now = 0;
    const tree = render({ running: true, readElapsed: () => now });

    now = 1.234;
    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(figure(tree).children).toBe('1.23');

    act(() => {
      tree.update(<ClockBox {...BASE} readElapsed={() => now} />);
    });
    expect(figure(tree).children).toBe('0.00');
  });

  it('does not call a time that reads the same as the par over it', () => {
    const tree = render({ finalSeconds: 2.504 });

    expect(caption(tree).children).toBe('SECONDS');
    expect(figure(tree).color).toBe('textPrimary');
  });

  it('turns the figure and caption to the warning colour over par', () => {
    const tree = render({ finalSeconds: 2.51, dimmed: true });

    expect(caption(tree)).toMatchObject({
      children: 'OVER PAR',
      color: 'warning',
    });
    expect(figure(tree).color).toBe('warning');
  });

  it('never calls a drill with no par over it', () => {
    const tree = render({ finalSeconds: 99, parSeconds: null });

    expect(caption(tree).children).toBe('SECONDS');
  });

  it('shrinks a long time to fit rather than clipping it', () => {
    expect(figure(render())).toMatchObject({
      numberOfLines: 1,
      adjustsFontSizeToFit: true,
    });
  });
});
