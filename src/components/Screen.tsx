import type { ReactNode } from 'react';

import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import type { Theme } from '@/theme/theme';
import { useKeyboardHeight } from '@hooks/useKeyboardHeight';
import { useTheme, useThemedStyles } from '@hooks/useTheme';

import { Icon } from './Icon';
import { Typography } from './Typography';

/** The one text action at the header's top right. */
export type ScreenAction = {
  /** Written as a sentence ("Save"); the header shows it in capitals. */
  label: string;
  onPress: () => void;
  /** Defaults to `label`. */
  accessibilityLabel?: string;
  /** Defaults to `btn-header-action`. */
  testID?: string;
};

type ScreenProps = {
  title?: string;
  /** Supporting line under the title. */
  subtitle?: string;
  /** Text action pinned to the header's top right, e.g. Save or + New. */
  action?: ScreenAction;
  /** Greys the action out and stops it taking presses. */
  actionDisabled?: boolean;
  /** Show a back link in place of the wordmark. Pass `navigation.goBack`. */
  onBack?: () => void;
  /** Where the back link goes, e.g. `Log`. Defaults to `Back`. */
  backLabel?: string;
  children: ReactNode;
  /** Center children on both axes. Defaults to false (top-aligned). */
  centered?: boolean;
  /** Wrap content in a ScrollView. Use for any screen that can overflow. */
  scrollable?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

const WORDMARK = 'BRASSCOUNT';
const DEFAULT_BACK_LABEL = 'Back';

/**
 * The wordmark is decoration, so it gives way to the action: it grows with
 * the system font only this far, then shrinks to share the top row.
 */
const WORDMARK_MAX_FONT_MULTIPLIER = 1.3;
const WORDMARK_MIN_FONT_SCALE = 0.6;

/**
 * Shared screen shell: safe-area, themed background, the Range Card header
 * and the content area. Screens should render only their unique content
 * inside.
 *
 * The header is the same on every screen, three lines over a 2px rule: the
 * BRASSCOUNT wordmark (or a back link on a pushed screen) with one text
 * action opposite it, the stencil title, then the subtitle. It stays put
 * above scrolling content. Its height is a minimum, so a large system font
 * grows it instead of clipping. The back link and action are set in
 * capitals but announced as written, so TalkBack reads words rather than
 * spelling letters.
 *
 * Bottom inset is left to the tab bar, which applies its own safe-area
 * padding.
 */
const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      minHeight: theme.sizes.headerMin,
      paddingHorizontal: theme.spacing.gutter,
      paddingVertical: theme.spacing.sm,
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
      borderBottomWidth: theme.sizes.border,
      borderBottomColor: theme.colors.outline,
    },
    topRow: {
      minHeight: theme.sizes.touchTarget,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
    },
    wordmark: { flexShrink: 1 },
    back: {
      minHeight: theme.sizes.touchTarget,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingRight: theme.spacing.sm,
    },
    // Flip the right-facing chevron on an inner view: a rotated touchable
    // stops taking presses on Android.
    backChevron: { transform: [{ rotate: '180deg' }] },
    action: {
      minHeight: theme.sizes.touchTarget,
      minWidth: theme.sizes.touchTarget,
      alignItems: 'flex-end',
      justifyContent: 'center',
      paddingLeft: theme.spacing.sm,
    },
    actionLabel: { textDecorationLine: 'underline' },
    content: {
      flex: 1,
      padding: theme.spacing.gutter,
      gap: theme.spacing.gutter,
    },
    scroll: { flex: 1 },
    scrollContent: {
      padding: theme.spacing.gutter,
      gap: theme.spacing.gutter,
      // Clears the tab bar so the last card is never trapped.
      paddingBottom: theme.spacing.xxl * 2,
    },
    centered: { alignItems: 'center', justifyContent: 'center' },
  });

type HeaderProps = Pick<
  ScreenProps,
  'title' | 'subtitle' | 'action' | 'actionDisabled' | 'onBack' | 'backLabel'
>;

const Header = ({
  title,
  subtitle,
  action,
  actionDisabled = false,
  onBack,
  backLabel = DEFAULT_BACK_LABEL,
}: HeaderProps) => {
  const styles = useThemedStyles(createStyles);
  const { sizes } = useTheme();

  return (
    <View style={styles.header} testID="screen-header">
      <View style={styles.topRow}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={
              backLabel === DEFAULT_BACK_LABEL
                ? 'Go back'
                : `Back to ${backLabel}`
            }
            activeOpacity={0.7}
            style={styles.back}
            testID="btn-back"
          >
            <View style={styles.backChevron}>
              <Icon name="chevron" size={sizes.iconMd} color="textPrimary" />
            </View>
            <Typography variant="actionLabel" numberOfLines={1}>
              {backLabel.toUpperCase()}
            </Typography>
          </TouchableOpacity>
        ) : (
          <Typography
            variant="wordmark"
            color="textSecondary"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={WORDMARK_MIN_FONT_SCALE}
            maxFontSizeMultiplier={WORDMARK_MAX_FONT_MULTIPLIER}
            style={styles.wordmark}
          >
            {WORDMARK}
          </Typography>
        )}

        {action ? (
          <TouchableOpacity
            onPress={action.onPress}
            disabled={actionDisabled}
            accessibilityRole="button"
            accessibilityLabel={action.accessibilityLabel ?? action.label}
            accessibilityState={{ disabled: actionDisabled }}
            activeOpacity={0.7}
            style={styles.action}
            testID={action.testID ?? 'btn-header-action'}
          >
            <Typography
              variant="actionLabel"
              color={actionDisabled ? 'disabled' : 'textPrimary'}
              numberOfLines={1}
              style={actionDisabled ? undefined : styles.actionLabel}
            >
              {action.label.toUpperCase()}
            </Typography>
          </TouchableOpacity>
        ) : null}
      </View>

      {title ? (
        <Typography
          variant="stencilTitle"
          accessibilityRole="header"
          numberOfLines={1}
        >
          {title}
        </Typography>
      ) : null}
      {subtitle ? (
        <Typography variant="body" color="textSecondary" numberOfLines={2}>
          {subtitle}
        </Typography>
      ) : null}
    </View>
  );
};

export const Screen = ({
  title,
  subtitle,
  action,
  actionDisabled,
  onBack,
  backLabel,
  children,
  centered = false,
  scrollable = false,
  contentStyle,
  testID,
}: ScreenProps) => {
  const styles = useThemedStyles(createStyles);
  const keyboardHeight = useKeyboardHeight();
  const { bottom: navBarHeight } = useSafeAreaInsets();

  const header =
    title || action || onBack ? (
      <Header
        title={title}
        subtitle={subtitle}
        action={action}
        actionDisabled={actionDisabled}
        onBack={onBack}
        backLabel={backLabel}
      />
    ) : null;

  return (
    <SafeAreaView
      testID={testID}
      style={styles.safeArea}
      edges={['top', 'left', 'right']}
    >
      {header}
      {scrollable ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            contentStyle,
            // Room for the keyboard, so the last controls can scroll above it.
            // Deliberately replaces the tab bar clearance: the keyboard covers it.
            keyboardHeight > 0 && {
              paddingBottom: keyboardHeight + navBarHeight,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View
          style={[styles.content, centered && styles.centered, contentStyle]}
        >
          {children}
        </View>
      )}
    </SafeAreaView>
  );
};
