const replication = require('../src/replica/haReplicaMain');
const logger = {
    info: jest.fn().mockImplementation(infoMsg => infoMsg),
    error: jest.fn().mockImplementation(errorMsg => errorMsg)
}
let mockElasticClient = {
    bulk: jest.fn().mockImplementation((documentsBulk, bulkCb) => {
        //console.log(documentsBulk);
    })
};
jest.mock('elasticsearch', () => {
    return {
        Client: jest.fn().mockImplementation((options) => {
            return mockElasticClient;
        })
    }
});
const elasticSearch = require('elasticsearch');
const config = {
    replica: {
        elasticQueue: '/queue/esQueue'
    },
    elasticSearch: {
        url: 'server:0000',
        user: 'esUser',
        password: 'esPwd',
        apiVersion: 7
    }
};

beforeEach(() => {
    logger.error.mockClear();
    logger.info.mockClear();
    mockElasticClient.bulk.mockClear();
    elasticSearch.Client.mockClear();
    jest.useFakeTimers();
    jest.clearAllTimers();
});

describe('Suit to test haReplicaMain.js for Replica into ElastiSearch Module', () => {
    it('Initiliase the module: No config or logger have been passed in', () => {
        // const replication = require('../src/replica/haReplicaMain');
        expect(() => replication()).toThrowError();
    });
    it('Initiliase the module: config.replica.elasticQueue is not set up', () => {
        const config = {
            replica: {},
            elasticSearch: {}
        };
        const jms = jest.fn();
        // const replication = require('../src/replica/haReplicaMain');
        expect(() => replication(jms, config, logger)).toThrowError();
    });
    it('Initiliase the module: jms, config and logger have been passed in', () => {
        const jms = jest.fn();
        expect(() => replication(jms, config, logger)).not.toThrowError();
        expect(logger.info).toHaveBeenCalled();
        expect(typeof replication(jms, config, logger)).toEqual("object");
    });
    it('Subscribing to queue: Error during subscription ', () => {
        const config = {
            replica: {
                elasticQueue: '/queue/esQueue'
            },
            elasticSearch: {
                url: 'uxdaprhbilling04:9200',
                user: 'elasticsearch',
                password: 'elasticsearch',
                apiVersion: 7
            }
        };
        const subscribeParams = {
            destination: config.replica.elasticQueue,
            ack: 'client-individual'
        };
        let localQueueDetails;
        const jms = {
            subscribe: jest.fn().mockImplementation((queueDetails, callback) => {
                localQueueDetails = queueDetails;
                callback('JMS Subscription Error');
            })
        };
        const { subscribe } = replication(jms, config, logger);
        subscribe();
        expect(localQueueDetails).toEqual(subscribeParams);
        expect(logger.error).toHaveBeenCalled();
        expect(logger.error.mock.results[0].value).toMatch(/Subscribe error due to/i);
    });
    it('Subscribing to queue: Error when receiving a message ', () => {
        const jms = {
            subscribe: jest.fn().mockImplementation((queueDetails, subscribeCb) => {
                const message = {
                    readString: jest.fn().mockImplementation((encoding, readStringCb) => {
                        readStringCb('JMS Message Error');
                    }),
                    ack: jest.fn()
                }
                subscribeCb('', message);
            })
        }
        const { subscribe } = replication(jms, config, logger);
        subscribe();
        expect(logger.error).toHaveBeenCalled();
        expect(logger.error.mock.results[0].value).toMatch(/Message cannot be parsed due to/i);
    });
    it('Subscribing to queue: one message arrived OK', () => {
        const jms = {
            subscribe: jest.fn().mockImplementation((queueDetails, subscribeCb) => {
                const message = {
                    readString: jest.fn().mockImplementation((encoding, readStringCb) => {
                        const messageBody = { action: 'index', body: { customerRef: '' } }
                        readStringCb('', messageBody);
                    }),
                    ack: jest.fn()
                }
                subscribeCb('', message);
            })
        }
        const { subscribe } = replication(jms, config, logger);
        expect(elasticSearch.Client).toHaveBeenCalled();
        subscribe();
        expect(logger.error).not.toHaveBeenCalled();
        //expect(logger.error.mock.results[0].value).toMatch(/Message cannot be parsed due to/i);
    });
    it('bulk=1, 2 index messages are sent to ES, Expected: 2 batches with 1 message in each', () => {
        config.replica.bulk = 1;
        const jms = {
            subscribe: jest.fn().mockImplementation((queueDetails, subscribeCb) => {
                const message = {
                    readString: jest.fn().mockImplementation((encoding, readStringCb) => {
                        readStringCb('', { action: 'index', index: 'dummyIndex', type: 'dummyType', id: 'dummyId_1', body: { message: 1 } });
                        readStringCb('', { action: 'index', index: 'dummyIndex', type: 'dummyType', id: 'dummyId_2', body: { message: 2 } });
                    }),
                    ack: jest.fn()
                }
                subscribeCb('', message);
            })
        }
        const { subscribe } = replication(jms, config, logger);
        expect(elasticSearch.Client).toHaveBeenCalled();
        subscribe();
        expect(logger.error).not.toHaveBeenCalled();
        expect(mockElasticClient.bulk).toHaveBeenCalled();
        // Property calls: Each call is represented by an array of arguments that were passed during the call
        // There are 2 entries in the array body for bulk
        // expected: { body: [ { index: [Object] }, { message: 1 } ] }
        expect(mockElasticClient.bulk.mock.calls[0][0].body.length).toBe(2);
        expect(mockElasticClient.bulk.mock.calls[1][0].body.length).toBe(2);
    });
    it('bulk=2, 2 index messages are sent to ES, Expected: 1 batch with 2 messages', () => {
        config.replica.bulk = 2;
        const jms = {
            subscribe: jest.fn().mockImplementation((queueDetails, subscribeCb) => {
                const message = {
                    readString: jest.fn().mockImplementation((encoding, readStringCb) => {
                        readStringCb('', { action: 'index', index: 'dummyIndex', type: 'dummyType', id: 'dummyId_1', body: { message: 1 } });
                        readStringCb('', { action: 'index', index: 'dummyIndex', type: 'dummyType', id: 'dummyId_2', parent: {}, body: { message: 2 } });
                    }),
                    ack: jest.fn()
                }
                subscribeCb('', message);
            })
        }
        const { subscribe } = replication(jms, config, logger);
        expect(elasticSearch.Client).toHaveBeenCalled();
        subscribe();
        expect(logger.error).not.toHaveBeenCalled();
        expect(mockElasticClient.bulk).toHaveBeenCalled();
        // Property calls: Each call is represented by an array of arguments that were passed during the call
        // There are 2 index documents entries in the array body for bulk: totaling 4
        // expected: { body: [ { index: [Object] }, { message: 1 } ] }
        expect(mockElasticClient.bulk.mock.calls[0][0].body.length).toBe(4);
    });
    it('bulk=2, 1 index and 1 delete messages are sent to ES, Expected: 1 batch with 2 messages', () => {
        config.replica.bulk = 2;
        const jms = {
            subscribe: jest.fn().mockImplementation((queueDetails, subscribeCb) => {
                const message = {
                    readString: jest.fn().mockImplementation((encoding, readStringCb) => {
                        readStringCb('', { action: 'index', index: 'dummyIndex', type: 'dummyType', id: 'dummyId_1', body: { message: 1 } });
                        readStringCb('', { action: 'delete', index: 'dummyIndex', type: 'dummyType', id: 'dummyId_2' });
                    }),
                    ack: jest.fn()
                }
                subscribeCb('', message);
            })
        }
        const { subscribe } = replication(jms, config, logger);
        expect(elasticSearch.Client).toHaveBeenCalled();
        subscribe();
        expect(logger.error).not.toHaveBeenCalled();
        // Property calls: Each call is represented by an array of arguments that were passed during the call
        // There are 1 index and 1 delete documents entries in the array body for bulk: totaling 3
        expect(mockElasticClient.bulk.mock.calls[0][0].body.length).toBe(3);
        // First entry
        expect(Object.keys(mockElasticClient.bulk.mock.calls[0][0].body[0])[0]).toBe('index');
        // Third entry
        expect(Object.keys(mockElasticClient.bulk.mock.calls[0][0].body[2])[0]).toBe('delete');
    });
    it('bulk=4, batch contains 2 messages, [timeout] reaches first, expected: 1 batch with 2 messages', () => {
        // CUSTOM MOCK to avoid response error from Bulk
        mockElasticClient = {
            bulk: jest.fn().mockImplementation((documentsBulk, bulkCb) => {
                bulkCb(null, { items: [] });
            })
        };
        config.replica.bulk = 4;
        config.replica.timer = 5000;
        const jms = {
            subscribe: jest.fn().mockImplementation((queueDetails, subscribeCb) => {
                const message = {
                    readString: jest.fn().mockImplementation((encoding, readStringCb) => {
                        readStringCb('', { action: 'index', index: 'dummyIndex', type: 'dummyType', id: 'dummyId_1', body: { message: 1 } });
                        readStringCb('', { action: 'delete', index: 'dummyIndex', type: 'dummyType', id: 'dummyId_2' });
                    }),
                    ack: jest.fn()
                }
                subscribeCb('', message);
            })
        }
        const { subscribe } = replication(jms, config, logger);
        expect(setTimeout).not.toBeCalled();
        logger.info.mockClear();
        subscribe();
        expect(logger.error).not.toHaveBeenCalled();
        jest.runTimersToTime(5000);
        // console.log("jest.getTimerCount();", jest.getTimerCount());
        expect(mockElasticClient.bulk).toHaveBeenCalled();
        expect(setTimeout).toBeCalled();
        // Property calls: Each call is represented by an array of arguments that were passed during the call
        // There are 1 index and 1 delete documents entries in the array body for bulk: totaling 3
        expect(mockElasticClient.bulk.mock.calls[0][0].body.length).toBe(3);
        // First entry
        expect(Object.keys(mockElasticClient.bulk.mock.calls[0][0].body[0])[0]).toBe('index');
        // Third entry
        expect(Object.keys(mockElasticClient.bulk.mock.calls[0][0].body[2])[0]).toBe('delete');
        expect(logger.error).not.toHaveBeenCalled();
    });
    it('bulk=1, batch contains 1 message, expected: bulkLoad ERROR #1', () => {
        // CUSTOM MOCK for bulk ERROR
        mockElasticClient = {
            bulk: jest.fn().mockImplementation((documentsBulk, bulkCb) => {
                bulkCb({ error: 'Bulk function errors' });
            })
        };
        config.replica.bulk = 1;
        const jms = {
            subscribe: jest.fn().mockImplementation((queueDetails, subscribeCb) => {
                const message = {
                    readString: jest.fn().mockImplementation((encoding, readStringCb) => {
                        readStringCb('', { action: 'index', index: 'dummyIndex', type: 'dummyType', id: 'dummyId_1', body: { message: 1 } });
                    }),
                    ack: jest.fn()
                }
                subscribeCb('', message);
            })
        }
        const { subscribe } = replication(jms, config, logger);
        subscribe();
        expect(mockElasticClient.bulk).toHaveBeenCalled();
        // Property calls: Each call is represented by an array of arguments that were passed during the call
        // There is 1 index document in the array body for bulk: totaling 2
        expect(mockElasticClient.bulk.mock.calls[0][0].body.length).toBe(2);
        // index entry
        expect(Object.keys(mockElasticClient.bulk.mock.calls[0][0].body[0])[0]).toBe('index');
        // Error in Bulk:
        expect(logger.error).toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith(expect.stringMatching(/bulkLoad ERROR #1/));
    });
    it('bulk=1, batch contains 1 message, expected: bulkLoad ERROR #2', () => {
        // CUSTOM MOCK for bulk ERROR
        mockElasticClient = {
            bulk: jest.fn().mockImplementation((documentsBulk, bulkCb) => {
                bulkCb(null, { errors: [] });
            })
        };
        config.replica.bulk = 1;
        const jms = {
            subscribe: jest.fn().mockImplementation((queueDetails, subscribeCb) => {
                const message = {
                    readString: jest.fn().mockImplementation((encoding, readStringCb) => {
                        readStringCb('', { action: 'index', index: 'dummyIndex', type: 'dummyType', id: 'dummyId_1', body: { message: 1 } });
                    }),
                    ack: jest.fn()
                }
                subscribeCb('', message);
            })
        }
        const { subscribe } = replication(jms, config, logger);
        subscribe();
        // clearTimeOut should have been run
        expect(jest.getTimerCount()).toBe(0);
        expect(mockElasticClient.bulk).toHaveBeenCalled();
        // Property calls: Each call is represented by an array of arguments that were passed during the call
        // There is 1 index document in the array body for bulk: totaling 2
        expect(mockElasticClient.bulk.mock.calls[0][0].body.length).toBe(2);
        // index entry
        expect(Object.keys(mockElasticClient.bulk.mock.calls[0][0].body[0])[0]).toBe('index');
        // Error in Bulk:
        expect(logger.error).toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith(expect.stringMatching(/bulkLoad ERROR #2/));
    });
    it('bulk=1, 1 index message with action <> index or delete is sent to ES, Expected: 0 batches', () => {
        config.replica.bulk = 1;
        const jms = {
            subscribe: jest.fn().mockImplementation((queueDetails, subscribeCb) => {
                const message = {
                    readString: jest.fn().mockImplementation((encoding, readStringCb) => {
                        readStringCb('', { action: 'madeUp', index: 'dummyIndex', type: 'dummyType', id: 'dummyId_1', body: { message: 1 } });
                    }),
                    ack: jest.fn()
                }
                subscribeCb('', message);
            })
        }
        const { subscribe } = replication(jms, config, logger);
        expect(elasticSearch.Client).toHaveBeenCalled();
        subscribe();
        expect(logger.error).toHaveBeenCalled();
        expect(mockElasticClient.bulk).not.toHaveBeenCalled();
    });
});