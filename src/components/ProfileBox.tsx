import { useCallback, useState } from 'react';

import { Keyboard, StyleSheet, View } from 'react-native';

import type { Theme } from '@/theme/theme';
import {
  HANDLE_PREFIX,
  MAX_PROFILE_HANDLE_LENGTH,
  MAX_PROFILE_NAME_INPUT_LENGTH,
  type Profile,
  type ProfileChanges,
} from '@/types/profile';
import type { UseProfileOverviewResult } from '@hooks/useProfileOverview';
import { useThemedStyles } from '@hooks/useTheme';
import { ProfileStorageError } from '@services/profileStorage';
import { pluralize } from '@utils/format';
import { profileHandleError, profileNameError } from '@utils/profile';

import { Avatar } from './Avatar';
import { Button } from './Button';
import { Card } from './Card';
import { EmptyState } from './EmptyState';
import { TextField } from './TextField';
import { Typography } from './Typography';

const NO_NAME = 'No name set';
const HANDLE_HINT = 'Optional. Shown on your profile only.';

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // A minimum, so a large font or a long name grows the box.
    identityBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.inset,
      minHeight: theme.sizes.profileBoxMin,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.inset,
    },
    identity: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.inset,
    },
    identityText: { flex: 1 },
    loading: {
      minHeight: theme.sizes.profileBoxMin,
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.inset,
    },
    form: {
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.inset,
    },
    // Capitals from the style, so TalkBack reads the word.
    formLabel: { textTransform: 'uppercase' },
    formActions: {
      flexDirection: 'row',
      gap: theme.spacing.inset,
    },
    formButton: { flex: 1 },
  });

/**
 * Words for a failed save. The service's own message is written for a
 * developer, so the shooter is only told which kind of failure it was.
 */
const saveErrorMessage = (err: unknown): string =>
  err instanceof ProfileStorageError && err.code === 'INVALID_INPUT'
    ? 'That name or handle cannot be saved. Check them and try again.'
    : 'Could not save your profile. Try again.';

type ProfileEditorProps = {
  profile: Profile;
  /**
   * Store the changes. Resolves once they are saved; a rejection keeps
   * the form open with what was typed.
   */
  onSave: (changes: ProfileChanges) => Promise<void>;
  onCancel: () => void;
};

