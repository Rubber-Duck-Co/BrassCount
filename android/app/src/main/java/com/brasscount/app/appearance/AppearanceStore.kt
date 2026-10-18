package com.brasscount.app.appearance

import android.content.Context

/**
 * Keeps a copy of the Appearance preference where native code can read it before
 * JavaScript has started. The profile in AsyncStorage stays the source of truth;
 * JS mirrors every change here, and the activity reads it on launch so the window
 * is drawn in the pinned theme from its first frame.
 */
object AppearanceStore {
  private const val FILE = "brasscount_appearance"
  private const val KEY = "preference"

  /** The mirrored preference, or null when JS has not stored one yet. */
  fun read(context: Context): String? =
    context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(KEY, null)

  /** Store [preference]. Returns false, storing nothing, for a value JS should never send. */
  fun write(context: Context, preference: String): Boolean {
    if (!isKnownPreference(preference)) {
      return false
    }
    context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putString(KEY, preference).apply()
    return true
  }
}
