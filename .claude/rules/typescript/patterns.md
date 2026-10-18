---
paths:
  - '**/*.ts'
  - '**/*.tsx'
  - '**/*.js'
  - '**/*.jsx'
---

# TypeScript/JavaScript Patterns

> This file extends [common/patterns.md](../common/patterns.md) with TypeScript/JavaScript specific content.

## Service Module

Functions, a named error, and an object-form handle:

```typescript
export class DrillStorageError extends StorageError {
  readonly code: DrillStorageErrorCode;

  constructor(message: string, code: DrillStorageErrorCode, cause?: unknown) {
    super(message, cause);
    this.name = 'DrillStorageError';
    this.code = code;
  }
}

export async function saveDrill(input: DrillInput): Promise<Drill> {
  // …
}

export async function loadDrills(): Promise<Drill[]> {
  // …
}

/** Object-form export for callers that prefer a service handle. */
export const DrillStorageService = {
  save: saveDrill,
  loadAll: loadDrills,
};

export type DrillStorageServiceType = typeof DrillStorageService;
```

## Typed Storage Namespace

```typescript
// Typed `unknown`: the storage layer only promises valid JSON.
const drills = createStorageNamespace<unknown>({
  name: DRILL_NAMESPACE,
  version: DRILL_STORAGE_VERSION,
});

const stored: StoredDrill = { schemaVersion: DRILL_SCHEMA_VERSION, drill };
await drills.setItem(drill.id, stored);

const raw = await drills.getItem(id); // unknown, null when missing or corrupt
const loaded = raw === null ? null : parseStoredDrill(raw, id); // Drill | null
```

`getItem` resolves to `null` for a missing or unparseable entry; `getAll` skips them. The domain service stores a `{ schemaVersion, … }` envelope, validates every read field by field, and upgrades older envelopes; callers never parse JSON themselves.

## Injectable Dependencies

Pass collaborators and sources of non-determinism through an options object with production defaults, so tests supply fakes without `jest.mock`:

```typescript
export interface ShuffleOptions {
  random?: () => number;
}

export const pickDelayMs = (
  minMs: number,
  maxMs: number,
  { random = Math.random }: ShuffleOptions = {},
): number => Math.round(minMs + random() * (maxMs - minMs));
```

## Custom Hook

```typescript
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}
```

## Themed Style Factory

```typescript
const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
    },
  });

// inside the component
const styles = useThemedStyles(createStyles);
```

## Ids and Timestamps

Use `generateId()` from `@utils/id` and `getTimestamp()` from `@utils/timestamp` rather than calling `uuid` or `new Date().toISOString()` inline, so ids and timestamps stay consistent and easy to fake.
