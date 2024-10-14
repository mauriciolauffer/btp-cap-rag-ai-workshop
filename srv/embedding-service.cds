using {btpcapragai.s4hana as db} from '../db/schema';

service EmbeddingService {
  entity DocumentChunk as
    projection on db.DocumentChunk
    excluding {
      embedding
    };

  action createEmbeddings();
  action deleteEmbeddings();
}

annotate EmbeddingService with @(requires: 'authenticated-user');
