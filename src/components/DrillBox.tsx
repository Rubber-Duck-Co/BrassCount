import { useState } from 'react';

import { StyleSheet, TouchableOpacity, View } from 'react-native';

import type { Theme } from '@/theme/theme';
import type { Drill } from '@/types/drill';
import { useTheme, useThemedStyles } from '@hooks/useTheme';

import { Icon } from './Icon';
import { SelectSheet, type SelectOption } from './Select';
import { Typography } from './Typography';

type DrillBoxProps = {
  /** The drill on the timer. */
  drill: Drill;
  /** Every drill that can be put on the timer. */
  options: SelectOption<string>[];
  /** A run is on, or being saved: the drill cannot be changed. */
  locked: boolean;
  onSelect: (id: string) => void;
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // A minimum, so a large system font grows the box instead of clipping.
    box: {
      minHeight: theme.sizes.mainActionMin,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.inset,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.outline,
    },
    text: { flex: 1 },
    name: { textTransform: 'uppercase' },
    // Points the right-facing chevron down. On an inner view: a rotated
    // touchable stops taking presses on Android.
    chevron: { transform: [{ rotate: '90deg' }] },
  });

/**
 * The drill on the Timer, in a ruled box that opens the drill list. During a
 * run it says it is locked and does not open: a stray touch must not throw
 * the run away.
 */
export const DrillBox = ({
  drill,
  options,
  locked,
  onSelect,
}: DrillBoxProps) => {
  const styles = useThemedStyles(createStyles);
  const { sizes } = useTheme();
  const [open, setOpen] = useState(false);

  const choose = (id: string) => {
    setOpen(false);
    onSelect(id);
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        disabled={locked}
        accessibilityRole="button"
        accessibilityLabel={
          locked
            ? `Drill: ${drill.name}, locked during a run`
            : `Drill: ${drill.name}. Change drill`
        }
        accessibilityState={{ disabled: locked }}
        activeOpacity={0.7}
        style={styles.box}
        testID="btn-drill-box"
      >
        <View style={styles.text}>
          <Typography variant="sectionLabel" color="textSecondary">
            {locked ? 'DRILL · LOCKED DURING A RUN' : 'DRILL'}
          </Typography>
          <Typography
            variant="stencilName"
            numberOfLines={2}
            style={styles.name}
          >
            {drill.name}
          </Typography>
        </View>

        {locked ? null : (
          <View style={styles.chevron}>
            <Icon name="chevron" size={sizes.iconLg} color="textPrimary" />
          </View>
        )}
      </TouchableOpacity>

      <SelectSheet
        visible={open}
        onClose={() => setOpen(false)}
        value={drill.id}
        options={options}
        onChoose={choose}
        title="Drill"
        testID="select-drill"
      />
    </>
  );
};
