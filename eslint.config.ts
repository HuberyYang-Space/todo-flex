import antfu from '@antfu/eslint-config'

export default antfu(
  {
    type: 'app',
    vue: true,
    typescript: true,
    unocss: true,
    markdown: false,
    formatters: {
      css: true,
      html: true,
    },
    rules: {
      'no-console': 'off',
    },
    ignores: ['**/public/**'],
  },
  {
    files: ['**/*.vue'],
    rules: {
      'vue/max-attributes-per-line': ['error', {
        singleline: { max: 6 },
        multiline: { max: 1 },
      }],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.vue'],
    rules: {
      'ts/no-explicit-any': 'off',
      'ts/consistent-type-imports': ['error', {
        prefer: 'type-imports',
        fixStyle: 'inline-type-imports',
      }],
      'ts/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
    },
  },
)
