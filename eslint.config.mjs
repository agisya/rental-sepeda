import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    /**
     * Parameter berawalan garis bawah memang sengaja tidak dipakai.
     *
     * Bentuk argumen Server Action ditentukan kontrak useActionState, bukan oleh
     * kebutuhan action-nya sendiri, jadi ada action yang wajib menerima argumen
     * yang tidak pernah dibacanya. Awalan garis bawah sudah dipakai di seluruh
     * berkas ini untuk menandainya; aturannya tinggal disuruh menghormati itu.
     */
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
