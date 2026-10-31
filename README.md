# biurko

## Installation

```sh
npm install --save @deseteral/biurko
```

## Development

### Setup

- Node.js `^22.18.0 || ^24.11.0 || >=26.0.0` for [Vite+](https://viteplus.dev/).
- npm 11.20.0 (the version pinned in `package.json` and used by CI and orb setup).

If needed, install the pinned npm version with `npm install --global npm@11.20.0`, then run `npm ci` to install dependencies from `package-lock.json`. Vite+ is installed locally; no global `vp` installation is required.

The project’s `.npmrc` saves exact dependency versions, disables install lifecycle scripts, and requires newly resolved package versions to be at least 31 days old. The release-age setting requires npm 11.10.0 or newer.

| Command                | Description                                            |
| ---------------------- | ------------------------------------------------------ |
| `npm run build`        | Build the ESM library and declarations with `vp pack`. |
| `npm run build:demo`   | Build all three demo pages with `vp build`.            |
| `npm run demo`         | Start the Vite+ dev server with the demo app.          |
| `npm run typecheck`    | Run TypeScript type checking.                          |
| `npm run lint`         | Run Oxlint rules and type checking.                    |
| `npm run check`        | Check formatting, lint rules, and types together.      |
| `npm run format`       | Format the project with Vite+ (Oxfmt).                 |
| `npm run format:check` | Check formatting without modifying files.              |

`vp pack` builds the library; `vp build demo/` builds the demo application. To run these local commands directly, use `npm exec --no -- vp`. There are currently no tests or test script.

Formatting uses the `fmt` block in `vite.config.ts` and the existing `.editorconfig` style. Linting uses Oxlint's default rules with type-aware linting and type checking enabled in the `lint` block. Linting includes the library and demo code, excluding generated output. `vp check` checks formatting, lint rules, and types together; TypeScript checking remains available separately through `npm run typecheck`.

CI runs formatting checks, type checking, and both builds on pushes and pull requests. Orb setup installs the pinned npm version when needed and runs `npm ci`; resume requires no additional setup.

### Demo app

```sh
npm run demo
```

This starts a local dev server serving the `demo/` directory. There are three demo apps available:

- `/` - vanilla DOM demo
- `/react.html` - React integration demo
- `/solid.html` - SolidJS integration demo

## License

This project is licensed under the [MIT license](LICENSE).
