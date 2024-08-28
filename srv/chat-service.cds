using {capgenairag as db} from '../db/schema';

type RagResponse_AdditionalContents {
    score       : String;
    pageContent : String;
}

type RagResponse {
    role               : String;
    content            : String;
    timestamp          : String;
    additionalContents : array of RagResponse_AdditionalContents;
}

service ChatService {
    entity Conversation as projection on db.Conversation;
    entity Message      as projection on db.Message;
    action getAiResponse(sessionId : String, content : String, timestamp : Timestamp) returns RagResponse;
    action deleteChatSession(sessionId : UUID)                                        returns String;
}

annotate ChatService with @(requires: 'authenticated-user');
