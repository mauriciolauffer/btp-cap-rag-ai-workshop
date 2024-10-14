"use strict";

const cds = require("@sap/cds");

module.exports = class ProductService extends cds.ApplicationService {
  async init() {
    const productExt = await cds.connect.to("API_PRODUCT_SRV");
    const {
      A_Product,
      A_ProductBasicText,
      A_ProductDescription,
      A_ProductPurchaseText,
      A_ProductSalesDelivery,
      A_ProductSalesText,
    } = cds.entities;

    this.on(
      "READ",
      [
        A_Product,
        A_ProductBasicText,
        A_ProductDescription,
        A_ProductPurchaseText,
        A_ProductSalesDelivery,
        A_ProductSalesText,
      ],
      async (req) => {
        return productExt.run(req.query);
      },
    );

    return super.init();
  }
};
