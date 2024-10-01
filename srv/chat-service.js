"use strict";

const cds = require("@sap/cds");

module.exports = class ChatService extends cds.ApplicationService {
  init() {

    throw new Error("ChatService has to be implemented!");

    return super.init();
  }
};
