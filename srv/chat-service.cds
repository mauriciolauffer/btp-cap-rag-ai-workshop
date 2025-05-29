using {btpcapragai as db} from '../db/schema';

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
}

annotate ChatService with @(requires: 'authenticated-user');
