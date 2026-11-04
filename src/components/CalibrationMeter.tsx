import { StyleSheet, View } from 'react-native';

import type { Theme } from '@/theme/theme';
import { useThemedStyles } from '@hooks/useTheme';
import { MIN_SAMPLE_DBFS } from '@utils/calibration';

/**
 * dBFS range the meter is drawn against: full scale at the right end, and
 * a floor below which a sound is too quiet to be worth detecting — the
 * same level a calibration sample has to reach to count.
 */
const DBFS_METER_FLOOR = MIN_SAMPLE_DBFS;
const DBFS_METER_CEILING = 0;

type CalibrationMeterProps = {
  /** The bar: the level being heard, or the last test. `null` draws none. */
  levelDbfs: number | null;
  /** The Signal tick the bar is measured against. `null` draws none. */
  thresholdDbfs: number | null;
  /** Prefix for the fill's and the tick's testIDs. */
  testID?: string;
};

/**
 * How far along the meter a level sits, as a percentage. A level quieter
 * than the floor is still valid; it just draws at the start of the bar,
 * with the readout beside the meter carrying the real number.
 */
const meterPercent = (dbfs: number | null): `${number}%` => {
  if (dbfs === null) {
    return '0%';
  }
  const ratio =
    (dbfs - DBFS_METER_FLOOR) / (DBFS_METER_CEILING - DBFS_METER_FLOOR);
  return `${Math.min(1, Math.max(0, ratio)) * 100}%`;
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // Room above and below the track, so the tick stands proud of it.
    meter: {
      height: theme.sizes.meterHeight + theme.sizes.meterTickOverhang * 2,
      justifyContent: 'center',
    },
    track: {
      height: theme.sizes.meterHeight,
      backgroundColor: theme.colors.meterTrack,
      borderWidth: theme.sizes.rule,
      borderColor: theme.colors.outline,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      backgroundColor: theme.colors.textPrimary,
    },
    // The track's inside, where the fill is measured: the tick is placed
    // against the same width, so the two agree at every level.
    tickLane: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: theme.sizes.rule,
      right: theme.sizes.rule,
    },
    tick: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: theme.sizes.meterTick,
      // Centres the tick on its level instead of hanging it off one side.
      marginLeft: -theme.sizes.meterTick / 2,
      backgroundColor: theme.colors.warning,
    },
  });

/**
 * The Range Card level meter: an Ink bar across the track for a level,
 * and a Signal tick at the threshold it has to reach. Drawn in dBFS
 * whichever level unit is shown. It is hidden from a screen reader: the
 * row it sits in says the same levels in words.
 */
export const CalibrationMeter = ({
  levelDbfs,
  thresholdDbfs,
  testID,
}: CalibrationMeterProps) => {
  const styles = useThemedStyles(createStyles);

  return (
    <View
      style={styles.meter}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      testID={testID}
    >
      <View style={styles.track}>
        <View
          style={[styles.fill, { width: meterPercent(levelDbfs) }]}
          testID={testID ? `${testID}-fill` : undefined}
        />
      </View>
      {thresholdDbfs === null ? null : (
        <View style={styles.tickLane}>
          <View
            style={[styles.tick, { left: meterPercent(thresholdDbfs) }]}
            testID={testID ? `${testID}-threshold` : undefined}
          />
        </View>
      )}
    </View>
  );
};
