---
paths:
  - '**/*.ts'
  - '**/*.tsx'
  - '**/*.js'
  - '**/*.jsx'
---

# TypeScript/JavaScript Testing

> This file extends [common/testing.md](../common/testing.md) with TypeScript/JavaScript specific content.

## Typing Tests

- Test files are type-checked by `npm run typecheck` (`tsconfig.json` includes `**/*.ts(x)` with Jest types), so a type error in a test fails CI.
- Type fakes against the real interface so they break when the contract changes, and hand them to the service through its options:

```typescript
const listeners = new Set<(reading: AmplitudeReading) => void>();

const audio: jest.Mocked<CalibrationCaptureAudio> = {
  hasPermission: jest.fn(async () => true),
  requestPermission: jest.fn(async () => 'granted' as const),
  start: jest.fn(async () => {}),
  stop: jest.fn(async () => {}),
  subscribeToAmplitude: jest.fn(listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }),
  subscribeToErrors: jest.fn(_listener => () => {}),
};

const sample = captureSample({ audio, durationMs: 250 });
```

- Storage services run against the global in-memory AsyncStorage mock rather than a fake namespace. Pin their ids and timestamps through the options (`saveSession(input, { generateId, getTimestamp })`).

- Cast a mocked function with `as jest.Mock` (or `jest.mocked(fn)`) rather than `as any`.

## Async Assertions

- `await expect(promise).resolves…` / `.rejects.toBeInstanceOf(StorageError)` — always awaited, or the assertion is skipped.
- Assert on the error class, not on message text.

## End-to-End

No E2E framework is installed. Do not add one (or write tests that assume one) without the user deciding to.
