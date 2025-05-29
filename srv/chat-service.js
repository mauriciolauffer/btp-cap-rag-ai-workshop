import cds from "@sap/cds";

const chatHistoryInMemory = [];

/**
 * Get chat history session
 */
function getChatHistorySession(sessionId) {
  throw new Error("getChatHistorySession");
}

/**
 * Get RAG response
 */
async function getRagResponse(userQuery, chatHistory) {
  throw new Error("getRagResponse");
}

/**
 * Get the configuration to the embedding model
 */
function getAiEmbeddingConfig() {
  throw new Error("getaiEmbeddingConfig");
}

/**
 * Get the configuration to the chat model
 */
function getAiChatConfig() {
  throw new Error("getaiChatConfig");
}

/**
 * Prepare response from the AI
 */
function prepareResponse(ragResponse) {
  throw new Error("prepareResponse");
}

/**
 * Add messages to the chat history session
 */
function addMessagesToChatHistory(sessionId, userContent, assistantContent) {
  throw new Error("addMessagesToChatHistory");
}

export default class ChatService extends cds.ApplicationService {
  init() {
    throw new Error("Chat service not implemented yet");
  }
}
