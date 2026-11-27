import AsyncStorage from '@react-native-async-storage/async-storage';

import { PRESET_DRILLS } from '../src/constants/presetDrills';
import { loadDrills, saveDrill } from '../src/services/drillStorage';
import { MAX_DRILL_NAME_LENGTH } from '../src/types/drill';
import { countShots, describeDrill, totalPar } from '../src/utils/drill';

/**
 * The standard drills the Presets screen offers. Each is only ever saved
 * as the shooter's own copy, so every one must pass the same validation as
 * a drill built in the editor.
 */

const metaOf = (index: number): string => {
  const { steps } = PRESET_DRILLS[index].drill;
  return describeDrill({
    shotCount: countShots(steps),
    totalPar: totalPar(steps),
  });
};

describe('PRESET_DRILLS', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('offers the five standard drills, in order', () => {
    expect(PRESET_DRILLS.map(preset => preset.drill.name)).toEqual([
      'Bill Drill',
      'El Presidente',
      'Failure to Stop',
      'F.A.S.T.',
      '1-Reload-1',
    ]);
  });

  it('gives every preset its own id and a description', () => {
    const ids = PRESET_DRILLS.map(preset => preset.id);

    expect(new Set(ids).size).toBe(ids.length);
    PRESET_DRILLS.forEach(preset => {
      expect(preset.description.trim()).not.toBe('');
    });
  });

  it('keeps every name within the length a drill name may have', () => {
    PRESET_DRILLS.forEach(preset => {
      expect(preset.drill.name.length).toBeLessThanOrEqual(
        MAX_DRILL_NAME_LENGTH,
      );
    });
  });

  it('times every step, so each preset has a total par', () => {
    PRESET_DRILLS.forEach(preset => {
      expect(preset.drill.steps.every(step => step.par !== undefined)).toBe(
        true,
      );
    });
  });

  it('leaves step ids to the service, like any new drill', () => {
    PRESET_DRILLS.forEach(preset => {
      expect(preset.drill.steps.every(step => step.id === undefined)).toBe(
        true,
      );
    });
  });

  it.each(PRESET_DRILLS.map((preset, index) => [preset.drill.name, index]))(
    'saves %s as a valid drill with its steps and pars',
    async (_name, index) => {
      const preset = PRESET_DRILLS[index];

      const saved = await saveDrill(preset.drill);

      expect(saved.name).toBe(preset.drill.name);
      expect(saved.steps.map(({ type, par }) => ({ type, par }))).toEqual(
        preset.drill.steps.map(({ type, par }) => ({ type, par })),
      );
      expect(saved.shotCount).toBe(countShots(preset.drill.steps));
      expect(saved.totalPar).toBe(totalPar(preset.drill.steps));
      expect(describeDrill(saved)).toBe(metaOf(index));
      expect(await loadDrills()).toHaveLength(1);
    },
  );

  it('adds up to the totals the canvas shows', () => {
    expect(PRESET_DRILLS.map((_preset, index) => metaOf(index))).toEqual([
      '6 shots · Par 3.00s',
      '12 shots · Par 10.00s',
      '3 shots · Par 2.50s',
      '6 shots · Par 5.00s',
      '2 shots · Par 4.00s',
    ]);
  });
});
