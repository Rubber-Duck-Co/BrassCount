import { useState } from 'react';

import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import type { Theme } from '@/theme/theme';
import { MAX_STEP_PAR_SECONDS } from '@/types/drill';
import { useKeyboardHeight } from '@hooks/useKeyboardHeight';
import { useThemedStyles } from '@hooks/useTheme';
import { parseParInput } from '@utils/drillDraft';
import { formatSeconds, spokenSeconds } from '@utils/format';

import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { TextField } from './TextField';
import { Typography } from './Typography';

/**
 * The most of the window's height the preset grid takes before it scrolls,
 * leaving the title row and the custom field below it on screen at a
 * large font or in landscape.
 */
const PRESET_GRID_MAX_HEIGHT_RATIO = 0.4;

/** Presets side by side in a row of the grid. */
const PRESET_COLUMNS = 3;
/**
 * Presets side by side from `TWO_COLUMN_FONT_SCALE` up: at a third of the
 * sheet a description such as "Comfortable" no longer fits on a line and
 * breaks mid-word.
 */
const LARGE_TEXT_PRESET_COLUMNS = 2;
const TWO_COLUMN_FONT_SCALE = 1.5;

type ParPreset = {
  /** `undefined` is the "No par" tile, which leaves the step untimed. */
  seconds: number | undefined;
  description?: string;
};

/** Step pars offered as one-tap tiles above the custom field. */
const PAR_PRESETS: readonly ParPreset[] = [
  { seconds: undefined, description: 'Untimed step' },
  { seconds: 0.15, description: 'Very fast split' },
  { seconds: 0.2 },
  { seconds: 0.25, description: 'Comfortable split' },
  { seconds: 0.3 },
  { seconds: 0.5, description: 'Head shot / transition' },
  { seconds: 0.75 },
  { seconds: 1.0 },
  { seconds: 1.5, description: 'Draw from concealment' },
  { seconds: 2.0, description: 'Reload' },
  { seconds: 3.0 },
];

/** The presets cut into rows of `columns`. */
const presetRows = (columns: number): (readonly ParPreset[])[] =>
  Array.from({ length: Math.ceil(PAR_PRESETS.length / columns) }, (_, row) =>
    PAR_PRESETS.slice(row * columns, (row + 1) * columns),
  );

const PRESET_ROWS = {
  [PRESET_COLUMNS]: presetRows(PRESET_COLUMNS),
  [LARGE_TEXT_PRESET_COLUMNS]: presetRows(LARGE_TEXT_PRESET_COLUMNS),
};

/** Room for the longest par that can be typed, "60.00", and one to spare. */
const CUSTOM_PAR_MAX_LENGTH = 6;

const presetLabel = (seconds: number | undefined): string =>
  seconds === undefined ? 'No par' : formatSeconds(seconds);

type ParPickerSheetProps = {
  visible: boolean;
  /** Position of the step being timed, counted from 1, for the title. */
  stepNumber: number;
  /** The step's current par in seconds; `undefined` when it is untimed. */
  par: number | undefined;
  /** Called with the par chosen, or `undefined` for "No par". */
  onSelect: (par: number | undefined) => void;
  /** Called when the sheet is dismissed without choosing. */
  onClose: () => void;
};

type ParPickerBodyProps = Pick<
  ParPickerSheetProps,
  'stepNumber' | 'par' | 'onSelect'
>;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    body: { gap: theme.spacing.inset },
    grid: { gap: theme.spacing.sm },
    gridRow: { flexDirection: 'row', gap: theme.spacing.sm },
    // A minimum height, so a description that wraps at a large font grows
    // the tile instead of clipping.
    tile: {
      flexGrow: 1,
      justifyContent: 'center',
      gap: theme.spacing.xxs,
      minHeight: theme.sizes.parTileMin,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.outline,
      borderRadius: theme.radius.none,
    },
    // The chosen par is inverted, like the active tab, so the choice does
    // not rest on a colour alone.
    tileSelected: {
      backgroundColor: theme.colors.inverse,
      borderColor: theme.colors.inverse,
    },
    // One column of the grid. Its tile pads itself inside it, so every
    // column, and the empty ones that hold a short last row open, takes
    // the same share of the row whatever padding its tile has.
    cell: { flex: 1 },
    custom: { gap: theme.spacing.xs, marginTop: theme.spacing.xs },
    customRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: theme.spacing.sm,
    },
    customField: { flex: 1 },
    set: { width: theme.sizes.parSetWidth },
  });

type PresetTileProps = {
  preset: ParPreset;
  selected: boolean;
  onSelect: (par: number | undefined) => void;
};

/** One preset par in the grid. */
const PresetTile = ({ preset, selected, onSelect }: PresetTileProps) => {
  const styles = useThemedStyles(createStyles);
  const spoken =
    preset.seconds === undefined ? 'No par' : spokenSeconds(preset.seconds);

  return (
    <Pressable
      onPress={() => onSelect(preset.seconds)}
      accessibilityRole="button"
      accessibilityLabel={
        preset.description ? `${spoken}, ${preset.description}` : spoken
      }
      accessibilityState={{ selected }}
      style={[styles.tile, selected && styles.tileSelected]}
      testID={`opt-par-${preset.seconds ?? 'none'}`}
    >
      <Typography
        variant="metricSmall"
        color={selected ? 'textOnInverse' : 'textPrimary'}
      >
        {presetLabel(preset.seconds)}
      </Typography>
      {preset.description ? (
        <Typography
          variant="caption"
          color={selected ? 'textOnInverse' : 'textSecondary'}
        >
          {preset.description}
        </Typography>
      ) : null}
    </Pressable>
  );
};

