# ServiceContainer Pattern in This Project

## What is ServiceContainer?

`ServiceContainer` (`Library/Scripts/shared/core/ServiceContainer.js`) is a small registry of lazily created services. You register a factory under a name, and the first `get()` builds the service. Later `get()` calls return the same object.

It lives for **one action run only**. Drafts starts every action run in a fresh JavaScript context, so the container, every service in it, and every class static field begin empty each time. Nothing is reused across runs. The container does two jobs:

1. **Share services within a run.** For example, `ContentPipeline`, `Statuses` and `UlyssesDocument` all get the same `cpUI`, `cpFileSystem` and `ulysses` objects.
2. **Let tests swap in mocks.** A test registers `cpUI`, `cpDatabase`, `ulysses` and so on before it constructs the class under test.

## How classes use it

Each top-level class registers its own default services, but **only if nothing has registered them already**, and then reads them through lazy getters:

```javascript
// ContentPipeline constructor (abridged)
this.#services = ServiceContainer.getInstance();

if (!this.#services.has("cpUI")) {
  this.#services.register("cpUI", (c) => new DraftsUI(c.get("cpSettings").ui), true);
}

get ui() {
  if (!this.#ui) this.#ui = this.#services.get("cpUI");
  return this.#ui;
}
```

| Class | Registers |
|-------|-----------|
| `ContentPipeline` | `cpSettings`, `cpFileSystem`, `cpUI`, `textUtilities`, `ulysses` |
| `BVR` | `bvrSettings`, `bvrUI` |
| `Team` | `bvr` |

`cpDatabase` is deliberately **not** registered by production code. `ContentPipeline.db` uses a registered `cpDatabase` only when a test has supplied a mock. Otherwise it builds a `NocoController` for its own table.

## Actions

Actions construct what they need directly. There is no setup step:

```javascript
require("modules/cp/core/ContentPipeline.js");

const cp = new ContentPipeline();
cp.welcome();
```

```javascript
require("modules/bvr/core/BVR.js");

const team = new Team();
team.createPracticePlan();
```

## Testing with mocks

Reset the container, register the mocks, then construct the class. Its constructor skips any service that is already registered, so the mocks win:

```javascript
require("shared/core/ServiceContainer.js");
require("modules/cp/core/ContentPipeline.js");

const container = ServiceContainer.getInstance();
container.reset();

container.register('cpUI', () => createMockUI({ debug: false }), true);
container.register('cpDatabase', () => createMockDatabase(records), true);
container.register('ulysses', () => createMockUlysses({ debug: false }), true);

const contentPipeline = new ContentPipeline();
```

`container.resetSingletons()` drops cached instances but keeps the registrations. Use it when a test re-registers a service and wants a fresh object.

## History

In Oct 2025 the project added `getInstance()` singletons to `ContentPipeline`, `BVR` and `Team`, plus `ServiceFactories.js` and `ServiceInitializer.js`. The goal was to reuse objects across action runs and cut memory use. That assumed JavaScript state survives between runs. It doesn't: verified in Oct 2026, a global counter and a static class counter both read 1 on every run. The singletons, factories and initializer were removed, and the actions went back to constructing their objects directly.
