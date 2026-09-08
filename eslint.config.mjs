import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'public/**', 'prisma/migrations/**'] },
  ...nextCoreWebVitals,
]

export default config
