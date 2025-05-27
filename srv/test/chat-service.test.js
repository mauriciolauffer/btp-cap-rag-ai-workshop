import chai from 'chai';
const { expect } = chai;
import cds from '@sap/cds';
import sinon from 'sinon';

describe('ChatService Tests', () => {
    let server;
    let chatService;
    let llmPluginMock;

    before(async () => {
        // Start CDS server in memory using SQLite
        server = cds.test('srv', '--in-memory'); 
        chatService = await cds.connect.to('ChatService');

        // --- Mocking cap-llm-plugin ---
        llmPluginMock = {
            getRagResponseWithConfig: sinon.stub().resolves({
                completion: {
                    choices: [{ message: { role: 'assistant', content: 'Mocked AI Response' } }]
                },
                additionalContents: []
            })
        };

        // Mock cds.connect.to to return our mock for 'cap-llm-plugin'
        const originalConnectTo = cds.connect.to;
        sinon.stub(cds.connect, 'to').callsFake(async (service) => {
            if (service === 'cap-llm-plugin') {
                return llmPluginMock;
            }
            // For other services, call the original cds.connect.to
            // We need to ensure that `this` is correctly bound if originalConnectTo relies on it.
            // However, cds.connect.to is often a static-like method or unbound.
            // If issues arise, might need originalConnectTo.apply(cds.connect, [serviceName, options])
            return originalConnectTo(service); 
        });
    });

    after(async () => {
        // Restore original cds.connect.to
        cds.connect.to.restore();
        // Close the server
        if (server) {
            await server.close();
        }
    });

    afterEach(() => {
        // Reset sinon stubs after each test
        llmPluginMock.getRagResponseWithConfig.resetHistory();
    });

    describe('getAiResponse action', () => {
        it('should return an AI response and initialize history on first call', async () => {
            const sessionId = 'test-session-1';
            const timestamp = new Date().toISOString();
            const userContent = 'Hello AI';

            // Perform the POST request to the action
            // Note: For CAP actions, the client obtained from cds.connect.to usually allows direct method calls
            // If using chai-http for actual HTTP requests:
            // const app = cds.app; // Get the express app from cds
            // const response = await chai.request(app).post('/odata/v4/chat/getAiResponse').send({ ... });
            // For now, trying with chatService.send or .post if available for actions.
            // CAP documentation suggests actions are exposed as methods on the service client.
            
            const response = await chatService.send({
                event: 'getAiResponse', // Action name
                data: {
                    sessionId: sessionId,
                    content: userContent,
                    timestamp: timestamp
                }
            });

            expect(response).to.exist;
            expect(response.role).to.equal('assistant');
            expect(response.content).to.equal('Mocked AI Response');
            expect(response.timestamp).to.be.a('string');
            expect(response.additionalContents).to.be.an('array').that.is.empty;

            // Verify that the mock was called correctly
            expect(llmPluginMock.getRagResponseWithConfig.calledOnce).to.be.true;
            const callArgs = llmPluginMock.getRagResponseWithConfig.getCall(0).args;
            expect(callArgs[0]).to.equal(sessionId); // sessionId
            expect(callArgs[1]).to.equal(userContent); // prompt
            // callArgs[2] is config (apiKey, model, embeddingConfig) - we don't need to assert its exact content for this test
            expect(callArgs[3]).to.be.an('array').that.is.empty; // initial chatHistory
        });

        it('should return an AI response and pass existing history on subsequent calls', async () => {
            const sessionId = 'test-session-hist';
            const timestamp1 = new Date().toISOString();
            const userContent1 = 'My first message';
            const timestamp2 = new Date(new Date().getTime() + 1000).toISOString(); // Ensure different timestamp
            const userContent2 = 'My second message';

            // First call
            await chatService.send({
                event: 'getAiResponse',
                data: { sessionId, content: userContent1, timestamp: timestamp1 }
            });

            llmPluginMock.getRagResponseWithConfig.resetHistory(); // Reset history for the next assertion

            // Second call
            const response2 = await chatService.send({
                event: 'getAiResponse',
                data: { sessionId, content: userContent2, timestamp: timestamp2 }
            });

            expect(response2).to.exist;
            expect(response2.content).to.equal('Mocked AI Response');

            // Verify mock was called with history from the first interaction
            expect(llmPluginMock.getRagResponseWithConfig.calledOnce).to.be.true;
            const callArgs = llmPluginMock.getRagResponseWithConfig.getCall(0).args;
            expect(callArgs[0]).to.equal(sessionId);
            expect(callArgs[1]).to.equal(userContent2);
            const historyPassed = callArgs[3]; // chatHistory
            expect(historyPassed).to.be.an('array').with.lengthOf(2);
            expect(historyPassed[0]).to.deep.include({ role: 'user', content: userContent1 });
            expect(historyPassed[1]).to.deep.include({ role: 'assistant', content: 'Mocked AI Response' });
        });
    });

    describe('deleteChatSession action', () => {
        it('should delete a chat session and clear its history', async () => {
            const sessionId = 'session-to-delete';
            const timestamp = new Date().toISOString();

            // 1. Create a session and populate some history
            await chatService.send({
                event: 'getAiResponse',
                data: { sessionId, content: 'Initial message to create session', timestamp }
            });

            // Reset mock history before delete to ensure we are checking the right calls
            llmPluginMock.getRagResponseWithConfig.resetHistory();

            // 2. Delete the session
            // The action is defined to return a boolean.
            const deleteResult = await chatService.send({
                event: 'deleteChatSession',
                data: { sessionId }
            });
            expect(deleteResult).to.equal(true); // Assuming the action returns true on success

            // 3. Verify session is deleted by calling getAiResponse again
            // The history passed to the mock should now be empty.
            const userContentAfterDelete = "Are you still there?";
            const timestampAfterDelete = new Date(new Date().getTime() + 2000).toISOString();
            await chatService.send({
                event: 'getAiResponse',
                data: { sessionId, content: userContentAfterDelete, timestamp: timestampAfterDelete }
            });

            expect(llmPluginMock.getRagResponseWithConfig.calledOnce).to.be.true;
            const callArgs = llmPluginMock.getRagResponseWithConfig.getCall(0).args;
            expect(callArgs[0]).to.equal(sessionId);
            expect(callArgs[1]).to.equal(userContentAfterDelete);
            expect(callArgs[3]).to.be.an('array').that.is.empty; // History should be empty
        });

        it('should return false when trying to delete a non-existent session', async () => {
            const sessionId = 'non-existent-session';
            const deleteResult = await chatService.send({
                event: 'deleteChatSession',
                data: { sessionId }
            });
            expect(deleteResult).to.equal(false);
        });
    });

    describe('Entity Projections Readability', () => {
        // For these tests, we'll use chai-http style requests as they are simple GETs
        // We need the express app for chai-http
        let app;
        before(() => {
            app = cds.app; // cds.app is the express app when server is run with cds.test()
        });

        it('should allow reading Conversations OData endpoint', async () => {
            const response = await chai.request(app).get('/odata/v4/chat/Conversation');
            expect(response).to.have.status(200);
            expect(response.body.value).to.be.an('array');
        });

        it('should allow reading Messages OData endpoint', async () => {
            const response = await chai.request(app).get('/odata/v4/chat/Message');
            expect(response).to.have.status(200);
            expect(response.body.value).to.be.an('array');
        });
    });
});
