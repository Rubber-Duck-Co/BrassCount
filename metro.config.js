const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro bundler configuration: React Native's defaults, no overrides.
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