/** Name and handle form that takes the identity row's place in the box. */
const ProfileEditor = ({ profile, onSave, onCancel }: ProfileEditorProps) => {
  const styles = useThemedStyles(createStyles);
  const [name, setName] = useState(profile.name ?? '');
  const [handle, setHandle] = useState(profile.handle ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const nameError = profileNameError(name);
  const handleError = profileHandleError(handle);
  const canSave = !saving && nameError === null && handleError === null;

  const submit = async () => {
    if (!canSave) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      // On success the box closes the form, so there is no state left to
      // reset here.
      await onSave({ name, handle });
    } catch (err) {
      setSaveError(saveErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <View style={styles.form} testID="form-profile">
      <Typography
        variant="sectionLabel"
        color="textSecondary"
        accessibilityRole="header"
        style={styles.formLabel}
      >
        Shooter
      </Typography>
      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Your name"
        maxLength={MAX_PROFILE_NAME_INPUT_LENGTH}
        autoCapitalize="words"
        editable={!saving}
        error={nameError}
        testID="input-profile-name"
      />
      <TextField
        label="Handle"
        value={handle}
        onChangeText={setHandle}
        placeholder={`${HANDLE_PREFIX}martymcfly`}
        maxLength={MAX_PROFILE_HANDLE_LENGTH + HANDLE_PREFIX.length}
        autoCapitalize="none"
        autoCorrect={false}
        mono
        editable={!saving}
        error={handleError}
        hint={HANDLE_HINT}
        testID="input-profile-handle"
      />

      {saveError ? (
        <Typography
          variant="caption"
          color="danger"
          accessibilityLiveRegion="polite"
          testID="text-profile-save-error"
        >
          {saveError}
        </Typography>
      ) : null}

      <View style={styles.formActions}>
        <Button
          label="Cancel"
          variant="secondary"
          onPress={onCancel}
          disabled={saving}
          style={styles.formButton}
          testID="btn-cancel-profile"
        />
        <Button
          label={saving ? 'Saving…' : 'Save'}
          onPress={submit}
          busy={saving}
          disabled={!canSave}
          style={styles.formButton}
          testID="btn-save-profile"
        />
      </View>
    </View>
  );
};

type IdentityProps = {
  profile: Profile;
  runCount: number;
  drillCount: number;
  onEdit: () => void;
};

/**
 * The shooter at a glance: the initials square, the name, and the handle
 * with the run and drill counts on one mono line. Read as one phrase,
 * with Edit beside it as its own button.
 */
const Identity = ({ profile, runCount, drillCount, onEdit }: IdentityProps) => {
  const styles = useThemedStyles(createStyles);
  const runs = pluralize(runCount, 'run');
  const drills = pluralize(drillCount, 'drill');
  const meta = [profile.handle, runs, drills].filter(Boolean).join(' · ');
  const spoken = [profile.name ?? NO_NAME, profile.handle, runs, drills]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={styles.identityBox}>
      <View
        style={styles.identity}
        accessible
        accessibilityLabel={spoken}
        testID="text-profile-identity"
      >
        <Avatar name={profile.name ?? ''} />
        <View style={styles.identityText}>
          <Typography
            variant="bodyStrong"
            color={profile.name ? 'textPrimary' : 'textSecondary'}
            testID="text-profile-name"
          >
            {profile.name ?? NO_NAME}
          </Typography>
          <Typography
            variant="metricCaption"
            color="textSecondary"
            testID="text-profile-meta"
          >
            {meta}
          </Typography>
        </View>
      </View>
      <Button
        label="Edit"
        accessibilityLabel="Edit profile"
        variant="text"
        onPress={onEdit}
        testID="btn-edit-profile"
      />
    </View>
  );
};

type ProfileBoxProps = Pick<
  UseProfileOverviewResult,
  'state' | 'reload' | 'saveProfile'
>;

/**
 * Setup's profile box: who the shooter is on this device and how much they
 * have recorded, edited in place. There is no account behind any of it.
 * A profile that cannot be read says so with a retry; the rest of Setup
 * does not depend on it.
 */
export const ProfileBox = ({ state, reload, saveProfile }: ProfileBoxProps) => {
  const styles = useThemedStyles(createStyles);
  const [editing, setEditing] = useState(false);

  const closeEditor = useCallback(() => {
    Keyboard.dismiss();
    setEditing(false);
  }, []);

  const save = useCallback(
    async (changes: ProfileChanges) => {
      await saveProfile(changes);
      closeEditor();
    },
    [saveProfile, closeEditor],
  );

  if (state.status === 'loading') {
    return (
      <Card flush>
        <View style={styles.loading}>
          <Typography
            variant="body"
            color="textSecondary"
            testID="text-profile-loading"
          >
            Loading your profile…
          </Typography>
        </View>
      </Card>
    );
  }

  if (state.status === 'error') {
    return (
      <Card>
        <EmptyState
          mark="error"
          title="Could not load your profile"
          message="Something went wrong reading it from this device."
          actionLabel="Try again"
          onActionPress={reload}
          testID="state-profile-error"
        />
      </Card>
    );
  }

  const { profile, runCount, drillCount } = state.overview;

  return (
    <Card flush testID="box-profile">
      {editing ? (
        <ProfileEditor profile={profile} onSave={save} onCancel={closeEditor} />
      ) : (
        <Identity
          profile={profile}
          runCount={runCount}
          drillCount={drillCount}
          onEdit={() => setEditing(true)}
        />
      )}
    </Card>
  );
};
