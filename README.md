# als-browser

Browser-compatible polyfill for Node.js's `AsyncLocalStorage` API. This package
enables async context propagation in browser environments by patching common
async browser APIs.

## Features

- Full `AsyncLocalStorage` API compatibility
- Automatic patching of browser async APIs
- Zero dependencies (dev dependencies only)
- TypeScript support with full type definitions
- ESM and CommonJS builds
- Comprehensive test coverage

## Installation

```bash
npm install als-browser
# or
pnpm add als-browser
# or
yarn add als-browser
```

## Usage

```typescript
import { AsyncLocalStorage } from 'als-browser';

// Create a storage instance
const requestContext = new AsyncLocalStorage<{ userId: string }>();

// Use run() to execute code in a context
requestContext.run({ userId: '123' }, () => {
  console.log(requestContext.getStore()); // { userId: '123' }

  // Context is preserved through setTimeout
  setTimeout(() => {
    console.log(requestContext.getStore()); // { userId: '123' }
  }, 100);
});
```

## API

### `AsyncLocalStorage<T>`

#### `constructor(options?)`

```typescript
const store = new AsyncLocalStorage<T>({
  defaultValue?: T,  // Optional default value
  name?: string      // Optional name for debugging
});
```

#### `run(data, callback, ...args)`

Run a function in a new async context with the given data.

```typescript
const result = store.run(myData, () => {
  // Your code here
  return store.getStore(); // Returns myData
});
```

#### `getStore()`

Get the current value from this store.

```typescript
const currentValue = store.getStore();
```

#### `enterWith(data)`

Enter a new async context with the given data (no callback).

```typescript
store.enterWith(myData);
console.log(store.getStore()); // myData
```

#### `exit(callback, ...args)`

Run a function with the store value set to undefined.

```typescript
store.exit(() => {
  console.log(store.getStore()); // undefined
});
```

#### `disable()`

Remove this store from the current async context.

```typescript
store.disable();
```

#### Static: `bind(fn)`

Bind a function to the current async context.

```typescript
const boundFn = AsyncLocalStorage.bind(() => {
  return store.getStore();
});
```

#### Static: `snapshot()`

Capture the current async context and return a function that can restore it.

```typescript
const snapshot = AsyncLocalStorage.snapshot();
snapshot(() => {
  // Runs in captured context
});
```

### Manual Context Propagation

For advanced use cases like code transformers or custom async instrumentation, you can manually capture and restore async context around `await` points.

#### `capture(container, promise)`

Capture the current async context frame before an await and store it in a container object.

```typescript
import { capture, restore, SnapshotContainer } from 'als-browser';

const container: SnapshotContainer = {};
const result = restore(container, await capture(container, promise));
```

#### `restore(container, value)`

Restore the async context frame after an await from the container object.

```typescript
// Transform: await foo()
// Into: restore(container, await capture(container, foo()))

const container: SnapshotContainer = {};
store.run(myData, async () => {
  // Manually preserve context across await
  restore(container, await capture(container, asyncOperation()));
  console.log(store.getStore()); // myData is preserved
});
```

These functions are primarily useful for:
- Code transformers/compilers that automatically instrument async functions
- Custom async context tracking systems
- Debugging and understanding async context flow

**Note**: For normal application code, prefer using the automatic patches or `AsyncLocalStorage.bind()`/`snapshot()`.

## Patched Browser APIs

The following browser APIs are automatically patched to preserve async context:

### Timers
- `setTimeout`
- `setInterval`
- `setImmediate` (if available)

### Animation
- `requestAnimationFrame`
- `requestIdleCallback`

### Network
- `XMLHttpRequest` event handlers (addEventListener and on* properties)

## How It Works

This package implements Node.js's `AsyncContextFrame` model adapted for browsers:

1. **AsyncContextFrame**: A Map-based storage for async context, stored in a module-level variable
2. **AsyncLocalStorage**: The main API that stores and retrieves values from the current frame
3. **Browser API Patches**: Automatically wraps callbacks to preserve context across async boundaries

The implementation replaces Node.js's V8 embedder data APIs with a simple module-level variable, making it work in any JavaScript environment.

## Limitations

- **Promise-based APIs**: This package does not automatically patch promise-based APIs like `fetch()`. For those, you need to manually propagate context using `AsyncLocalStorage.bind()` or `AsyncLocalStorage.snapshot()`.
- **EventTarget.addEventListener**: Only `XMLHttpRequest` is patched. Other event targets may need manual context propagation.
- **Module-level state**: The context is stored in a module-level variable, which means it's shared across all code in the same JavaScript realm.

## Example: Request Tracing

```typescript
import { AsyncLocalStorage } from 'als-browser';

const requestId = new AsyncLocalStorage<string>();

function generateId() {
  return Math.random().toString(36).slice(2);
}

function log(message: string) {
  const id = requestId.getStore() || 'no-context';
  console.log(`[${id}] ${message}`);
}

// Start a request
requestId.run(generateId(), async () => {
  log('Request started');

  // Context preserved through setTimeout
  setTimeout(() => {
    log('Async operation 1');
  }, 100);

  // Context preserved through requestAnimationFrame
  requestAnimationFrame(() => {
    log('Animation frame');
  });

  // For fetch, manually bind
  const boundHandler = AsyncLocalStorage.bind(async () => {
    const response = await fetch('/api/data');
    log('Fetch completed');
    return response.json();
  });

  await boundHandler();
});
```

## Testing

```bash
# Run tests
pnpm test

# Build
pnpm build

# Type check
pnpm typecheck
```

## License

MIT

## Credits

This implementation is based on Node.js's `AsyncLocalStorage` and `AsyncContextFrame` APIs:
- `lib/internal/async_context_frame.js`
- `lib/internal/async_local_storage/async_context_frame.js`
