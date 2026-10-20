import { useEffect, useState } from 'react';

import { Keyboard, Platform } from 'react-native';

/** First Android version that always draws edge to edge (Android 15). */
const FORCED_EDGE_TO_EDGE_API = 35;

/**
 * How much room a screen has to leave for the on-screen keyboard, in dp, or 0
 * while it is closed. From Android 15 the app draws edge to edge and the
 * system no longer shrinks the window for the keyboard, so a screen has to
 * leave that room itself or the controls under the keyboard cannot be
 * scrolled into view. Older versions still resize the window
 * (`adjustResize`), so this stays 0 there rather than count the keyboard
 * twice.
 */
export const useKeyboardHeight = (): number => {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (Number(Platform.Version) < FORCED_EDGE_TO_EDGE_API) {
      return undefined;
    }

    const shown = Keyboard.addListener('keyboardDidShow', event =>
      setHeight(event.endCoordinates.height),
    );
    const hidden = Keyboard.addListener('keyboardDidHide', () => setHeight(0));

    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return height;
};
