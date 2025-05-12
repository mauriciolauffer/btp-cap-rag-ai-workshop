"use strict";

sap.ui.define(
  ["sap/base/Log", "sap/ui/core/mvc/Controller"],
  function (Log, BaseController) {
    const logger = Log.getLogger("ai-workshop-embed");

    return BaseController.extend("embedding.controller.App", {
      onDeleteEmbeddings: async function (evt) {
        await evt.getSource().getObjectBinding().execute();
        this.byId("uploadSet").getModel().refresh()
      },

      onAfterItemAdded: async function (evt) {
        const item = evt.getParameter("item");
        try {
          const response = await this.createEntity(item);
          this.uploadContent(item, response.ID);
        } catch (err) {
          logger.error(err);
          throw new Error("Upload error.", { reason: err });
        }
      },

      onUploadCompleted: function (evt) {
        const oUploadSet = evt.getSource();
        oUploadSet.removeAllIncompleteItems();
        oUploadSet.getBinding("items").refresh();
      },

      onRemoveItem: function (evt) {
        const oUploadSet = evt.getSource();
        oUploadSet.removeAllIncompleteItems();
        oUploadSet.getBinding("items").refresh();
      },

      createEntity: async function (item) {
        const payload = {
          ID: window.crypto.randomUUID(),
          mediaType: item.getMediaType(),
          fileName: item.getFileName(),
          size: item.getFileObject().size.toString(),
        };
        const context = item.getParent().getBinding("items").create(payload);
        await context.created();
        return context.getObject();
      },

      uploadContent: function (item, fileId) {
        const url = this.getODataModelUrl() + `Files(${fileId})/content`;
        item.setUploadUrl(url);
        const oUploadSet = this.byId("uploadSet");
        oUploadSet.setHttpRequestMethod("PUT");
        oUploadSet.uploadItem(item);
      },

      getODataModelUrl: function() {
        return this.getOwnerComponent().getManifestEntry("sap.app").dataSources.mainService.uri;
      }
    });
  }
);
