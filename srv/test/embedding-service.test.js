import chai from 'chai';
import chaiHttp from 'chai-http'; // Will be used for OData entity reads
const { expect } = chai;
import cds from '@sap/cds';
import sinon from 'sinon';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

// Use chaiHttp
chai.use(chaiHttp);

describe('EmbeddingService Tests', () => {
    let server;
    let embeddingService; // Connected service client for actions and direct calls
    let llmPluginMock;
    let app; // Express app for chai-http requests

    // Resolve __dirname for ES modules
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    const testPdfPath = path.join(__dirname, 'files', 'dummy.pdf');

    before(async () => {
        // Ensure dummy.pdf exists (it should have been created in a previous step)
        if (!fs.existsSync(testPdfPath)) {
            console.error(`Dummy PDF not found at ${testPdfPath}. Please ensure it's created.`);
            // Fallback to create it, though it's better if it's there from the setup step
            fs.mkdirSync(path.dirname(testPdfPath), { recursive: true });
            fs.writeFileSync(testPdfPath, '%PDF-1.4\n%âãÏÓ\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n5 0 obj<</Length 38>>stream\nBT /F1 12 Tf 100 700 Td (Hello PDF) Tj ET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f\n0000000015 00000 n\n0000000060 00000 n\n0000000111 00000 n\n0000000212 00000 n\n0000000260 00000 n\ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n300\n%%EOF');
            console.log('Fallback: Created dummy.pdf');
        }

        server = cds.test('srv', '--in-memory');
        app = server.app; // Get the express app
        embeddingService = await cds.connect.to('EmbeddingService');

        // Mock cap-llm-plugin
        llmPluginMock = {
            getEmbeddingWithConfig: sinon.stub().resolves({ data: [{ embedding: Array(1536).fill(0.1) }] }) // Ensure this matches what the service expects
        };
        
        // Mock cds.connect.to to return our mock for 'cap-llm-plugin'
        // Capture the original function before stubbing if it's not already a sinon proxy
        if (!cds.connect.to.isSinonProxy) {
            const originalConnectTo = cds.connect.to;
            sinon.stub(cds.connect, 'to').callsFake(async (serviceName, options) => {
                if (serviceName === 'cap-llm-plugin') {
                    return llmPluginMock;
                }
                return originalConnectTo.call(cds.connect, serviceName, options);
            });
        } else {
            // If already stubbed (e.g., by ChatService tests), just add specific behavior
            cds.connect.to.withArgs('cap-llm-plugin').resolves(llmPluginMock);
        }
    });

    after(async () => {
        if (server) {
            await server.close();
        }
        // Restore sinon stub only if it was created by this test suite
        // Check specifically for the stub on `cds.connect.to`
        if (cds.connect.to.isSinonProxy && cds.connect.to.restore) {
             // Check if the stub is still for 'cap-llm-plugin' before restoring,
             // to avoid issues if other tests modified it.
             // This can get complex; a simpler approach is to ensure stubs are restored by their owners.
             // For now, if it's a proxy, we assume it might be ours or shared.
            cds.connect.to.restore();
        }
    });

    beforeEach(async () => {
        // Clean database before each test using direct CDS QL for simplicity
        await cds.delete('btpcapragai.Files');
        await cds.delete('btpcapragai.DocumentChunk');
        llmPluginMock.getEmbeddingWithConfig.resetHistory();
    });

    describe('UPDATE Files (Embedding Generation)', () => {
        it('should create DocumentChunk entries when a PDF file content is updated', async () => {
            const fileName = 'test-dummy.pdf';
            const mediaType = 'application/pdf';
            let fileId;

            // 1. Create initial File entry (using AdminService as it's a general entity)
            // We need to use a service that has direct access to btpcapragai.Files for creation
            // Assuming an 'AdminService' or similar might be defined for such tasks,
            // or we can use a generic cds.ql.INSERT if no such service is exposed for direct Files creation.
            // For testing, it's often fine to directly insert if the service itself doesn't expose POST on /Files.
            const createdFile = await cds.insert({ fileName, mediaType }).into('btpcapragai.Files');
            fileId = createdFile.results[0].values[0]; // Extract ID from insert result, depends on DB

            expect(fileId).to.exist;

            // 2. Prepare file stream for update
            const pdfBuffer = fs.readFileSync(testPdfPath);
            const pdfStream = Readable.from(pdfBuffer);
            
            // 3. Perform the UPDATE operation.
            // The service handler is on `UPDATE Files`.
            // We simulate this by calling `embeddingService.put` or `cds.update`
            // The key is that `req.data.content` in the handler becomes this stream.
            // The standard OData way to update a stream is PUT to `/Files(ID)/content`
            // CAP translates this into an UPDATE on the Files entity with `req.data.content` being the stream.
            
            // Using chai-http to simulate the PUT request to the content endpoint
            // This is closer to how a client would interact with the @Core.MediaType field.
            const response = await chai.request(app)
                .put(`/odata/v4/embedding/Files(ID=${fileId})/content`)
                .set('Content-Type', mediaType)
                .send(pdfBuffer); // Send buffer, chai-http handles streaming

            expect(response).to.have.status(204); // Successful update of content usually is 204

            // 4. Assertions
            const chunks = await cds.select('text_chunk').from('btpcapragai.DocumentChunk').where({ metadata_column: fileName });
            expect(chunks).to.be.an('array').with.lengthOf.at.least(1);
            // The dummy PDF contains "Hello PDF". pdf-parse might extract it with extra spaces/newlines.
            expect(chunks[0].text_chunk).to.include('Hello PDF'); 
            
            expect(llmPluginMock.getEmbeddingWithConfig.called).to.be.true;
            expect(llmPluginMock.getEmbeddingWithConfig.callCount).to.equal(chunks.length);
            // Verify arguments passed to the mock
            const callArgs = llmPluginMock.getEmbeddingWithConfig.getCall(0).args;
            expect(callArgs[0]).to.include('Hello PDF'); // text content
            // callArgs[1] is the config object, we don't need to assert its exact content for this test
        });
    });

    describe('deleteEmbeddings action', () => {
        it('should delete all Files and DocumentChunk entries', async () => {
            // Setup: Create a file and some chunks
            const createdFile = await cds.insert({ fileName: 'to-delete.pdf', mediaType: 'application/pdf' }).into('btpcapragai.Files');
            const fileId = createdFile.results[0].values[0];
            await cds.insert({ ID: cds.utils.uuid(), text_chunk: 'abc', metadata_column: 'to-delete.pdf', document_ID: fileId }).into('btpcapragai.DocumentChunk');

            const actionResponse = await embeddingService.send('deleteEmbeddings');
            // The action in embedding-service.js returns a string message
            expect(actionResponse).to.equal('Embeddings deleted successfully.');

            const filesCount = await cds.ql.SELECT.count.from('btpcapragai.Files');
            const chunksCount = await cds.ql.SELECT.count.from('btpcapragai.DocumentChunk');

            expect(filesCount).to.equal(0);
            expect(chunksCount).to.equal(0);
        });
    });

    describe('Entity Projections Reading (OData)', () => {
        it('should allow reading Files via OData', async () => {
            await cds.insert({ fileName: 'readable.pdf', mediaType: 'application/pdf' }).into('btpcapragai.Files');
            
            const response = await chai.request(app).get('/odata/v4/embedding/Files');
            expect(response).to.have.status(200);
            expect(response.body.value).to.be.an('array').with.lengthOf(1);
            expect(response.body.value[0].fileName).to.equal('readable.pdf');
        });

        it('should allow reading DocumentChunk (excluding embedding) via OData', async () => {
            const file = await cds.insert({ fileName: 'doc-for-chunk.pdf', mediaType: 'application/pdf' }).into('btpcapragai.Files');
            const fileId = file.results[0].values[0];
            await cds.insert({ 
                ID: cds.utils.uuid(), 
                text_chunk: 'test chunk content', 
                metadata_column: 'doc-for-chunk.pdf',
                document_ID: fileId 
            }).into('btpcapragai.DocumentChunk');

            const response = await chai.request(app).get('/odata/v4/embedding/DocumentChunk');
            expect(response).to.have.status(200);
            expect(response.body.value).to.be.an('array').with.lengthOf(1);
            expect(response.body.value[0]).to.not.have.property('embedding'); // As per service projection
            expect(response.body.value[0]).to.have.property('text_chunk', 'test chunk content');
            expect(response.body.value[0]).to.have.property('document_ID', fileId);
        });
    });
});
