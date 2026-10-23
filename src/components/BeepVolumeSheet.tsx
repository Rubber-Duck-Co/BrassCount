import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import type { Theme } from '@/theme/theme';
import { BEEP_VOLUMES, type BeepVolume } from '@/types/profile';
import { useThemedStyles } from '@hooks/useTheme';

import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { Icon } from './Icon';
import { Typography } from './Typography';

type VolumeCopy = { label: string; description: string };

/** How each beep volume is named and explained. */
export const BEEP_VOLUME_COPY: Record<BeepVolume, VolumeCopy> = {
  quiet: { label: 'Quiet', description: 'A quarter of full, for indoors' },
  medium: { label: 'Medium', description: 'Half of full' },
  full: {
    label: 'Full',
    description: 'The loudest the app plays, for outdoors',
  },
};

type BeepVolumeSheetProps = {
  visible: boolean;
  /** The volume in use, marked with a check. */
  selected: BeepVolume;
  /** A volume was chosen. The sheet stays open so it can be tried. */
  onSelect: (volume: BeepVolume) => void;
  /** Play the beep at the selected volume. */
  onTestBeep: () => void;
  /**
   * Why the last choice could not be saved or the last test beep could not
   * be played, if either fell short. Shown above the buttons.
   */
  error?: string;
  /** Called by Done, the backdrop and the system back gesture. */
  onClose: () => void;
};

/** The most of the screen's height the sheet's contents take up. */
const SHEET_MAX_HEIGHT_RATIO = 0.8;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // Matches the Display pickers.
    header: {
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.sm,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md - theme.spacing.xs,
      paddingHorizontal: theme.spacing.lg,
      minHeight: 56,
    },
    optionDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    optionBody: { flex: 1, gap: 2 },
    footer: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      gap: theme.spacing.sm,
    },
  });

/**
 * Bottom sheet for the start beep's volume: Quiet, Medium or Full. Unlike
 * the Display pickers, choosing a volume leaves the sheet open, so the
 * shooter can try each one with Test beep before closing it with Done.
 */
export const BeepVolumeSheet = ({
  visible,
  selected,
  onSelect,
  onTestBeep,
  error,
  onClose,
}: BeepVolumeSheetProps) => {
  const styles = useThemedStyles(createStyles);
  const { height } = useWindowDimensions();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      closeLabel="Close beep volume picker"
      backdropTestID="btn-beep-volume-close"
    >
      {/* Scrolls when large text makes the sheet taller than the screen
          allows, so Test beep and Done stay reachable. */}
      <ScrollView style={{ maxHeight: height * SHEET_MAX_HEIGHT_RATIO }}>
        <View accessibilityRole="radiogroup">
          <View style={styles.header}>
            <Typography
              variant="overline"
              color="textSecondary"
              accessibilityRole="header"
            >
              BEEP VOLUME
            </Typography>
          </View>

          {BEEP_VOLUMES.map((volume, i) => {
            const isSelected = volume === selected;
            const copy = BEEP_VOLUME_COPY[volume];
            return (
              <Pressable
                key={volume}
                onPress={() => onSelect(volume)}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                style={[styles.option, i > 0 && styles.optionDivider]}
                testID={`opt-beep-volume-${volume}`}
              >
                <View style={styles.optionBody}>
                  <Typography
                    variant="bodyStrong"
                    color={isSelected ? 'primary' : 'textPrimary'}
                  >
                    {copy.label}
                  </Typography>
                  <Typography variant="caption" color="textTertiary">
                    {copy.description}
                  </Typography>
                </View>
                {isSelected ? (
                  <Icon name="check" size={18} color="primary" />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.footer}>
          {/* Always mounted, so a reader hears the error when it appears. */}
          <View accessibilityLiveRegion="polite">
            {error ? (
              <Typography
                variant="label"
                color="danger"
                testID="text-beep-volume-error"
              >
                {error}
              </Typography>
            ) : null}
          </View>
          <Button
            label="Test beep"
            variant="secondary"
            accessibilityLabel={`Test beep, ${BEEP_VOLUME_COPY[selected].label}`}
            onPress={onTestBeep}
            testID="btn-test-beep"
          />
          <Button
            label="Done"
            onPress={onClose}
            testID="btn-beep-volume-done"
          />
        </View>
      </ScrollView>
    </BottomSheet>
  );
};
