import type { NavigatorScreenParams } from '@react-navigation/native';

/**
 * The root stack holds only the tabs: every screen lives inside a tab's
 * stack, so the tab bar stays visible at any depth.
 */
export type RootStackParamList = {
  Tabs: NavigatorScreenParams<MainTabParamList>;
};

/**
 * Left to right as the tab bar shows them; Timer is the landing tab. A tab
 * opened without naming a screen shows whatever its stack last showed.
 */
export type MainTabParamList = {
  /**
   * `drillId` is the drill a Load on the Drills tab puts on the timer. The
   * Timer clears it once used, so it never overrides a later pick.
   */
  Timer: { drillId?: string } | undefined;
  Drills: NavigatorScreenParams<DrillsStackParamList> | undefined;
  Log: NavigatorScreenParams<LogStackParamList> | undefined;
  Setup: NavigatorScreenParams<SetupStackParamList> | undefined;
};

/** The Drills tab: the library, and the editor pushed over it. */
export type DrillsStackParamList = {
  DrillList: undefined;
  /** Omit `id` to build a new sequence. */
  SequenceEditor: { id?: string };
};

/**
 * The Log tab: drills that have been run, one drill's runs, and two of
 * them compared.
 */
export type LogStackParamList = {
  HistoryList: undefined;
  /** Runs recorded for a single drill. */
  HistoryDetail: { drillId: string; drillName: string };
  /**
   * Two runs of one drill, side by side, in either order. `drillName` is
   * shown until the drill itself has been read.
   */
  RunComparison: {
    drillId: string;
    runIds: [string, string];
    drillName?: string;
  };
};

/**
 * The Setup tab: the profile and every setting, with Calibration pushed
 * over it.
 */
export type SetupStackParamList = {
  SetupHome: undefined;
  Calibration: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
