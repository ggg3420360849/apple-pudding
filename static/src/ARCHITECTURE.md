# Frontend architecture

The browser application is intentionally split by responsibility. The HTML
file is only the composition root: it loads the stylesheet and the layers in
dependency order.

## Layers

```text
bootstrap.js
    -> features/          user-facing use cases
    -> presentation/      rendering and DOM event coordination
    -> application/       transport-independent application services
    -> domain/            animal catalog and unlock rules
    -> core/              session lifecycle and application state
    -> infrastructure/    HTTP and browser persistence adapters
    -> shared/            small presentation helpers
```

## Dependency rules

- Feature and presentation code call `BlueAnimal.chat`; only the application
  service may call the HTTP adapter.
- Only the core session layer accesses `BlueAnimal.storage`; feature code does
  not use Web Storage directly.
- Domain files contain data and rules, not DOM or network operations.
- `bootstrap.js` is the only file that starts rendering.
- New product behavior belongs in a focused file under `features/`; avoid
  adding unrelated behavior to a generic global script.

The app still uses classic scripts because the existing generated templates
contain inline event handlers. The layer boundaries make a later migration to
ES modules or a component framework incremental instead of requiring another
big-bang rewrite.
