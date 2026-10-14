// Extra Vitest options for `ng test` (referenced by `runnerConfig` in angular.json).
// Vitest persists transformed modules in node_modules/.vitest-cache by default
// (`fsModuleCache: true`). That cache served stale spec bundles, so tests could
// pass against outdated sources. Correctness over cache speed: disable it.
export default {
  test: {
    fsModuleCache: false,
  },
};
