import type { ReactNode } from 'react';

import {
  StyleSheet,
  TouchableOpacity,
  View,
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
} from 'react-native';

import type { SemanticColors, Theme } from '@/theme/theme';
import { useTheme, useThemedStyles } from '@hooks/useTheme';

import { Icon } from './Icon';
import { Typography } from './Typography';

type ListRowProps = {
  title: string;
  subtitle?: string;
  /** Right-aligned value. Rendered mono so columns line up down the list. */
  value?: string;
  /** Colour of `value`, for one that is good or bad news. */
  valueColor?: keyof SemanticColors;
  /** Small leading badge — the step number in a sequence, for example. */
  index?: number;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  /**
   * A pressable row that cannot be pressed right now: its title is greyed,
   * its chevron hidden and a screen reader reads it as dimmed. Say why in
   * the subtitle, which keeps its full contrast so the reason stays
   * readable.
   */
  disabled?: boolean;
  /** The row does something that cannot be undone: its title is `danger`. */
  destructive?: boolean;
  /** Show a trailing chevron. Implied when `onPress` is set and no `right`. */
  chevron?: boolean;
  /** 1px Rule line below the row. Omit on the last row of a group. */
  divided?: boolean;
  /**
   * What a screen reader says for the row, in place of its title, subtitle
   * and value read as written. For text made of abbreviations such as
   * `Best 4.21s · 2d ago`. A row that is not pressable is read as one item
   * when this is set.
   */
  accessibilityLabel?: string;
  /**
   * Extra things a screen reader can do with a pressable row, for actions
   * that are otherwise only reachable by a gesture such as a swipe.
   */
  accessibilityActions?: readonly AccessibilityActionInfo[];
  onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
  testID?: string;
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.inset,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.inset,
      minHeight: theme.sizes.touchTarget,
    },
    divided: {
      borderBottomWidth: theme.sizes.rule,
      borderBottomColor: theme.colors.border,
    },
    badge: {
      minWidth: theme.sizes.badge,
      minHeight: theme.sizes.badge,
      borderRadius: theme.radius.none,
      borderWidth: theme.sizes.rule,
      borderColor: theme.colors.outline,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
  });

/** The title's colour: greyed when disabled, `danger` when destructive. */
const titleColor = (
  disabled: boolean,
  destructive: boolean,
): keyof SemanticColors => {
  if (disabled) {
    return 'textTertiary';
  }
  return destructive ? 'danger' : 'textPrimary';
};

/**
 * One line in a grouped list. Sits inside a `flush` Card, split from the
 * next row by a 1px Rule line (`divided`).
 */
export const ListRow = ({
  title,
  subtitle,
  value,
  valueColor = 'textSecondary',
  index,
  left,
  right,
  onPress,
  disabled = false,
  destructive = false,
  chevron,
  divided = false,
  accessibilityLabel,
  accessibilityActions,
  onAccessibilityAction,
  testID,
}: ListRowProps) => {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  const showChevron =
    chevron ?? (Boolean(onPress) && !disabled && !right && !value);

  const content = (
    <>
      {index !== undefined ? (
        <View
          style={styles.badge}
          testID={testID ? `${testID}-index` : undefined}
        >
          <Typography variant="overline" color="textSecondary">
            {index}
          </Typography>
        </View>
      ) : null}
      {left}

      <View style={styles.body}>
        <Typography
          variant="rowLabel"
          color={titleColor(disabled, destructive)}
          numberOfLines={1}
        >
          {title}
        </Typography>
        {subtitle ? (
          // Two lines, so a subtitle that fits at the default text size
          // wraps at the largest one instead of losing its end.
          <Typography variant="caption" color="textTertiary" numberOfLines={2}>
            {subtitle}
          </Typography>
        ) : null}
      </View>

      {value ? (
        <Typography variant="metricSmall" color={valueColor}>
          {value}
        </Typography>
      ) : null}
      {right}
      {showChevron ? (
        <Icon name="chevron" size={theme.sizes.iconSm} color="textPrimary" />
      ) : null}
    </>
  );

  const style = [styles.row, divided && styles.divided];

  if (onPress) {
    return (
      <TouchableOpacity
        testID={testID}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityLabel={accessibilityLabel}
        accessibilityActions={accessibilityActions}
        onAccessibilityAction={onAccessibilityAction}
        activeOpacity={0.6}
        style={style}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View
      testID={testID}
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
      style={style}
    >
      {content}
    </View>
  );
};
