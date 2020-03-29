// Data
const events = require('../events.json');
const responses = require('../responses');

const utilities = require('../../lib/utilities');
describe('utilities', () => {
    
    beforeEach(() => {
        jest.resetModules();
    });

    afterEach(() => {
    });

    describe('buildScopedMessage()', () => {
        test('should return a message with a scope, given both a message and a scope', async () => {
            expect(utilities.buildScopedMessage('Test', 'Scope')).toEqual('Scope|Test');
        });

        test('should return a message without a scope, given a message', async () => {
            expect(utilities.buildScopedMessage('Test')).toEqual('Test');
        });
    });

    describe('isPrimitive()', () => {
        test('should return true given any primitive', () => {
            expect(utilities.isPrimitive(1)).toEqual(true);
            expect(utilities.isPrimitive('test')).toEqual(true);
            expect(utilities.isPrimitive(true)).toEqual(true);
            expect(utilities.isPrimitive(false)).toEqual(true);
            expect(utilities.isPrimitive(null)).toEqual(true);
            expect(utilities.isPrimitive(undefined)).toEqual(true);
        });

        test('should return false given any object', () => {
            expect(utilities.isPrimitive({})).toEqual(false);
            expect(utilities.isPrimitive([])).toEqual(false);
        });
    });

    describe('sleep()', () => {
        test('should not complete until waiting for the specified period', async () => {
            const start = new Date();
            await utilities.sleep(1000);
            const end = new Date();

            // Seems like setTimeout can go a bit short. Or date subtraction is minorly off.
            // Not a big deal for this test, but to avoid intermittent issues, lower the expect.
            expect(end - start).toBeGreaterThanOrEqual(950);
        })
    });
});
