"use strict";

sap.ui.define(
  ["sap/base/Log", "sap/ui/core/mvc/Controller"],
  function (Log, BaseController) {
    const logger = Log.getLogger("ai-workshop-embed");

    return BaseController.extend("embedding.controller.App", {
      onCreateEmbeddings: async function (evt) {
        await evt.getSource().getObjectBinding().execute();
        this.byId("s4data").getModel().refresh();
      },

      onDeleteEmbeddings: async function (evt) {
        await evt.getSource().getObjectBinding().execute();
        this.byId("s4data").getModel().refresh();
      },

      getODataModelUrl: function () {
        return this.getOwnerComponent().getManifestEntry("sap.app").dataSources
          .mainService.uri;
      },
    });
  },
);
