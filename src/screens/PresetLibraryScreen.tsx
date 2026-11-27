import { useCallback } from 'react';

import {
  AccessibilityInfo,
  FlatList,
  StyleSheet,
  View,
  type ListRenderItemInfo,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { Theme } from '@/theme/theme';
import type { PresetDrill } from '@/types/drill';
import type { DrillsStackParamList } from '@/types/navigation';
import { Button } from '@components/Button';
import { Icon } from '@components/Icon';
import { Screen } from '@components/Screen';
import { SectionHeader } from '@components/SectionHeader';
import { Typography } from '@components/Typography';
import { PRESET_DRILLS } from '@constants/presetDrills';
import { useAddPreset, type PresetAddStatus } from '@hooks/useAddPreset';
import { useTheme, useThemedStyles } from '@hooks/useTheme';
import { countShots, describeDrill, totalPar } from '@utils/drill';

type Nav = NativeStackNavigationProp<DrillsStackParamList, 'PresetLibrary'>;

const FOOTNOTE =
  'An added preset is your own drill: change its pars or delete it on Drills. This list stays the same.';

/** Added takes no presses; `Button` still needs a handler. */
const IGNORE_PRESS = (): void => {};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // The list scrolls to the tab bar; its own padding ends it.
    screenContent: { paddingBottom: theme.spacing.none },
    list: { flex: 1 },
    listContent: { paddingBottom: theme.spacing.gutter },
    listFooter: { paddingTop: theme.spacing.gutter },
    // The same ruled box as the Drills list: Ink down both sides, a 2px
    // rule above the first row and below the last, 1px Rule lines between.
    rowFrame: {
      backgroundColor: theme.colors.surface,
      borderLeftWidth: theme.sizes.border,
      borderRightWidth: theme.sizes.border,
      borderColor: theme.colors.outline,
    },
    firstRow: { borderTopWidth: theme.sizes.border },
    lastRow: { borderBottomWidth: theme.sizes.border },
    dividedRow: {
      borderBottomWidth: theme.sizes.rule,
      borderBottomColor: theme.colors.border,
    },
    // A minimum, so a large system font grows the row instead of clipping.
    row: {
      minHeight: theme.sizes.drillRowMin,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.inset,
      padding: theme.spacing.inset,
    },
    rowBody: { flex: 1, gap: theme.spacing.xs },
    // Capitals from the style, so a screen reader reads the name as words.
    name: { textTransform: 'uppercase' },
  });

/** A drill's totals in one line, worked out from its steps. */
const metaOf = (preset: PresetDrill): string => {
  const { steps } = preset.drill;
  return describeDrill({
    shotCount: countShots(steps),
    totalPar: totalPar(steps),
  });
};

type PresetRowProps = {
  preset: PresetDrill;
  status: PresetAddStatus;
  first: boolean;
  last: boolean;
  onAdd: (preset: PresetDrill) => void;
};

/** One preset: its name, what it is and its totals, with Add beside them. */
const PresetRow = ({ preset, status, first, last, onAdd }: PresetRowProps) => {
  const styles = useThemedStyles(createStyles);
  const { sizes } = useTheme();
  const { id, description, drill } = preset;
  const added = status === 'added';

  return (
    <View
      style={[
        styles.rowFrame,
        first && styles.firstRow,
        last ? styles.lastRow : styles.dividedRow,
      ]}
      testID={`row-preset-${id}`}
    >
      <View style={styles.row}>
        <View style={styles.rowBody}>
          <Typography
            variant="stencilSmall"
            numberOfLines={2}
            style={styles.name}
          >
            {drill.name}
          </Typography>
          <Typography variant="body">{description}</Typography>
          <Typography variant="metricCaption" color="textSecondary">
            {metaOf(preset)}
          </Typography>
          {/* Always mounted, so a reader hears the error when it appears. */}
          <View
            accessibilityLiveRegion="polite"
            testID={`region-preset-error-${id}`}
          >
            {status === 'failed' ? (
              <Typography
                variant="label"
                color="danger"
                testID={`text-preset-error-${id}`}
              >
                {`Could not add ${drill.name}. Try again.`}
              </Typography>
            ) : null}
          </View>
        </View>

        {added ? (
          <Button
            label="Added"
            variant="secondary"
            disabled
            leading={<Icon name="check" size={sizes.iconMd} color="disabled" />}
            accessibilityLabel={`${drill.name} added to your drills`}
            onPress={IGNORE_PRESS}
            testID={`btn-added-preset-${id}`}
          />
        ) : (
          <Button
            label="Add"
            variant="secondary"
            busy={status === 'adding'}
            leading={
              <Icon
                name="plus"
                size={sizes.iconMd}
                color={status === 'adding' ? 'disabled' : 'textPrimary'}
              />
            }
            accessibilityLabel={`Add ${drill.name} to your drills`}
            onPress={() => onAdd(preset)}
            testID={`btn-add-preset-${id}`}
          />
        )}
      </View>
    </View>
  );
};

const keyOfPreset = (preset: PresetDrill): string => preset.id;

/**
 * The standard drills a library can start from, pushed over the Drills
 * list. Add saves a preset as a new drill of the shooter's own and shows
 * Added in its place; the shooter stays here to add more. The list itself
 * never changes, and what was added is forgotten once the screen is left.
 */
export const PresetLibraryScreen = () => {
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation<Nav>();
  const { statusOf, add } = useAddPreset();

  const addPreset = useCallback(
    async (preset: PresetDrill) => {
      // A failure says so in its row, which speaks it as it appears.
      if ((await add(preset)) === 'added') {
        // The Add the reader was on is now a disabled Added: say so.
        AccessibilityInfo.announceForAccessibility(
          `Added ${preset.drill.name} to your drills`,
        );
      }
    },
    [add],
  );

  const lastIndex = PRESET_DRILLS.length - 1;
  const renderPreset = useCallback(
    ({ item, index }: ListRenderItemInfo<PresetDrill>) => (
      <PresetRow
        preset={item}
        status={statusOf(item.id)}
        first={index === 0}
        last={index === lastIndex}
        onAdd={addPreset}
      />
    ),
    [statusOf, lastIndex, addPreset],
  );

  return (
    <Screen
      title="Presets"
      subtitle="Standard drills to start your library"
      onBack={navigation.goBack}
      backLabel="Drills"
      contentStyle={styles.screenContent}
      testID="screen-presets"
    >
      <FlatList
        data={PRESET_DRILLS}
        keyExtractor={keyOfPreset}
        renderItem={renderPreset}
        // A row's status reaches it only through `renderItem`.
        extraData={statusOf}
        ListHeaderComponent={
          <SectionHeader
            title={`Presets · ${PRESET_DRILLS.length}`}
            hint="Add saves a copy"
            testID="header-presets"
          />
        }
        ListFooterComponent={
          <View style={styles.listFooter}>
            <Typography
              variant="body"
              color="textSecondary"
              testID="text-presets-footnote"
            >
              {FOOTNOTE}
            </Typography>
          </View>
        }
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        testID="list-presets"
      />
    </Screen>
  );
};
