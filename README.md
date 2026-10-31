# biurko

## Installation

```sh
npm install --save @deseteral/biurko
```

## Development

### Setup

- [Bun](https://bun.sh/) runtime and package manager.
- Node.js `^22.18.0 || ^24.11.0 || >=26.0.0` for [Vite+](https://viteplus.dev/).

Use `bun install --frozen-lockfile` to install dependencies. Vite+ is installed locally; no global `vp` installation is required.

| Command              | Description                                           |
|----------------------|-------------------------------------------------------|
| `bun run build`       | Build the ESM library and declarations with `vp pack`. |
| `bun run build:demo`  | Build all three demo pages with `vp build`.            |
| `bun run demo`        | Start the Vite+ dev server with the demo app.           |
| `bun run typecheck`   | Run TypeScript type checking.                         |
| `bun run test`        | Run the existing Bun test command.                     |

`vp pack` builds the library; `vp build demo/` builds the demo application. To run these local commands directly, use `bunx --no-install vp`. The test runner remains Bun. Linting and formatting are not configured.

### Demo app

```sh
bun run demo
```

This starts a local dev server serving the `demo/` directory. There are three demo apps available:

- `/` - vanilla DOM demo
- `/react.html` - React integration demo
- `/solid.html` - SolidJS integration demo

## License

This project is licensed under the [MIT license](LICENSE).
