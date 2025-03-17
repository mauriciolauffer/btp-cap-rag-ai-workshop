import { defineConfig } from "eslint/config";
import cds from "@sap/cds/eslint.config.mjs";
import nodeConfig from "eslint-config-mlauffer-nodejs";
import ui5Config from "eslint-config-mlauffer-ui5";

export default defineConfig([
  {
    name: "local-ignores",
    ignores: [
      "**/coverage/",
      "**/dist/",
      "**/gen/",
      "**/resources/",
      "@cds-models/",
    ],
  },
  {
    ignores: ["**/app/"],
    extends: [nodeConfig, cds.recommended],
  },
  {
    files: ["app/**/*.js"],
    extends: [ui5Config],
  },
]);
