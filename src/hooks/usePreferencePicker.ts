import { useCallback, useState } from 'react';

export type UsePreferencePickerResult<T> = {
  /** Whether the picker's sheet is showing. */
  open: boolean;
  /** Whether the last choice failed to save. */
  saveFailed: boolean;
  /** Close the sheet and save `value`. */
  choose: (value: T) => void;
  show: () => void;
  hide: () => void;
};

/**
 * Track a preference picker: whether its sheet is open and whether the
 * last choice failed to save. Choosing closes the sheet and saves; the
 * preference itself rolls back on a failure, so only the error is kept
 * here.
 */
export const usePreferencePicker = <T>(
  save: (value: T) => Promise<void>,
): UsePreferencePickerResult<T> => {
  const [open, setOpen] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const choose = useCallback(
    (value: T) => {
      setOpen(false);
      setSaveFailed(false);
      save(value).catch(() => setSaveFailed(true));
    },
    [save],
  );

  return {
    open,
    saveFailed,
    choose,
    show: useCallback(() => setOpen(true), []),
    hide: useCallback(() => setOpen(false), []),
  };
};
