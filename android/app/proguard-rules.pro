# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# The app's own TurboModules and the packages that register them are called
# from C++ over JNI. React Native's consumer rules cover the framework; these
# keep ours whole so release builds cannot strip a module method (Audio
# capture, Appearance). Narrow on purpose: only these two kinds of class.
-keep class com.brasscount.app.**Module { *; }
-keep class com.brasscount.app.**Package { *; }
