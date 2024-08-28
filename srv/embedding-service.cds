using {capgenairag as db} from '../db/schema';

service EmbeddingService {
  entity DocumentChunk as
    projection on db.DocumentChunk
    excluding {
      embedding
    };

  entity Files         as projection on db.Files;
  action deleteEmbeddings() returns String;
}

annotate EmbeddingService with @(requires: 'authenticated-user');
