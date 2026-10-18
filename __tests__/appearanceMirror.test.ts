import { Platform } from 'react-native';

import { mirrorAppearance } from '../src/services/appearanceMirror';
import NativeAppearancePreference from '../src/specs/NativeAppearancePreference';

const setPreference = jest.mocked(NativeAppearancePreference.setPreference);

describe('mirrorAppearance', () => {
  const originalOs = Platform.OS;

  beforeEach(() => {
    setPreference.mockReset();
    Platform.OS = 'android';
  });

  afterEach(() => {
    Platform.OS = originalOs;
  });

  it.each(['system', 'light', 'dark'] as const)(
    'hands %s to the native side',
    preference => {
      mirrorAppearance(preference);

      expect(setPreference).toHaveBeenCalledWith(preference);
    },
  );

  it('does not throw when the native call fails', () => {
    setPreference.mockImplementationOnce(() => {
      throw new Error('native unavailable');
    });

    expect(() => mirrorAppearance('dark')).not.toThrow();
  });

  it('does nothing off Android', () => {
    Platform.OS = 'ios';

    mirrorAppearance('dark');

    expect(setPreference).not.toHaveBeenCalled();
  });
});
