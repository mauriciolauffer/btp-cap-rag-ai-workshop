"use strict";

const cds = require("@sap/cds");

module.exports = class EmbeddingService extends cds.ApplicationService {
  init() {

    throw new Error("EmbeddingService has to be implemented!");

    return super.init();
  }
};
