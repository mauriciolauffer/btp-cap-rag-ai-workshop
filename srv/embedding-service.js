import cds from "@sap/cds";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";

/**
 * Get the configuration to the embedding model
 */
function getAiEmbeddingConfig() {
  throw new Error("getAiEmbeddingConfig");
}

/**
 * Create PDF blob with content from the table
 */
async function getPdfBlob(stream) {
  throw new Error("getPdfBlob");
}

/**
 * Split the document in multiple text chunks to be used in the embedding
 */
async function splitDocumentInTextChunks(pdfBlob) {
  throw new Error("splitDocumentInTextChunks");
}

/**
 * Convert text chunks to vector (embedding)
 */
async function getEmbeddingPayload(textChunks, filename) {
  throw new Error("getembeddingPayload");
}

/**
 * Embedding document process
 */
async function embeddingDocument(data, entities) {
  throw new Error("embeddingDocument");
}

/**
 * Convert embeddings to buffer, required to store it in SAP HANA tables
 */
function array2VectorBuffer(data) {
  throw new Error("array2VectorBuffer");
}

export default class EmbeddingService extends cds.ApplicationService {
  init() {
    throw new Error("Embedding service not implemented yet");
  }
}
