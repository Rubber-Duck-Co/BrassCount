import type { ReactNode } from 'react';

import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Theme } from '@/theme/theme';
import { useTheme, useThemedStyles } from '@hooks/useTheme';

import { Icon } from './Icon';
import { Typography } from './Typography';

/**
 * The most of the window's height a sheet's scrolling content may take.
 * The rest is left for the frame itself (handle, title row, bottom inset),
 * so the title row and its close button stay on screen at a large font or
 * in landscape.
 */
export const SHEET_CONTENT_MAX_HEIGHT_RATIO = 0.6;

type BottomSheetProps = {
  visible: boolean;
  /** Called by the backdrop, the close button and the system back gesture. */
  onClose: () => void;
  /**
   * What a screen reader announces for the backdrop and the close button,
   * e.g. "Close par picker".
   */
  closeLabel: string;
  /**
   * Written as a sentence ("Step 4 par"); the sheet shows it in capitals
   * beside a close button. Without it the sheet has no title row, and its
   * content brings its own heading.
   */
  title?: string;
  /**
   * The sheet's work is under way: the backdrop, the close button and the
   * system back gesture do nothing until it is cleared.
   */
  dismissDisabled?: boolean;
  /** Test id of the backdrop. */
  backdropTestID?: string;
  /** Test id of the close button in the title row. */
  closeTestID?: string;
  /** Test id of the sheet itself. */
  testID?: string;
  children: ReactNode;
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: theme.colors.overlay,
    },
    sheet: {
      backgroundColor: theme.colors.background,
      borderRadius: theme.radius.none,
      borderTopWidth: theme.sizes.border,
      borderTopColor: theme.colors.outline,
      paddingTop: theme.spacing.sm,
    },
    handle: {
      alignSelf: 'center',
      width: theme.sizes.sheetHandleWidth,
      height: theme.sizes.sheetHandleHeight,
      backgroundColor: theme.colors.textSecondary,
      marginBottom: theme.spacing.sm,
    },
    // A titled sheet's title row and content. An untitled sheet pads its
    // own content until it moves onto the title row.
    framed: {
      paddingTop: theme.spacing.xs,
      paddingHorizontal: theme.spacing.gutter,
      gap: theme.spacing.inset,
    },
    // A minimum height, so a title that wraps at a large font grows the
    // row instead of clipping.
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      minHeight: theme.sizes.touchTarget,
    },
    title: { flex: 1, textTransform: 'uppercase' },
    close: {
      width: theme.sizes.touchTarget,
      height: theme.sizes.touchTarget,
      alignItems: 'center',
      justifyContent: 'center',
      // Lines the cross up with the sheet's right edge rather than the
      // button's.
      marginRight: -theme.spacing.inset,
    },
  });

/**
 * The Range Card sheet frame shared by every bottom sheet: a modal that
 * rises over the whole screen, tab bar included, on a dimmed backdrop that
 * closes it; a square sheet with a 2px top rule and a handle; and, given a
 * `title`, a title row with a close button. The system back gesture and a
 * hardware Escape close it through `onRequestClose`.
 */
export const BottomSheet = ({
  visible,
  onClose,
  closeLabel,
  title,
  dismissDisabled = false,
  backdropTestID,
  closeTestID,
  testID,
  children,
}: BottomSheetProps) => {
  const styles = useThemedStyles(createStyles);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // While dismissing is disabled there is nothing to go back to: the
  // backdrop, the close button and back wait for it to clear.
  const dismiss = dismissDisabled ? undefined : onClose;
  const titled = title !== undefined;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => dismiss?.()}
    >
      {/* With a title row, its close button is what a screen reader
          reaches; the backdrop stays for touch only, so the reader does not
          hear two "Close" buttons. */}
      <Pressable
        style={styles.backdrop}
        accessible={!titled}
        importantForAccessibility={titled ? 'no' : 'auto'}
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
        accessibilityState={{ disabled: dismissDisabled }}
        disabled={dismissDisabled}
        onPress={dismiss}
        testID={backdropTestID}
      >
        {/* Claims touches inside the sheet so they don't reach the backdrop
            and dismiss it. A plain View, not a Pressable: a pressable here
            is read by a screen reader as one run-on label for the whole
            sheet. */}
        <View
          onStartShouldSetResponder={() => true}
          style={[
            styles.sheet,
            {
              paddingBottom:
                insets.bottom + (titled ? theme.spacing.lg : theme.spacing.sm),
            },
          ]}
          testID={testID}
        >
          <View
            style={styles.handle}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
          {titled ? (
            <View style={styles.framed}>
              <View style={styles.titleRow}>
                <Typography
                  variant="stencilName"
                  style={styles.title}
                  accessibilityRole="header"
                  // Announced as written: TalkBack spells out some words in
                  // capitals.
                  accessibilityLabel={title}
                >
                  {title}
                </Typography>
                <Pressable
                  style={styles.close}
                  accessibilityRole="button"
                  accessibilityLabel={closeLabel}
                  accessibilityState={{ disabled: dismissDisabled }}
                  disabled={dismissDisabled}
                  onPress={dismiss}
                  testID={closeTestID}
                >
                  <Icon
                    name="close"
                    size={theme.sizes.iconLg}
                    color={dismissDisabled ? 'disabled' : 'textPrimary'}
                  />
                </Pressable>
              </View>
              {children}
            </View>
          ) : (
            children
          )}
        </View>
      </Pressable>
    </Modal>
  );
};
