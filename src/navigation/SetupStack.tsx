import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CalibrationScreen, ProfileScreen, SettingsScreen } from '@/screens';
import type { SetupStackParamList } from '@/types/navigation';

const Stack = createNativeStackNavigator<SetupStackParamList>();

/**
 * The Setup tab is a stack — its own screen, with Calibration and Settings
 * pushed over it. Nesting inside the tab keeps the bottom tab bar visible
 * on both. The Profile screen stands in as the root until the Setup screen
 * replaces it.
 */
export const SetupStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="SetupHome" component={ProfileScreen} />
    <Stack.Screen name="Calibration" component={CalibrationScreen} />
    <Stack.Screen name="Settings" component={SettingsScreen} />
  </Stack.Navigator>
);
