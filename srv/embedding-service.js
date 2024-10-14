"use strict";

const cds = require("@sap/cds");

/**
 * Get the configuration to the embedding model
 */
function getAiEmbeddingConfig() {
  const genAiHub = cds.env.requires["GENERATIVE_AI_HUB"];
  return {
    destinationName: genAiHub["EMBEDDING_MODEL_DESTINATION_NAME"],
    resourceGroup: genAiHub["EMBEDDING_MODEL_RESOURCE_GROUP"],
    deploymentUrl: genAiHub["EMBEDDING_MODEL_DEPLOYMENT_URL"],
    modelName: genAiHub["EMBEDDING_MODEL_NAME"],
    apiVersion: genAiHub["EMBEDDING_MODEL_API_VERSION"],
  };
}

/**
 * Convert text chunks to vector (embedding)
 */
async function getEmbeddingPayload(textChunks) {
  const aiEmbeddingConfig = getAiEmbeddingConfig();
  const textChunkEntries = [];
  const vectorplugin = await cds.connect.to("cap-llm-plugin");

  // Generate embeddings for each text chunk
  for (const chunk of textChunks) {
    const embedding = await vectorplugin.getEmbedding(
      aiEmbeddingConfig,
      JSON.stringify(chunk),
    );
    const entry = {
      productId: chunk.Product,
      productType: chunk.ProductType,
      textChunk: JSON.stringify(chunk),
      embedding: array2VectorBuffer(embedding?.data[0]?.embedding),
    };
    textChunkEntries.push(entry);
  }
  return textChunkEntries;
}

/**
 * Handle createEmbedding action, it creates the embeddings
 */
async function onCreateEmbeddings() {
  try {
    const { DocumentChunk } = cds.entities;
    const productService = await cds.connect.to("ProductService");
    const { A_Product } = productService.entities;
    const products = await productService
      .read(A_Product)
      .columns((product) => {
        product.Product,
          product.ProductType,
          product.to_Description((toDescription) => toDescription("*")),
          product.to_ProductBasicText((toProductBasicText) =>
            toProductBasicText("*"),
          ),
          product.to_ProductPurchaseText((toProductPurchaseText) =>
            toProductPurchaseText("*"),
          ),
          product.to_SalesDelivery((salesDelivery) => {
            salesDelivery.ProductSalesOrg,
              salesDelivery.ProductDistributionChnl,
              salesDelivery.to_SalesText((expand) => expand("*"));
          });
      })
      .limit(10); // TODO: Limiting to 10 just to make the tests faster
    const textChunkEntries = await getEmbeddingPayload(products);

    // Delete all entries to simplify the demo. Do not do it in real scenarios unless you really need it.
    await cds.delete(DocumentChunk);
    // Insert the text chunk with embeddings into db
    await cds.insert(textChunkEntries).into(DocumentChunk);
  } catch (err) {
    throw new Error(
      `Error while generating and storing vector embeddings: ${err?.message}`,
      {
        cause: err,
      },
    );
  }
}

/**
 * Handle deleteEmbeddings action, it deletes all embeddings
 */
async function onDeleteEmbeddings() {
  const { DocumentChunk } = cds.entities;
  try {
    await cds.delete(DocumentChunk);
  } catch (err) {
    throw new Error(`Error deleting the embeddings from db: ${err?.message}`, {
      cause: err,
    });
  }
}

/**
 * Convert embeddings to buffer, required to store it in SAP HANA tables
 */
function array2VectorBuffer(data) {
  const sizeFloat = 4;
  const sizeDimensions = 4;
  const bufferSize = data.length * sizeFloat + sizeDimensions;
  const buffer = Buffer.allocUnsafe(bufferSize);
  buffer.writeUInt32LE(data.length, 0);
  data.forEach((value, index) => {
    buffer.writeFloatLE(value, index * sizeFloat + sizeDimensions);
  });
  return buffer;
}

module.exports = class EmbeddingService extends cds.ApplicationService {
  async init() {
    this.on("createEmbeddings", async () => {
      await onCreateEmbeddings();
    });
    this.on("deleteEmbeddings", async () => {
      await onDeleteEmbeddings();
    });
    return super.init();
  }
};
