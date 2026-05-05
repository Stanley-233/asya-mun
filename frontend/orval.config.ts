import { defineConfig } from 'orval';

export default defineConfig({
  api: {
    input: {
      // 开发环境使用本地 API 文档
      target: 'http://127.0.0.1:8080/v3/api-docs.yaml',
    },
    output: {
      mode: 'tags-split',
      target: 'lib/api/endpoints',
      client: 'react-query',
      baseUrl: '/',
      override: {
        mutator: {
          path: 'lib/api/client.ts',
          name: 'customInstance',
        },
      },
      clean: true,
    },
    hooks: {
      afterAllFilesWrite: 'prettier --write',
    },
  },
});
