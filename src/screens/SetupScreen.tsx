import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { SetupStackParamList } from '@/types/navigation';
import { ProfileBox } from '@components/ProfileBox';
import { Screen } from '@components/Screen';
import { SetupDataSection } from '@components/SetupDataSection';
import {
  DisplaySettings,
  MicrophoneSettings,
  TimerSettings,
} from '@components/SetupSections';
import { useProfileOverview } from '@hooks/useProfileOverview';

type Nav = NativeStackNavigationProp<SetupStackParamList, 'SetupHome'>;

/**
 * The Setup tab's root: the shooter's profile, edited in place, over the
 * app's settings in ruled groups: Microphone (this session's calibration
 * and the detection sensitivity), Timer, Display and Data. Calibration is
 * pushed over it in the Setup stack.
 *
 * The settings never wait on the profile box: a profile that cannot be
 * read is shown as such in the box, with the rows still below it.
 */
export const SetupScreen = () => {
  const navigation = useNavigation<Nav>();
  const { state, reload, refresh, saveProfile } = useProfileOverview();

  return (
    <Screen
      title="Setup"
      subtitle="Shooter, calibration and settings"
      scrollable
      testID="screen-setup"
    >
      <ProfileBox state={state} reload={reload} saveProfile={saveProfile} />
      <MicrophoneSettings
        onOpenCalibration={() => navigation.navigate('Calibration')}
      />
      <TimerSettings />
      <DisplaySettings />
      {/* Clearing the history changes the box's run count too. */}
      <SetupDataSection onCleared={refresh} />
    </Screen>
  );
};
