"use strict";

const cds = require("@sap/cds");
const chatHistoryInMemory = [];

/**
 * Handle getAiResponse action, it communicates to the chatbot
 */
async function onGetAiResponse(data) {
  try {
    const userQuery = data?.content;
    const chatHistory = getChatHistorySession(data.sessionId);
    const ragResponse = await getRagResponse(userQuery, chatHistory);
    const response = prepareResponse(ragResponse);
    addMessagesToChatHistory(data.sessionId, userQuery, response.content);
    return response;
  } catch (err) {
    throw new Error(
      `Error generating response for user query: ${err?.message}`,
      {
        cause: err,
      },
    );
  }
}

/**
 * Handle deleteChatSession action, it deletes the chat session
 */
async function onDeleteChatSession(params) {
  const index = chatHistoryInMemory.indexOf(params.sessionId);
  if (index !== -1) {
    delete chatHistoryInMemory[index];
    chatHistoryInMemory.splice(index, 1);
  }
}

/**
 * Get chat history session
 */
function getChatHistorySession(sessionId) {
  if (!chatHistoryInMemory[sessionId]) {
    chatHistoryInMemory[sessionId] = [];
  }
  return chatHistoryInMemory[sessionId];
}

/**
 * Get RAG response
 */
async function getRagResponse(userQuery, chatHistory) {
  const chatInstuctionPrompt = `You are a chatbot.
  Answer the user question based only on the context, delimited by triple backticks.
  If you don't know the answer, just say that you don't know.`;
  const tableName = "btpcapragai_s4hana_DOCUMENTCHUNK";
  const embeddingColumnName = "EMBEDDING";
  const contentColumn = "TEXTCHUNK";
  const aiEmbeddingConfig = getAiEmbeddingConfig();
  const aiChatConfig = getAiChatConfig();
  const vectorplugin = await cds.connect.to("cap-llm-plugin");
  return vectorplugin.getRagResponse(
    userQuery,
    tableName,
    embeddingColumnName,
    contentColumn,
    chatInstuctionPrompt,
    aiEmbeddingConfig,
    aiChatConfig,
    chatHistory,
    10,
  );
}

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
 * Get the configuration to the chat model
 */
function getAiChatConfig() {
  const genAiHub = cds.env.requires["GENERATIVE_AI_HUB"];
  return {
    destinationName: genAiHub["CHAT_MODEL_DESTINATION_NAME"],
    resourceGroup: genAiHub["CHAT_MODEL_RESOURCE_GROUP"],
    deploymentUrl: genAiHub["CHAT_MODEL_DEPLOYMENT_URL"],
    modelName: genAiHub["CHAT_MODEL_NAME"],
    apiVersion: genAiHub["CHAT_MODEL_API_VERSION"],
  };
}

/**
 * Prepare response from the AI
 */
function prepareResponse(ragResponse) {
  return {
    role: ragResponse.completion.choices[0].message.role,
    content: ragResponse.completion.choices[0].message.content,
    timestamp: new Date().toJSON(),
    additionalContents: ragResponse.additionalContents,
  };
}

/**
 * Add messages to the chat history session
 */
function addMessagesToChatHistory(sessionId, userContent, assistantContent) {
  chatHistoryInMemory[sessionId].push({
    role: "user",
    content: userContent,
  });
  chatHistoryInMemory[sessionId].push({
    role: "assistant",
    content: assistantContent,
  });
}

module.exports = class ChatService extends cds.ApplicationService {
  init() {
    this.on("getAiResponse", async (req) => {
      return onGetAiResponse(req.data);
    });
    this.on("deleteChatSession", async (req) => {
      await onDeleteChatSession(req.params);
    });
    return super.init();
  }
};
