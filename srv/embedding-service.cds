using {btpcapragai as db} from '../db/schema';

service EmbeddingService {
}

annotate EmbeddingService with @(requires: 'authenticated-user');
