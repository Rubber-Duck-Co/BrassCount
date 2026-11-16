package com.brasscount.app.appearance

import android.content.res.Configuration
import android.os.Build
import android.view.Window
import androidx.core.view.WindowInsetsControllerCompat

/** Whether [uiMode] (a [Configuration.uiMode]) is in night mode. */
internal fun isNightUiMode(uiMode: Int): Boolean =
  (uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

/**
 * Whether the app draws behind the navigation bar on Android [sdkInt]. The app targets SDK 35+,
 * which makes every window edge to edge from Android 15; below that `edgeToEdgeEnabled` is off, so
 * the bar is the platform's own opaque one.
 */
internal fun drawsBehindNavigationBar(sdkInt: Int): Boolean =
  sdkInt >= Build.VERSION_CODES.VANILLA_ICE_CREAM

/**
 * Lets the navigation bar show the theme JS draws and keeps its buttons readable on it.
 *
 * Edge to edge, the tab bar paints the theme's background under the navigation bar. React Native
 * leaves the system's contrast scrim on over 3-button navigation and picks its light or dark
 * variant once, when the activity is created. A theme change only switches the night mode in place
 * (the activity handles `uiMode`), so that scrim would keep the launch theme's colour. With the
 * scrim off the bar shows the tab bar, and the buttons follow [uiMode]: dark on a light theme,
 * light on a dark one.
 *
 * `AppTheme` also sets `enforceNavigationBarContrast` to false. React Native re-reads that
 * attribute whenever it updates a Modal's window, so turning the scrim off here alone would not
 * last for a sheet.
 *
 * Does nothing where the app does not draw behind the bar ([drawsBehindNavigationBar]): that bar
 * stays the platform's dark one, and dark buttons would vanish on it.
 */
internal fun Window.applyNavigationBarAppearance(uiMode: Int) {
  if (!drawsBehindNavigationBar(Build.VERSION.SDK_INT)) {
    return
  }
  isNavigationBarContrastEnforced = false
  WindowInsetsControllerCompat(this, decorView).isAppearanceLightNavigationBars =
    !isNightUiMode(uiMode)
}
