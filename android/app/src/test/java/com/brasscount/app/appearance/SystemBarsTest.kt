package com.brasscount.app.appearance

import android.content.res.Configuration
import android.os.Build
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SystemBarsTest {

  @Test
  fun `a night configuration is night`() {
    assertTrue(isNightUiMode(Configuration.UI_MODE_NIGHT_YES))
  }

  @Test
  fun `a day configuration is not night`() {
    assertFalse(isNightUiMode(Configuration.UI_MODE_NIGHT_NO))
  }

  @Test
  fun `an undefined night mode is not night`() {
    assertFalse(isNightUiMode(Configuration.UI_MODE_NIGHT_UNDEFINED))
  }

  @Test
  fun `the app draws behind the navigation bar from Android 15`() {
    assertTrue(drawsBehindNavigationBar(Build.VERSION_CODES.VANILLA_ICE_CREAM))
    assertTrue(drawsBehindNavigationBar(Build.VERSION_CODES.BAKLAVA))
  }

  @Test
  fun `below Android 15 the navigation bar is the platform's own`() {
    assertFalse(drawsBehindNavigationBar(Build.VERSION_CODES.UPSIDE_DOWN_CAKE))
    assertFalse(drawsBehindNavigationBar(Build.VERSION_CODES.N))
  }

  @Test
  fun `the device type bits do not change the answer`() {
    assertTrue(
      isNightUiMode(Configuration.UI_MODE_TYPE_NORMAL or Configuration.UI_MODE_NIGHT_YES)
    )
    assertFalse(
      isNightUiMode(Configuration.UI_MODE_TYPE_NORMAL or Configuration.UI_MODE_NIGHT_NO)
    )
  }
}