type PresetGridProps = Pick<ParPickerSheetProps, 'par' | 'onSelect'>;

/** The preset tiles, the step's par inverted, in a grid that scrolls. */
const PresetGrid = ({ par, onSelect }: PresetGridProps) => {
  const styles = useThemedStyles(createStyles);
  const { height, fontScale } = useWindowDimensions();
  const columns =
    fontScale >= TWO_COLUMN_FONT_SCALE
      ? LARGE_TEXT_PRESET_COLUMNS
      : PRESET_COLUMNS;

  // The grid can be taller than its cap at a large font, so the bar stays
  // drawn: without it nothing shows that presets lie below.
  return (
    <ScrollView
      style={{ maxHeight: height * PRESET_GRID_MAX_HEIGHT_RATIO }}
      contentContainerStyle={styles.grid}
      bounces={false}
      showsVerticalScrollIndicator
      persistentScrollbar
      testID="list-par-presets"
    >
      {PRESET_ROWS[columns].map((row, i) => (
        <View
          key={presetLabel(row[0]?.seconds)}
          style={styles.gridRow}
          testID={`row-par-preset-${i}`}
        >
          {row.map(preset => (
            <View key={presetLabel(preset.seconds)} style={styles.cell}>
              <PresetTile
                preset={preset}
                selected={preset.seconds === par}
                onSelect={onSelect}
              />
            </View>
          ))}
          {Array.from({ length: columns - row.length }, (_, spacer) => (
            <View key={`spacer-${spacer}`} style={styles.cell} />
          ))}
        </View>
      ))}
    </ScrollView>
  );
};

/**
 * What the sheet shows. A separate component so the custom field starts
 * from the step's par each time the sheet opens: the `Modal` renders
 * nothing while it is hidden, which unmounts this and its state.
 */
const ParPickerBody = ({ stepNumber, par, onSelect }: ParPickerBodyProps) => {
  const styles = useThemedStyles(createStyles);
  // The custom field is the last thing on the sheet: keep it, and Set,
  // above the keyboard it opens.
  const keyboardHeight = useKeyboardHeight();
  // Prefilled with the current par, so a small change is one keystroke.
  const [customText, setCustomText] = useState(
    par === undefined ? '' : par.toFixed(2),
  );

  const customPar = parseParInput(customText);
  const customRejected = customText.trim().length > 0 && customPar === null;

  return (
    <View style={[styles.body, { paddingBottom: keyboardHeight }]}>
      <Typography
        variant="body"
        color="textSecondary"
        testID="text-par-heading"
      >
        {stepNumber === 1
          ? 'Max time from the timer start to this step.'
          : 'Max time from the previous step to this one.'}
      </Typography>

      {/* While the keyboard is up the shooter is typing a par, and the
          grid would push the sheet's title under the status bar at a
          large font: it comes back when the keyboard goes. */}
      {keyboardHeight > 0 ? null : <PresetGrid par={par} onSelect={onSelect} />}

      <View style={styles.custom}>
        <View style={styles.customRow}>
          <View style={styles.customField}>
            <TextField
              label="Custom par · seconds"
              value={customText}
              onChangeText={setCustomText}
              placeholder="0.00"
              decimal
              onPaper
              maxLength={CUSTOM_PAR_MAX_LENGTH}
              testID="input-par-custom"
            />
          </View>
          <Button
            label="Set"
            accessibilityLabel="Set custom par"
            onPress={() => {
              if (customPar !== null) {
                onSelect(customPar);
              }
            }}
            disabled={customPar === null}
            accessibilityHint={
              customPar === null ? 'Enter a valid par time first' : undefined
            }
            style={styles.set}
            testID="btn-par-custom-set"
          />
        </View>
        {/* Always shown, so the reason "Set" is disabled is on screen
            before anything is typed; the colour only adds emphasis. */}
        <Typography
          variant="label"
          color={customRejected ? 'danger' : 'textSecondary'}
          testID="text-par-custom-hint"
        >
          {`From 0.01 to ${MAX_STEP_PAR_SECONDS} seconds.`}
        </Typography>
      </View>
    </View>
  );
};

/**
 * Bottom sheet for one step's par, on the Range Card sheet frame: a grid
 * of preset tiles, then a custom time typed to the hundredth of a second.
 * Choosing either calls `onSelect`; closing the sheet is left to the
 * caller, through `visible`.
 */
export const ParPickerSheet = ({
  visible,
  stepNumber,
  par,
  onSelect,
  onClose,
}: ParPickerSheetProps) => {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={`Step ${stepNumber} par`}
      closeLabel="Close par picker"
      backdropTestID="btn-par-backdrop"
      closeTestID="btn-par-close"
    >
      <ParPickerBody stepNumber={stepNumber} par={par} onSelect={onSelect} />
    </BottomSheet>
  );
};
