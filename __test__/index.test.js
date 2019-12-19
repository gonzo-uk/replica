'use strict';
const mockSubscribe = {
    subscribe: jest.fn().mockImplementation(() => {
        console.log('running subscribe');
    })
}
const mockReplica = jest.fn().mockImplementation(() => {
    return mockSubscribe
});
jest.mock('../src/replica/haReplicaMain', () => {
    return mockReplica;
});
const logger = {
    type: 'logger',
    info: jest.fn(),
    error: jest.fn()
}

const mockDepInjection = {
    getDependency: jest.fn().mockImplementation(service => {
        console.log(service);
        switch(service) {
            case 'logger':
                return logger;
            default:
                return {type: service};
        }
    })
}
jest.mock('../src/lib/haDepInjection', () => {
    return mockDepInjection;
});

beforeEach(() => {
    mockReplica.mockClear();
    logger.info.mockClear();
    logger.error.mockClear();
});

describe('Suit to test index.js for Replica into ElastiSearch Module', () => {
    it('Load up Index and initialise haReplicaMain', () => {
        const haReplicaMain = require('../src/index');
        expect(mockReplica).toHaveBeenCalledTimes(1);
        expect(typeof mockReplica.mock.calls[0][0]).toBe('object');
        expect(typeof mockReplica.mock.calls[0][1]).toBe('object');
        expect(typeof mockReplica.mock.calls[0][2]).toBe('object');
    });
    it('Initialise subscription', () => {
        const haReplicaMain = require('../src/index');
        expect(mockSubscribe.subscribe).toHaveBeenCalled();
    });

});