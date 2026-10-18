package com.brasscount.app.appearance

import androidx.appcompat.app.AppCompatDelegate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AppearanceModeTest {

  @Test
  fun `a pinned dark preference asks for the dark window`() {
    assertEquals(NightMode.DARK, nightModeFor("dark"))
  }

  @Test
  fun `a pinned light preference asks for the light window`() {
    assertEquals(NightMode.LIGHT, nightModeFor("light"))
  }

  @Test
  fun `the system preference follows the device`() {
    assertEquals(NightMode.FOLLOW_SYSTEM, nightModeFor("system"))
  }

  @Test
  fun `nothing stored yet follows the device`() {
    assertEquals(NightMode.FOLLOW_SYSTEM, nightModeFor(null))
  }

  @Test
  fun `an unrecognised value follows the device`() {
    assertEquals(NightMode.FOLLOW_SYSTEM, nightModeFor("sepia"))
    assertEquals(NightMode.FOLLOW_SYSTEM, nightModeFor("DARK"))
    assertEquals(NightMode.FOLLOW_SYSTEM, nightModeFor(""))
  }

  @Test
  fun `each preference maps to the matching AppCompat night mode`() {
    assertEquals(AppCompatDelegate.MODE_NIGHT_YES, appCompatNightModeFor("dark"))
    assertEquals(AppCompatDelegate.MODE_NIGHT_NO, appCompatNightModeFor("light"))
    assertEquals(AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM, appCompatNightModeFor("system"))
    assertEquals(AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM, appCompatNightModeFor(null))
    assertEquals(AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM, appCompatNightModeFor("sepia"))
  }

  @Test
  fun `only the three preference values are known`() {
    assertTrue(isKnownPreference("system"))
    assertTrue(isKnownPreference("light"))
    assertTrue(isKnownPreference("dark"))
    assertFalse(isKnownPreference(null))
    assertFalse(isKnownPreference("sepia"))
    assertFalse(isKnownPreference("Dark"))
  }
}
