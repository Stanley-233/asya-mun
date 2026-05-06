import { defineConfig } from 'orval';

export default defineConfig({
  api: {
    input: {
      // 开发环境使用本地 API 文档
      target: 'http://127.0.0.1:8080/v3/api-docs',
    },
    output: {
      target: '.orval/api.ts',
      mode: 'single',
      client: 'axios-functions',
      schemas: 'lib/api/generated',
      indexFiles: true,
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
