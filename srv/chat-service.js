"use strict";

const cds = require("@sap/cds");
const chatHistoryInMemory = [];

/**
 * Get chat history session
 */
function getChatHistorySession(sessionId) {
  throw new Error("ChatService getChatHistorySession has to be implemented!");
}

/**
 * Get RAG response
 */
async function getRagResponse(userQuery, chatHistory) {
  throw new Error("ChatService getRagResponse has to be implemented!");
}

/**
 * Get the configuration to the embedding model
 */
function getAiEmbeddingConfig() {
  throw new Error("ChatService getAiEmbeddingConfig has to be implemented!");
}

/**
 * Get the configuration to the chat model
 */
function getAiChatConfig() {
  throw new Error("ChatService getAiChatConfig has to be implemented!");
}

/**
 * Prepare response from the AI
 */
function prepareResponse(ragResponse) {
  throw new Error("ChatService prepareResponse has to be implemented!");
}

/**
 * Add messages to the chat history session
 */
function addMessagesToChatHistory(sessionId, userContent, assistantContent) {
  throw new Error("ChatService addMessagesToChatHistory has to be implemented!");
}

module.exports = class ChatService extends cds.ApplicationService {
  init() {
    this.on("getAiResponse", async (req) => {
      const userQuery = req.data?.content;
      const chatHistory = getChatHistorySession(req.data.sessionId);
      const ragResponse = await getRagResponse(userQuery, chatHistory);
      const response = prepareResponse(ragResponse);
      addMessagesToChatHistory(
        req.data.sessionId,
        userQuery,
        response.content
      );
      return response;
    });

    this.on("deleteChatSession", async (req) => {
      throw new Error("ChatService deleteChatSession has to be implemented!");
    });

    return super.init();
  }
};
