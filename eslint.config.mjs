// @ts-check
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', '**/node_modules/**', 'apps/**', '*.config.{js,mjs,ts}', '.changeset/**'],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // Enforce the no-any rule from CLAUDE.md
      '@typescript-eslint/no-explicit-any': 'error',
      // Allow _-prefixed unused vars (common in handlers)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // {} is used intentionally as a generic default constraint (e.g. VinextAuthConfig<U extends {}>)
      '@typescript-eslint/no-empty-object-type': 'off',
      // Non-null assertions are allowed but should be reviewed
      '@typescript-eslint/no-non-null-assertion': 'warn',
    },
  }
);
