package com.brasscount.app

import android.content.res.Configuration
import android.os.Bundle
import androidx.appcompat.app.AppCompatDelegate
import com.brasscount.app.appearance.AppearanceStore
import com.brasscount.app.appearance.appCompatNightModeFor
import com.brasscount.app.appearance.applyNavigationBarAppearance
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "BrassCount"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  /**
   * react-native-screens cannot restore its fragments: when Android recreates the activity (font
   * size or locale change, process restore) the saved fragment state makes it throw "Screen
   * fragments should never be restored". Starting without the saved state lets React rebuild the
   * screens instead.
   *
   * The Appearance preference JS mirrored on its last run is applied before the window exists, so a
   * pinned theme that differs from the device setting does not flash the wrong colours while
   * JavaScript starts. The navigation bar is set up after `super`, which is where React Native
   * makes the window edge to edge.
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    AppCompatDelegate.setDefaultNightMode(appCompatNightModeFor(AppearanceStore.read(this)))
    super.onCreate(null)
    window.applyNavigationBarAppearance(resources.configuration.uiMode)
  }

  /**
   * A theme change switches the night mode in place (`uiMode` is in the manifest's
   * configChanges), as does the device's own dark mode, so the navigation bar buttons follow it
   * here rather than keeping the launch theme's colour.
   */
  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    // The resources' configuration, as in onCreate: AppCompat's pinned night mode is applied there.
    window.applyNavigationBarAppearance(resources.configuration.uiMode)
  }
}
