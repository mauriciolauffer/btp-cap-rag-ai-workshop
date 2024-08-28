const cds = require("@sap/cds");

const tableName = "CAPGENAIRAG_DOCUMENTCHUNK";
const embeddingColumnName = "EMBEDDING";
const contentColumn = "TEXT_CHUNK";
const chatHistoryInMemory = [];
const genericRequestPrompt = `You are a chatbot.
  Answer the user question based only on the context, delimited by triple backticks.
  If you don't know the answer, just say that you don't know.`;

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

function addMessagesToChatHistory(sessionId, userContent, assistantContent) {
  const chatHistory = chatHistoryInMemory[sessionId];
  chatHistory.push({
    role: "user",
    content: userContent,
  });
  chatHistory.push({
    role: "assistant",
    content: assistantContent,
  });
}

module.exports = class Chat extends cds.ApplicationService {
  init() {
    this.on("getAiResponse", async (req) => {
      if (!chatHistoryInMemory[req.data.sessionId]) {
        chatHistoryInMemory[req.data.sessionId] = [];
      }
      try {
        const userQuery = req.data?.content;
        const vectorplugin = await cds.connect.to("cap-llm-plugin");
        const chatHistory = chatHistoryInMemory[req.data.sessionId];
        const chatInstruction = genericRequestPrompt;
        const aiEmbeddingConfig = getAiEmbeddingConfig();
        const aiChatConfig = getAiChatConfig();
        const ragResponse = await vectorplugin.getRagResponse(
          userQuery,
          tableName,
          embeddingColumnName,
          contentColumn,
          chatInstruction,
          aiEmbeddingConfig,
          aiChatConfig,
          chatHistory,
          10
        );

        const response = {
          role: ragResponse.completion.choices[0].message.role,
          content: ragResponse.completion.choices[0].message.content,
          timestamp: new Date().toJSON(),
          additionalContents: ragResponse.additionalContents,
        };

        addMessagesToChatHistory(
          req.data.sessionId,
          userQuery,
          response.content
        );
        return response;
      } catch (err) {
        throw new Error("Error generating response for user query.", {
          reason: err,
        });
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
