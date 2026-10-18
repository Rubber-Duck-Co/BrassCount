package com.brasscount.app.appearance

/** What the window should follow before the first frame is drawn. */
enum class NightMode {
  FOLLOW_SYSTEM,
  LIGHT,
  DARK,
}

/** Values JS stores for the Appearance preference, as `AppearancePreference` names them. */
const val PREFERENCE_SYSTEM = "system"
const val PREFERENCE_LIGHT = "light"
const val PREFERENCE_DARK = "dark"

private val KNOWN_PREFERENCES = setOf(PREFERENCE_SYSTEM, PREFERENCE_LIGHT, PREFERENCE_DARK)

/** Whether [preference] is one of the values JS may store. */
fun isKnownPreference(preference: String?): Boolean = preference in KNOWN_PREFERENCES

/**
 * Which night mode a stored Appearance preference asks for. Anything missing or
 * unrecognised follows the device, the same as a shooter who never chose.
 */
fun nightModeFor(preference: String?): NightMode =
  when (preference) {
    PREFERENCE_LIGHT -> NightMode.LIGHT
    PREFERENCE_DARK -> NightMode.DARK
    else -> NightMode.FOLLOW_SYSTEM
  }
