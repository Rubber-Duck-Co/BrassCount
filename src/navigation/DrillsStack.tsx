import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { DrillsScreen, SequenceEditorScreen } from '@/screens';
import type { DrillsStackParamList } from '@/types/navigation';

const Stack = createNativeStackNavigator<DrillsStackParamList>();

/**
 * The Drills tab is a stack — the library, with the editor pushed over it.
 * Nesting inside the tab keeps the bottom tab bar visible in the editor,
 * and keeps an unsaved draft mounted while another tab is open.
 */
export const DrillsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="DrillList" component={DrillsScreen} />
    <Stack.Screen name="SequenceEditor" component={SequenceEditorScreen} />
  </Stack.Navigator>
);
