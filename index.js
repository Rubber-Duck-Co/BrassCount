/**
 * App entry point: registers the root component with React Native.
 *
 * @format
 */

import { AppRegistry } from 'react-native';

import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
