"use strict";

const cds = require("@sap/cds");
const chatHistoryInMemory = [];

function getChatHistorySession(sessionId) {
  if (!chatHistoryInMemory[sessionId]) {
    chatHistoryInMemory[sessionId] = [];
  }
  return chatHistoryInMemory[sessionId];
}

async function getRagResponse(userQuery, chatHistory) {
  const chatInstuctionPrompt = `You are a chatbot.
  Answer the user question based only on the context, delimited by triple backticks.
  If you don't know the answer, just say that you don't know.`;
  const tableName = "btpcapragai_DOCUMENTCHUNK";
  const embeddingColumnName = "EMBEDDING";
  const contentColumn = "TEXT_CHUNK";
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
    10
  );
}

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

function prepareResponse(ragResponse) {
  return {
    role: ragResponse.completion.choices[0].message.role,
    content: ragResponse.completion.choices[0].message.content,
    timestamp: new Date().toJSON(),
    additionalContents: ragResponse.additionalContents,
  };
}

function addMessagesToChatHistory(sessionId, userContent, assistantContent) {
  // const chatHistory = getChatHistorySession(sessionId);
  chatHistoryInMemory[sessionId].push({
    role: "user",
    content: userContent,
  });
  chatHistoryInMemory[sessionId].push({
    role: "assistant",
    content: assistantContent,
  });
}

module.exports = class Chat extends cds.ApplicationService {
  init() {
    this.on("getAiResponse", async (req) => {
      try {
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
      } catch (err) {
        throw new Error(
          `Error generating response for user query: ${err?.message}`,
          {
            cause: err,
          }
        );
      }
    });

    this.on("deleteChatSession", async (req) => {
      const index = chatHistoryInMemory.indexOf(req.params.sessionId);
      if (index !== -1) {
        delete chatHistoryInMemory[index];
        chatHistoryInMemory.splice(index, 1);
      }
    });

    return super.init();
  }
};
