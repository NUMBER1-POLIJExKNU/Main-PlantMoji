import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Honor the repo's `_`-prefix convention for intentionally unused
      // bindings (e.g. the `const { key: _key, ...rest }` omit idiom in
      // tests). Without these options the prefix was purely decorative.
      // Deliberately no blanket ignoreRestSiblings-only setup: unprefixed
      // dead variables must stay visible.
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        ignoreRestSiblings: true,
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored, pinned Supabase browser bundle. Lint the integration code,
    // not third-party minified output checked in for offline demos.
    "public/farm/vendor/**",
  ]),
]);

export default eslintConfig;
