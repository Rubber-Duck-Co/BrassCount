import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CalibrationScreen, SetupScreen } from '@/screens';
import type { SetupStackParamList } from '@/types/navigation';

const Stack = createNativeStackNavigator<SetupStackParamList>();

/**
 * The Setup tab is a stack: the Setup screen, with Calibration pushed over
 * it. Nesting inside the tab keeps the bottom tab bar visible on both.
 */
export const SetupStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="SetupHome" component={SetupScreen} />
    <Stack.Screen name="Calibration" component={CalibrationScreen} />
  </Stack.Navigator>
);
