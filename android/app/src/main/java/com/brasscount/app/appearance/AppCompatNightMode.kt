package com.brasscount.app.appearance

import androidx.appcompat.app.AppCompatDelegate

/** The [AppCompatDelegate] night mode a stored Appearance preference asks for. */
fun appCompatNightModeFor(preference: String?): Int =
  when (nightModeFor(preference)) {
    NightMode.LIGHT -> AppCompatDelegate.MODE_NIGHT_NO
    NightMode.DARK -> AppCompatDelegate.MODE_NIGHT_YES
    NightMode.FOLLOW_SYSTEM -> AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
  }
