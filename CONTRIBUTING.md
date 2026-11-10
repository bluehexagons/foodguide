# Contributing

Bug reports, data corrections, translations, and pull requests are welcome. For
recipe reports, include the game version, DLC, character, ingredients, and a
source for the expected behavior.

See the [development guide](docs/development.md) for setup and checks, the
[data guide](docs/data.md) for food and recipe changes, and the
[localization guide](docs/localization.md) for translation sources.

## Releases

The guide's `package.json` is the source of its major.minor.patch version. Update
it and the lockfile together, validate the build, and tag the release commit as
`vMAJOR.MINOR.PATCH`. Builds display that version and the full Git commit in
About; source archives without Git metadata display `unknown` for the commit.
Unreleased builds can share a version, so use the commit to identify the build.

The desktop wrapper should embed the corresponding guide release and use the same
major.minor.patch. For a desktop-only fix use a SemVer prerelease suffix such as
`1.2.6-app.1`, with a matching `v1.2.6-app.1` tag in the app repository. Bump
the suffix for subsequent app-only fixes. A new guide release resets it.
