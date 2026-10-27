import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';

import { TimerScreen } from '@/screens';
import type { MainTabParamList } from '@/types/navigation';

import { DrillsStack } from './DrillsStack';
import { LogStack } from './LogStack';
import { SetupStack } from './SetupStack';
import { TabBar } from './TabBar';

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Screens render their own headers via the `Screen` shell, so the navigator
 * header stays off and the custom `TabBar` owns the bottom chrome.
 *
 * Tabs are declared in visual left-to-right order, with Timer first: it is
 * the landing screen, and where hardware back from another tab returns to.
 * Every other tab is a stack, so the tab bar stays at any depth.
 */
export const MainTabs = () => (
  <Tab.Navigator
    initialRouteName="Timer"
    tabBar={props => <TabBar {...props} />}
    screenOptions={{ headerShown: false }}
  >
    <Tab.Screen
      name="Timer"
      component={TimerScreen}
      options={{ title: 'Timer' }}
    />
    <Tab.Screen
      name="Drills"
      component={DrillsStack}
      options={{ title: 'Drills' }}
      listeners={({ navigation, route }) => ({
        // Pressing the tab already in use would pop the stack back to the
        // library, dropping a draft open in the editor. Leaving the editor
        // is its back link's job, so the press is ignored there.
        tabPress: event => {
          const focusedRoute = getFocusedRouteNameFromRoute(route);
          if (
            navigation.isFocused() &&
            focusedRoute !== undefined &&
            focusedRoute !== 'DrillList'
          ) {
            event.preventDefault();
          }
        },
      })}
    />
    <Tab.Screen name="Log" component={LogStack} options={{ title: 'Log' }} />
    <Tab.Screen
      name="Setup"
      component={SetupStack}
      options={{ title: 'Setup' }}
    />
  </Tab.Navigator>
);
