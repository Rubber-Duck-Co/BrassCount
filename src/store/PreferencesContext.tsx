import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { DEFAULT_PROFILE, type Profile } from '@/types/profile';
import { mirrorAppearance } from '@services/appearanceMirror';
import {
  ProfileStorageService,
  type ProfileStorageServiceType,
} from '@services/profileStorage';

/**
 * The preferences Settings changes, as stored on the profile: the display
 * ones, and the timer's start delay range and beep volume.
 */
export type Preferences = Pick<
  Profile,
  'appearance' | 'levelUnit' | 'startDelay' | 'beepVolume'
>;

export type PreferenceKey = keyof Preferences;

export type PreferencesContextValue = {
  /** The preferences the app is drawn with. */
  preferences: Preferences;
  /**
   * Apply one preference straight away and store it in the profile. If the
   * save fails that preference goes back to its last saved value and the
   * promise rejects with the service's `ProfileStorageError` — unless a
   * newer choice for the same preference was made meanwhile, in which case
   * it resolves and the newer choice stays. The other
   * preferences are never touched by the rollback.
   */
  setPreference: <K extends PreferenceKey>(
    key: K,
    value: Preferences[K],
  ) => Promise<void>;
};

export const PreferencesContext = createContext<PreferencesContextValue | null>(
  null,
);

export type PreferencesProviderProps = {
  children: ReactNode;
  /** Where the preferences are read from and saved to. Swapped in tests. */
  storage?: Pick<ProfileStorageServiceType, 'load' | 'update'>;
};

const preferencesOf = (profile: Readonly<Profile>): Preferences => ({
  appearance: profile.appearance,
  levelUnit: profile.levelUnit,
  startDelay: profile.startDelay,
  beepVolume: profile.beepVolume,
});

const DEFAULT_PREFERENCES: Readonly<Preferences> =
  preferencesOf(DEFAULT_PROFILE);

/**
 * Holds the preferences from the stored profile: the Appearance that
 * `useTheme()` resolves into the light or dark theme, the unit sound levels
 * are shown in, and the start delay range and beep volume the Timer's next
 * run uses.
 *
 * Nothing below it renders until the stored preferences have been read,
 * so a shooter who pinned dark never sees a light first frame from React.
 * The Appearance is also mirrored natively (`mirrorAppearance`) so the
 * window behind that first frame is already in the pinned theme at the
 * next cold start. The read is a single small key; if it fails the app
 * starts on the defaults rather than refusing to start.
 */
export const PreferencesProvider = ({
  children,
  storage = ProfileStorageService,
}: PreferencesProviderProps) => {
  const [preferences, setPreferences] =
    useState<Preferences>(DEFAULT_PREFERENCES);
  const [loaded, setLoaded] = useState(false);
  // The last preferences storage confirmed: what a failed save goes back to.
  const savedRef = useRef<Preferences>(DEFAULT_PREFERENCES);
  // Bumped by every change to a preference, so only the latest change to
  // that preference may roll it back.
  const changeIdsRef = useRef<Record<PreferenceKey, number>>({
    appearance: 0,
    levelUnit: 0,
    startDelay: 0,
    beepVolume: 0,
  });

  useEffect(() => {
    let active = true;
    storage
      .load()
      .then(profile => {
        if (active) {
          savedRef.current = preferencesOf(profile);
          setPreferences(savedRef.current);
          mirrorAppearance(profile.appearance);
        }
      })
      // A failed read keeps the defaults; the shooter can still change
      // them, and that save is reported if storage stays broken.
      .catch(() => {})
      .finally(() => {
        if (active) {
          setLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, [storage]);

  const setPreference = useCallback(
    async <K extends PreferenceKey>(
      key: K,
      value: Preferences[K],
    ): Promise<void> => {
      const changeId = changeIdsRef.current[key] + 1;
      changeIdsRef.current = { ...changeIdsRef.current, [key]: changeId };
      setPreferences(current => ({ ...current, [key]: value }));
      try {
        // A one-field change: `key` is a preference, so this is a valid
        // `ProfileChanges` that TypeScript cannot narrow from a computed key.
        const profile = await storage.update({ [key]: value } as Pick<
          Preferences,
          K
        >);
        savedRef.current = { ...savedRef.current, [key]: profile[key] };
        if (key === 'appearance') {
          mirrorAppearance(profile.appearance);
        }
      } catch (err) {
        // A newer choice has been made since: what is on screen is that
        // one, and its own save reports how it went, so this failure is
        // no longer the shooter's concern.
        if (changeIdsRef.current[key] !== changeId) {
          return;
        }
        const saved = savedRef.current[key];
        setPreferences(current => ({ ...current, [key]: saved }));
        throw err;
      }
    },
    [storage],
  );

  const value = useMemo(
    () => ({ preferences, setPreference }),
    [preferences, setPreference],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {loaded ? children : null}
    </PreferencesContext.Provider>
  );
};
