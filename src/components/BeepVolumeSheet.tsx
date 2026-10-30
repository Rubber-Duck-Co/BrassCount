import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import type { Theme } from '@/theme/theme';
import { BEEP_VOLUMES, type BeepVolume } from '@/types/profile';
import { useThemedStyles } from '@hooks/useTheme';

import { BottomSheet, SHEET_CONTENT_MAX_HEIGHT_RATIO } from './BottomSheet';
import { Button } from './Button';
import { OptionList, type OptionCopy } from './OptionList';
import { Typography } from './Typography';

/** How each beep volume is named and explained. */
export const BEEP_VOLUME_COPY: Record<BeepVolume, OptionCopy> = {
  quiet: { label: 'Quiet', description: 'A quarter of full, for indoors' },
  medium: { label: 'Medium', description: 'Half of full' },
  full: {
    label: 'Full',
    description: 'The loudest the app plays, for outdoors',
  },
};

const BEEP_VOLUME_OPTIONS = BEEP_VOLUMES.map(value => ({
  value,
  ...BEEP_VOLUME_COPY[value],
}));

type BeepVolumeSheetProps = {
  visible: boolean;
  /** The volume in use, ticked. */
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
  /** Called by Done, the close button, the backdrop and back. */
  onClose: () => void;
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: { gap: theme.spacing.inset },
    // Side by side, like a confirm sheet's Cancel and confirm.
    actions: {
      flexDirection: 'row',
      gap: theme.spacing.inset,
      marginTop: theme.spacing.inset,
    },
    action: { flex: 1, minHeight: theme.sizes.sheetActionMin },
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
      title="Beep volume"
      closeTestID="btn-beep-volume-close"
      backdropTestID="btn-beep-volume-backdrop"
    >
      {/* Scrolls when large text makes the sheet taller than the screen
          allows, so Test beep and Done stay reachable. */}
      <ScrollView
        style={{ maxHeight: height * SHEET_CONTENT_MAX_HEIGHT_RATIO }}
        contentContainerStyle={styles.content}
        bounces={false}
      >
        <OptionList
          options={BEEP_VOLUME_OPTIONS}
          selected={selected}
          onSelect={onSelect}
          testIDPrefix="opt-beep-volume"
        />

        {/* One block, so the empty live region adds no gap of its own. */}
        <View>
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

          <View style={styles.actions}>
            <Button
              label="Test beep"
              variant="secondary"
              accessibilityLabel={`Test beep, ${BEEP_VOLUME_COPY[selected].label}`}
              onPress={onTestBeep}
              style={styles.action}
              testID="btn-test-beep"
            />
            <Button
              label="Done"
              variant="primary"
              onPress={onClose}
              style={styles.action}
              testID="btn-beep-volume-done"
            />
          </View>
        </View>
      </ScrollView>
    </BottomSheet>
  );
};
