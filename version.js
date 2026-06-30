/* BreakOut — global version. Bump in lock-step with apa_core.apps.BreakOut.
   IS_PREPROD URL guard (in index.html) bypasses checkVersion on /preprod/,
   so the preprod build can use a real semver matching what production
   will become after promote.sh copies this file up. */
window.APP_VERSION = '1.21';
