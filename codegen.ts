import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "http://localhost:3000/api/graphql",
  documents: ["src/graphql/**/*.graphql"],
  generates: {
    "src/__generated__/graphql.ts": {
      plugins: ["typescript", "typescript-operations"],
      config: {
        avoidOptionals: true,
        enumsAsTypes: true,
      },
    },
  },
};

export default config;
