import packageJson from '../../package.json';

/**
 * The app's version, as `package.json` holds it. React Native has no
 * built-in way to read the installed version. The merge bot bumps
 * `package.json` and `VERSION.txt` together, and Gradle takes the APK's
 * `versionName` from `VERSION.txt`, so this matches the installed APK
 * without a native module to ask for it.
 */
export const APP_VERSION: string = packageJson.version;
