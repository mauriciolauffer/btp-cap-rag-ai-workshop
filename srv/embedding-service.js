const { writeFile, unlink } = require("node:fs/promises");
const path = require('node:path');
const cds = require("@sap/cds");
const { PDFDocument } = require("pdf-lib");
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { PDFLoader } = require("@langchain/community/document_loaders/fs/pdf");

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

async function preparePdf(tempDocLocation, stream) {
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
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

  // Convert to Buffer
  const pdfBuffer = Buffer.concat(pdfBytes);

  // Load PDF buffer into a document
  const externalPdfDoc = await PDFDocument.load(pdfBuffer);

  // Copy pages from external PDF document to the new document
  const pages = await pdfDoc.copyPages(
    externalPdfDoc,
    externalPdfDoc.getPageIndices()
  );
  pages.forEach((page) => {
    pdfDoc.addPage(page);
  });

  // Save the PDF document to a new file
  const pdfData = await pdfDoc.save();
  await writeFile(tempDocLocation, pdfData);
}

async function embeddingDocument(data, entities) {
  const { Files, DocumentChunk } = entities;
  const result = await cds
    .read(Files)
    .columns(["fileName"])
    .where({ ID: data.ID });
  if (result.length === 0) {
    throw new Error(`Document ${data.ID} not found!`);
  }
  const localFileNameNoGaps = result[0].fileName.replace(/[^a-zA-Z0-9.]/g, '');
  const tempDocLocation = path.join(__dirname, localFileNameNoGaps);
  try {
    await preparePdf(tempDocLocation, data.content);

    // Delete existing embeddings - This is just 
    await cds.delete(DocumentChunk);

    // Load the document to langchain text loader
    const loader = new PDFLoader(tempDocLocation);
    const document = await loader.load();

    // Split the document into chunks
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 100,
      addStartIndex: true,
    });

    const textChunks = await splitter.splitDocuments(document);
    const aiEmbeddingConfig = getAiEmbeddingConfig();
    const textChunkEntries = [];
    const vectorplugin = await cds.connect.to("cap-llm-plugin");

    // For each text chunk generate the embeddings
    for (const chunk of textChunks) {
      const embedding = await vectorplugin.getEmbedding(
        aiEmbeddingConfig,
        chunk.pageContent
      );
      const entry = {
        text_chunk: chunk.pageContent,
        metadata_column: result[0].fileName,
        embedding: array2VectorBuffer(embedding?.data[0]?.embedding),
      };
      textChunkEntries.push(entry);
    }

    // Insert the text chunk with embeddings into db
    const status = await INSERT.into(DocumentChunk).entries(textChunkEntries);
    if (!status) {
      throw new Error("Insertion of text chunks into db failed!");
    }
  } catch (err) {
    throw new Error(
      `Error while generating and storing vector embeddings: ${err?.message}`,
      {
        reason: err,
      }
    );
  } finally {
    // Delete temp document
    deleteTempFile(tempDocLocation);
  }
}

// Helper method to convert embeddings to buffer for insertion
function array2VectorBuffer(data) {
  const sizeFloat = 4;
  const sizeDimensions = 4;
  const bufferSize = data.length * sizeFloat + sizeDimensions;
  const buffer = Buffer.allocUnsafe(bufferSize);
  // write size into buffer
  buffer.writeUInt32LE(data.length, 0);
  data.forEach((value, index) => {
    buffer.writeFloatLE(value, index * sizeFloat + sizeDimensions);
  });
  return buffer;
}

// Helper method to delete file if it already exists
function deleteTempFile(filePath) {
  return unlink(filePath);
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
        throw new Error(`Error deleting the embeddings from db: ${err?.message}`, {
          reason: err,
        });
      }
    });

    return super.init();
  }
};
