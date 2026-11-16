import { StyleSheet, View } from 'react-native';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { Theme } from '@/theme/theme';
import type { SetupStackParamList } from '@/types/navigation';
import {
  CALIBRATION_SOUND_TYPES,
  CalibrationSoundRow,
} from '@components/CalibrationSoundRow';
import { Card } from '@components/Card';
import { Chip } from '@components/Chip';
import { Screen } from '@components/Screen';
import { SectionHeader } from '@components/SectionHeader';
import { Typography } from '@components/Typography';
import { useCalibration } from '@hooks/useCalibration';
import { useCalibrationCapture } from '@hooks/useCalibrationCapture';
import { useThemedStyles } from '@hooks/useTheme';

type Nav = NativeStackNavigationProp<SetupStackParamList, 'Calibration'>;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    sessionBanner: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: theme.spacing.inset,
      rowGap: theme.spacing.sm,
    },
    sessionText: { flex: 1, gap: theme.spacing.xxs },
    list: { gap: theme.spacing.inset },
  });

/**
 * The Range Card Calibration screen, pushed inside the Setup tab so its
 * back link returns to Setup. A banner says the thresholds last for this
 * session (they are held in memory only), then one ruled row per sound
 * (`CalibrationSoundRow`).
 *
 * The live microphone level comes from `useCalibrationCapture` and goes
 * only to the row being listened for; it never reaches the calibration
 * store. Each level redraws this screen and that row, at most every
 * `LIVE_LEVEL_INTERVAL_MS`; the other rows are memoised and skip it.
 */
export const CalibrationScreen = () => {
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation<Nav>();
  const { state } = useCalibration();
  const { active, notice, liveLevelDbfs, recalibrate, test, cancel } =
    useCalibrationCapture();

  return (
    <Screen
      title="Calibration"
      subtitle="Tune sound detection for this session"
      onBack={navigation.goBack}
      backLabel="Setup"
      scrollable
      testID="screen-calibration"
    >
      <Card testID="card-calibration-session">
        <View
          accessible
          accessibilityLabel="Current session, active. Thresholds apply until you close the app"
          style={styles.sessionBanner}
          testID="banner-calibration-session"
        >
          <View style={styles.sessionText}>
            <Typography variant="bodyStrong">Current session</Typography>
            <Typography variant="label" color="textSecondary">
              Thresholds apply until you close the app
            </Typography>
          </View>
          <Chip
            label="Active"
            tone="inverse"
            testID="chip-calibration-session"
          />
        </View>
      </Card>

      <View>
        <SectionHeader title={`Sounds · ${CALIBRATION_SOUND_TYPES.length}`} />
        <View style={styles.list}>
          {CALIBRATION_SOUND_TYPES.map(type => {
            const listening = active?.sound === type.key;
            return (
              <CalibrationSoundRow
                key={type.key}
                type={type}
                calibration={state[type.key]}
                activeMode={listening ? active.mode : null}
                liveLevelDbfs={listening ? liveLevelDbfs : null}
                locked={active !== null && !listening}
                noticeKind={notice?.sound === type.key ? notice.kind : null}
                onRecalibrate={recalibrate}
                onTest={test}
                onCancel={cancel}
              />
            );
          })}
        </View>
      </View>
    </Screen>
  );
};
