import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"],
    watch: false,
    server: {
      deps: {
        // @hyperframes/core's ESM dist uses extensionless relative imports,
        // which plain Node ESM rejects — let vite resolve them instead.
        inline: [/@hyperframes[\\/]core/],
      },
    },
  },
});
