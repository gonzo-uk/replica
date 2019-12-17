let index;
beforeEach(() => {
    // index = require('../src/index');
    // config = jest.fn();
});

describe.skip('Suit to test index.js for Replica into ElastiSearch Module', () => {
    it('ha-replica-config.json cannot be found', () => {
        const index = require('../src/index');
        // jest.mock('../src/lib/haServiceLocator');
        // const haDepInjection = require('../src/lib/haServiceLocator');
        // expect(haDepInjection).toThrowError();
    })
    
});