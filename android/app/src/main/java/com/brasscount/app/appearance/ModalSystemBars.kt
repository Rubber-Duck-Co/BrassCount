package com.brasscount.app.appearance

import android.view.Window
import com.facebook.react.interfaces.ExtraWindowEventListener

/**
 * Gives each React Native `Modal` window (the bottom sheets) the same navigation bar as the
 * activity: no system scrim, so the sheet shows under 3-button navigation, and buttons that follow
 * the night mode. With the scrim off (`AppTheme`), React Native no longer picks the buttons'
 * colour for a Modal's window, so it is set here.
 *
 * React Native reports each Modal's window here right after showing its dialog, and a sheet's
 * dialog is created each time it opens, so the night mode read here is the current one.
 */
internal object ModalSystemBars : ExtraWindowEventListener {

  override fun onExtraWindowCreate(window: Window) {
    window.applyNavigationBarAppearance(window.context.resources.configuration.uiMode)
  }

  override fun onExtraWindowDestroy(window: Window) = Unit
}
