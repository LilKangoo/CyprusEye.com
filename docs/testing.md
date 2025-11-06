# Testing Notes

The project relies on the Expo toolchain and Jest for automated testing. In the current CI-less environment the following
commands are expected to be used locally:

- `npm install` — installs Expo, React Native, Jest, and Playwright dependencies.
- `npm test` — runs the unit test suite through Jest.

When run from a sandboxed environment without full access to the npm registry, `npm install` may fail with a 403 response
for the scoped package `@expo/vector-icons`. Without the dependencies installed, invoking `npm test` will fail because the
`jest` binary is unavailable. Re-run the installation once registry access is restored before attempting the test suite.
