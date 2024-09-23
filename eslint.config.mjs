import cds from "@sap/cds/eslint.config.mjs";
import nodeConfig from "eslint-config-mlauffer-nodejs";
import ui5Config from "eslint-config-mlauffer-ui5";

export default [
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
  ...nodeConfig,
  ...cds.recommended,
  {
    name: "local-nodejs",
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
    }
  },
  //{
    //name: "local-nodejs",
    //files: ["srv/**/*.js"],
    //languageOptions: {
      //sourceType: "commonjs",
    //}
  //},
  //...ui5Config.map((config) => ({
    //...config,
    //files: ["app/**/*.js"],
  //}))
];
