import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      // 禁止硬编码飞书字段名（Schema驱动保护规则）
      'no-restricted-syntax': ['error', {
        selector: 'MemberExpression[object.name=fields]',
        message: '禁止直接访问 fields[字段名]，请使用 useTableData Hook 获取数据并通过 dataKey 访问'
      }],
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
])

export default eslintConfig
