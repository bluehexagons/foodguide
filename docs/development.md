# Development

Use Node.js 24, install the lockfile with `npm ci --ignore-scripts`, and install
the test browser with `npx playwright install chromium`. On Linux,
`npx playwright install --with-deps chromium` also installs the browser's system
dependencies; this may require administrator access. After upgrading Playwright,
[install its matching browser binaries again](https://playwright.dev/docs/browsers).

## Commands

| Command                                 | Purpose                                                                 |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `npm run dev`                           | Build modules, generate sprites, and serve `html/` at `127.0.0.1:8080`. |
| `npm run build`                         | Compile source modules to the existing `html/*.js` browser paths.       |
| `npm run generate-sprites`              | Rebuild ignored sprite sheets and their manifest.                       |
| `npm run check`                         | Run all formatting, lint, type, unit, and browser checks.               |
| `npm test`                              | Run Node's tests, including deployment tests on Linux.                  |
| `npm run test:browser`                  | Generate sprites and run the Chromium smoke test.                       |
| `npm run typecheck`                     | Check the source modules covered by `tsconfig.json`.                    |
| `npm run format:check` / `npm run lint` | Check formatting or lint independently.                                 |
| `npm run fix`                           | Apply oxfmt formatting and oxlint's safe automatic fixes.               |

All production modules, including the page controller and sprite generator, use
strict TypeScript. JavaScript tests exercise the compiled browser modules. oxlint
checks TypeScript sources and JavaScript tests with correctness rules and rejects
explicit `any`; warnings fail CI. oxfmt formats source, styles, HTML, documentation,
and configuration. Generated output and the npm-managed lockfile are excluded.
The compiler separately checks strict types and public library declarations.
Unit tests also pack the library and install it offline into a temporary consumer,
then check its runtime exports and strict NodeNext and bundler type resolution.
`PLAYWRIGHT_EXECUTABLE_PATH` can select an existing Chromium executable for the
smoke test; CI uses the browser downloaded for the locked Playwright version.

On Linux, install Git, Bash, `flock` (usually supplied by `util-linux`), and `rsync`
for the deployment integration tests. Those tests use temporary repositories and
serving directories to verify asset generation and failure handling. They are
skipped on other operating systems.

When Go is installed, a separate test uses Go's template parser to verify the
webhook configuration and JSON escaping of its secret. That test is skipped when
Go is unavailable; the application itself does not require Go.

## Layout

| Path                                                                  | Responsibility                                               |
| --------------------------------------------------------------------- | ------------------------------------------------------------ |
| `html/index.htm`                                                      | Main application document; `index.html` redirects here.      |
| `src/foodguide.ts`                                                    | Page state, tabs, ingredient pickers, and UI wiring.         |
| `src/food.ts`, `src/recipes.ts`                                       | Food and recipe data and initialization.                     |
| `src/constants.ts`, `src/mode-utils.ts`, `src/functions.ts`           | Game constants, mode/character logic, and recipe predicates. |
| `src/recipe-calculator.ts`, `src/recipe-analyzer.ts`                  | Search, recipe matching, and batched combination analysis.   |
| `src/dropdown.ts`, `src/sortable-table.ts`, `src/theme-controller.ts` | Shared UI controls.                                          |
| `src/strings.ts`, `src/locales/`                                      | Translation helpers and locale dictionaries.                 |
| `html/style/`, `html/img/`                                            | Styles and original icon assets.                             |
| `tools/generate-sprites.ts`                                           | Sprite sheet generator using Sharp.                          |
| `tests/`                                                              | Unit, regression, deployment, and browser smoke tests.       |
| `.github/workflows/`                                                  | Shared checks, CI, and deployment.                           |

TypeScript sources live in `src/`; `npm run build` writes ignored JavaScript and
declarations to `html/`, retaining the existing module URLs. Edit the source files,
then rebuild before opening `html/index.htm` or importing the library.
`npm run build:watch` recompiles browser sources while you edit. Node build tools
live in `tools/` and compile to `scripts/`. `npm ci --ignore-scripts` requires an
explicit build; normal installs and package creation run it automatically.

## Updating assets and data

Keep source icons in `html/img/`. The generator accepts PNG, WebP, JPEG, and `.jpg`
files, normalizes them to 64-pixel cells, and excludes the background texture.
`html/img/sprites/` is generated and ignored by Git. Every static deployment must
generate and copy these files together with the rest of `html/`.

Add recipe changes to `src/recipes.ts` and ingredient changes to `src/food.ts`.
Keep recipe `test` functions and displayed `requirements` consistent, and add a
regression for the ingredient combination or mode involved. Preserve mode-specific
keys and cross-references as described in the [data guide](data.md).

## Dependency maintenance

Use `npm outdated` and `npm audit` to review direct and transitive dependencies.
Update `package.json` and the lockfile together, reinstall Playwright's browser
after a version change, and run `npm run check` before committing. Review major
version changes against upstream release notes. GitHub Actions are pinned to
full commit SHAs; update the version comment with each pin.

CI runs dependency audits and checks on pushes and pull requests targeting `main`, and on the migration feature branch.
The deployment workflow also runs the shared checks before publishing.
