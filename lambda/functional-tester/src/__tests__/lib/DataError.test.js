// Data
const events = require('../events.json');
const responses = require('../responses');

const DataError = require('../../lib/DataError');
describe('DataError', () => {
    
    beforeEach(() => {
        jest.resetModules();
    });

    afterEach(() => {
    });

    test('should instantiate', async () => {
        const err = new DataError('Test message', [1, 2]);
        expect(err.name).toEqual('DataError');
        expect(err.message).toEqual('Test message');
        expect(err.data).toBeDefined();
        expect(err.data.length).toEqual(2);
    });
});
