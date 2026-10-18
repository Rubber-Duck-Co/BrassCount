package com.brasscount.app.appearance

import androidx.appcompat.app.AppCompatDelegate
import com.facebook.fbreact.specs.NativeAppearancePreferenceSpec
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.module.annotations.ReactModule

/**
 * Bridged to JS as the `AppearancePreference` TurboModule. Mirrors the Appearance
 * preference into [AppearanceStore] so the next launch can pick the window theme
 * before JavaScript runs, and keeps the activity's night mode matching it so the OS
 * colour scheme JS resolves "System" from agrees with the pinned choice. JS draws
 * the app, so nothing is recreated.
 */
@ReactModule(name = AppearanceModule.NAME)
class AppearanceModule(private val reactContext: ReactApplicationContext) :
  NativeAppearancePreferenceSpec(reactContext) {

  override fun getName() = NAME

  override fun setPreference(preference: String) {
    if (!AppearanceStore.write(reactContext, preference)) {
      return
    }
    // `uiMode` is in the manifest's configChanges, so this updates the configuration in place
    // instead of recreating the activity.
    UiThreadUtil.runOnUiThread {
      AppCompatDelegate.setDefaultNightMode(appCompatNightModeFor(preference))
    }
  }

  companion object {
    const val NAME = "AppearancePreference"
  }
}
