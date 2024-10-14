namespace btpcapragai.s4hana;

using {
    cuid,
    managed
} from '@sap/cds/common';

entity Conversation : cuid, managed {
    userId   : String;
    title    : String;
    messages : Composition of many Message
                   on messages.conversation = $self;
}

entity Message : cuid, managed {
    conversation : Association to Conversation;
    role         : String;
    content      : LargeString;
}

entity DocumentChunk : cuid {
    productId     : String;
    productType   : String;
    textChunk     : LargeString;
    metadataExtra : LargeString;
    embedding     : Vector(1536);
}
