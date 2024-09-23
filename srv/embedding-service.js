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
 * Create PDF blob with content from the table
 */
async function getPdfBlob(stream) {
  const pdfBytes = [];
  // Collect streaming PDF content
  stream.on("data", (chunk) => {
    pdfBytes.push(chunk);
  });
  // Wait for the file content stream to finish
  await new Promise((resolve, reject) => {
    stream.on("end", resolve);
    stream.on("error", reject);
  });
  const pdfBuffer = Buffer.concat(pdfBytes);
  return new Blob([pdfBuffer], { type: "application/pdf" });
}

/**
 * Split the document in multiple text chunks to be used in the embedding
 */
async function splitDocumentInTextChunks(pdfBlob) {
  const loader = new WebPDFLoader(pdfBlob, {});
  const document = await loader.load();
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 100,
    addStartIndex: true,
  });
  return splitter.splitDocuments(document);
}

/**
 * Convert text chunks to vector (embedding)
 */
async function getEmbeddingPayload(textChunks, filename) {
  const aiEmbeddingConfig = getAiEmbeddingConfig();
  const textChunkEntries = [];
  const vectorplugin = await cds.connect.to("cap-llm-plugin");

  // Generate embeddings for each text chunk
  for (const chunk of textChunks) {
    const embedding = await vectorplugin.getEmbedding(
      aiEmbeddingConfig,
      chunk.pageContent
    );
    const entry = {
      text_chunk: chunk.pageContent,
      metadata_column: filename,
      embedding: array2VectorBuffer(embedding?.data[0]?.embedding),
    };
    textChunkEntries.push(entry);
  }
  return textChunkEntries;
}

/**
 * Embedding document process
 */
async function embeddingDocument(data, entities) {
  const { Files, DocumentChunk } = entities;
  const result = await cds
    .read(Files)
    .columns(["fileName"])
    .where({ ID: data.ID });
  if (result.length === 0) {
    throw new Error(`Document ${data.ID} not found!`);
  }
  try {
    const pdfBlob = await getPdfBlob(data.content);
    const textChunks = await splitDocumentInTextChunks(pdfBlob);
    const textChunkEntries = await getEmbeddingPayload(
      textChunks,
      result[0].fileName
    );

    // Insert the text chunk with embeddings into db
    const status = await INSERT.into(DocumentChunk).entries(textChunkEntries);
    if (!status) {
      throw new Error("Insertion of text chunks into db failed!");
    }
  } catch (err) {
    throw new Error(
      `Error while generating and storing vector embeddings: ${err?.message}`,
      {
        cause: err,
      }
    );
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
  init() {
    const { Files, DocumentChunk } = this.entities;

    this.on("UPDATE", Files, async (req) => {
      await embeddingDocument(req.data, this.entities);
    });

    this.on("deleteEmbeddings", async () => {
      try {
        await Promise.all([cds.delete(Files), cds.delete(DocumentChunk)]);
      } catch (err) {
        throw new Error(
          `Error deleting the embeddings from db: ${err?.message}`,
          {
            cause: err,
          }
        );
      }
    });

    return super.init();
  }
};
