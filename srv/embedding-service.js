"use strict";

const cds = require("@sap/cds");
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const {
  WebPDFLoader,
} = require("@langchain/community/document_loaders/web/pdf");

/**
 * Get the configuration to the embedding model
 */
function getAiEmbeddingConfig() {
  throw new Error("EmbeddingService getAiEmbeddingConfig has to be implemented!");
}

/**
 * Create PDF blob with content from the table
 */
async function getPdfBlob(stream) {
  throw new Error("EmbeddingService getPdfBlob has to be implemented!");
}

/**
 * Split the document in multiple text chunks to be used in the embedding
 */
async function splitDocumentInTextChunks(pdfBlob) {
  throw new Error("EmbeddingService splitDocumentInTextChunks has to be implemented!");
}

/**
 * Convert text chunks to vector (embedding)
 */
async function getEmbeddingPayload(textChunks, filename) {
  throw new Error("EmbeddingService getEmbeddingPayload has to be implemented!");
}

/**
 * Embedding document process
 */
async function embeddingDocument(data, entities) {
  throw new Error("EmbeddingService embeddingDocument has to be implemented!");
}

/**
 * Convert embeddings to buffer, required to store it in SAP HANA tables
 */
function array2VectorBuffer(data) {
  throw new Error("EmbeddingService array2VectorBuffer has to be implemented!");
}

module.exports = class EmbeddingService extends cds.ApplicationService {
  init() {
    const { Files, DocumentChunk } = this.entities;

    this.on("UPDATE", Files, async (req) => {
      await embeddingDocument(req.data, this.entities);
    });

    this.on("deleteEmbeddings", async () => {
      throw new Error("EmbeddingService deleteEmbeddings has to be implemented!");
    });

    return super.init();
  }
};