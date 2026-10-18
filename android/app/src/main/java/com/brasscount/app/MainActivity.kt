package com.brasscount.app

import android.os.Bundle
import androidx.appcompat.app.AppCompatDelegate
import com.brasscount.app.appearance.AppearanceStore
import com.brasscount.app.appearance.appCompatNightModeFor
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
   * JavaScript starts.
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    AppCompatDelegate.setDefaultNightMode(appCompatNightModeFor(AppearanceStore.read(this)))
    super.onCreate(null)
  }
}
