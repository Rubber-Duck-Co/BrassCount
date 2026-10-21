import { useCallback, useState } from 'react';

import { StyleSheet, View } from 'react-native';

import { useNavigation } from '@react-navigation/native';

import type { Theme } from '@/theme/theme';
import type { AppearancePreference, LevelUnit } from '@/types/profile';
import { AppearanceSheet } from '@components/AppearanceSheet';
import { Card } from '@components/Card';
import { LEVEL_UNIT_COPY, LevelUnitSheet } from '@components/LevelUnitSheet';
import { ListRow } from '@components/ListRow';
import { Screen } from '@components/Screen';
import { SectionHeader } from '@components/SectionHeader';
import { Typography } from '@components/Typography';
import { useAppearance } from '@hooks/useAppearance';
import { useLevelUnit } from '@hooks/useLevelUnit';
import { useThemedStyles } from '@hooks/useTheme';

/** What the Appearance row says for each stored preference. */
const APPEARANCE_SUMMARY: Record<AppearancePreference, string> = {
  system: 'Follows your device setting',
  light: 'Light',
  dark: 'Dark',
};

/** What the Level units row says for each unit. */
const LEVEL_UNIT_SUMMARY: Record<LevelUnit, string> = {
  level: 'Level, 0 to 100',
  dbfs: 'dBFS, the raw reading',
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    preferenceError: {
      marginTop: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xs,
    },
  });

type SaveErrorProps = { message: string; testID: string };

/** The line under the Display card when a choice could not be saved. */
const SaveError = ({ message, testID }: SaveErrorProps) => {
  const styles = useThemedStyles(createStyles);

  return (
    <Typography
      variant="caption"
      color="danger"
      accessibilityLiveRegion="polite"
      style={styles.preferenceError}
      testID={testID}
    >
      {message}
    </Typography>
  );
};

/**
 * Track a preference picker: whether its sheet is open and whether the
 * last choice failed to save. Choosing closes the sheet and saves; the
 * preference itself rolls back on a failure, so only the error is kept
 * here.
 */
const usePreferencePicker = <T,>(save: (value: T) => Promise<void>) => {
  const [open, setOpen] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const choose = useCallback(
    (value: T) => {
      setOpen(false);
      setSaveFailed(false);
      save(value).catch(() => setSaveFailed(true));
    },
    [save],
  );

  return {
    open,
    saveFailed,
    choose,
    show: useCallback(() => setOpen(true), []),
    hide: useCallback(() => setOpen(false), []),
  };
};

/**
 * The Display section: Appearance and Level units. Each choice applies at
 * once; a save that fails puts the old value back and says so under the
 * card.
 */
const DisplaySettings = () => {
  const { preference, setPreference } = useAppearance();
  const { levelUnit, setLevelUnit } = useLevelUnit();
  const appearancePicker = usePreferencePicker(setPreference);
  const levelUnitPicker = usePreferencePicker(setLevelUnit);

  return (
    <View>
      <SectionHeader title="Display" />
      <Card flush>
        <ListRow
          title="Appearance"
          subtitle={APPEARANCE_SUMMARY[preference]}
          onPress={appearancePicker.show}
          divided
          testID="row-appearance"
        />
        <ListRow
          title="Level units"
          subtitle={LEVEL_UNIT_SUMMARY[levelUnit]}
          accessibilityLabel={`Level units, ${LEVEL_UNIT_COPY[levelUnit].spoken}`}
          onPress={levelUnitPicker.show}
          testID="row-level-unit"
        />
      </Card>
      {appearancePicker.saveFailed ? (
        <SaveError
          message="Could not save your theme. Try again."
          testID="text-appearance-error"
        />
      ) : null}
      {levelUnitPicker.saveFailed ? (
        <SaveError
          message="Could not save your level units. Try again."
          testID="text-level-unit-error"
        />
      ) : null}
      <AppearanceSheet
        visible={appearancePicker.open}
        selected={preference}
        onSelect={appearancePicker.choose}
        onClose={appearancePicker.hide}
      />
      <LevelUnitSheet
        visible={levelUnitPicker.open}
        selected={levelUnit}
        onSelect={levelUnitPicker.choose}
        onClose={levelUnitPicker.hide}
      />
    </View>
  );
};

/**
 * App preferences, pushed over the tabs from the Profile header. Grouped
 * into sections; Display is the first.
 */
export const SettingsScreen = () => {
  const navigation = useNavigation();

  return (
    <Screen
      title="Settings"
      onBack={navigation.goBack}
      scrollable
      testID="screen-settings"
    >
      <DisplaySettings />
    </Screen>
  );
};
