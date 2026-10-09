# Development

Use Node.js 24, install the lockfile with `npm ci --ignore-scripts`, and install
the test browser with `npx playwright install chromium`. On Linux,
`npx playwright install --with-deps chromium` also installs the browser's system
dependencies; this may require administrator access. After upgrading Playwright,
[install its matching browser binaries again](https://playwright.dev/docs/browsers).

## Commands

| Command                                 | Purpose                                                   |
| --------------------------------------- | --------------------------------------------------------- |
| `npm run dev`                           | Generate sprites and serve `html/` at `127.0.0.1:8080`.   |
| `npm run generate-sprites`              | Rebuild ignored sprite sheets and their manifest.         |
| `npm run check`                         | Run all formatting, lint, type, unit, and browser checks. |
| `npm test`                              | Run Node's tests, including deployment tests on Linux.    |
| `npm run test:browser`                  | Generate sprites and run the Chromium smoke test.         |
| `npm run typecheck`                     | Check the JavaScript modules covered by `tsconfig.json`.  |
| `npm run format:check` / `npm run lint` | Check formatting or lint independently.                   |
| `npm run fix`                           | Apply Prettier formatting and ESLint's automatic fixes.   |

The main page controller currently uses `@ts-nocheck`; a passing type check covers
the other included modules. Browser tests exercise the controller at runtime.
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

| Path                                                                     | Responsibility                                               |
| ------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `html/index.htm`                                                         | Main application document; `index.html` redirects here.      |
| `html/foodguide.js`                                                      | Page state, tabs, ingredient pickers, and UI wiring.         |
| `html/food.js`, `html/recipes.js`                                        | Food and recipe data and initialization.                     |
| `html/constants.js`, `html/mode-utils.js`, `html/functions.js`           | Game constants, mode/character logic, and recipe predicates. |
| `html/recipe-calculator.js`, `html/recipe-analyzer.js`                   | Search, recipe matching, and batched combination analysis.   |
| `html/dropdown.js`, `html/sortable-table.js`, `html/theme-controller.js` | Shared UI controls.                                          |
| `html/strings.js`, `html/locales/`                                       | Translation helpers and locale dictionaries.                 |
| `html/style/`, `html/img/`                                               | Styles and original icon assets.                             |
| `scripts/generate-sprites.js`                                            | Sprite sheet generator using Sharp.                          |
| `tests/`                                                                 | Unit, regression, deployment, and browser smoke tests.       |
| `.github/workflows/`                                                     | Shared checks, CI, and deployment.                           |

## Updating assets and data

Keep source icons in `html/img/`. The generator accepts PNG, WebP, JPEG, and `.jpg`
files, normalizes them to 64-pixel cells, and excludes the background texture.
`html/img/sprites/` is generated and ignored by Git. Every static deployment must
generate and copy these files together with the rest of `html/`.

Add recipe changes to `html/recipes.js` and ingredient changes to `html/food.js`.
Keep recipe `test` functions and displayed `requirements` consistent, and add a
regression for the ingredient combination or mode involved. Preserve mode-specific
keys and cross-references as described in the [data guide](data.md).

## Dependency maintenance

Use `npm outdated` and `npm audit` to review direct and transitive dependencies.
Update `package.json` and the lockfile together, reinstall Playwright's browser
after a version change, and run `npm run check` before committing. Review major
version changes against upstream release notes. GitHub Actions are pinned to
full commit SHAs; update the version comment with each pin.

CI runs on pushes and pull requests targeting `main`. The deployment workflow
also runs the shared checks before publishing.
