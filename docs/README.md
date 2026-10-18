# BrassCount

[![Build (Android)](https://github.com/Rubber-Duck-Co/BrassCount/actions/workflows/build.yml/badge.svg)](https://github.com/Rubber-Duck-Co/BrassCount/actions/workflows/build.yml) [![Tests](https://github.com/Rubber-Duck-Co/BrassCount/actions/workflows/tests.yml/badge.svg)](https://github.com/Rubber-Duck-Co/BrassCount/actions/workflows/tests.yml) [![Lint & Type Check](https://github.com/Rubber-Duck-Co/BrassCount/actions/workflows/lint.yml/badge.svg)](https://github.com/Rubber-Duck-Co/BrassCount/actions/workflows/lint.yml) [![Security Audit](https://github.com/Rubber-Duck-Co/BrassCount/actions/workflows/security-audit.yml/badge.svg)](https://github.com/Rubber-Duck-Co/BrassCount/actions/workflows/security-audit.yml)

## Key scripts

- `npm start` — Metro bundler
- `npm run android` — Build & run on Android (debug)
- `npm run android:release` — Build release APK
- `npm test` — Jest

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for branch naming, commit message conventions, Husky git hooks, linting workflows, and PR guidelines.

## Notes

- Path aliases are mirrored in `babel.config.js`, `tsconfig.json`, and `jest.config.js`.
- For CI/release builds, ensure JDK 17 is installed and `JAVA_HOME` points to it.

## License

This repository is released under a proprietary "All rights reserved" license. See LICENSE for details.
