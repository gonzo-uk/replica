'use strict';
const elasticSearch = require('elasticsearch');
let jms, config, logger, esClient, documentsBulk, registerTimeOutFn;

const scriptName = 'haReplicaMain';

const sendToElastic = () => {
    if (registerTimeOutFn) {
        clearTimeout(registerTimeOutFn);
    }
    // This does a deep copy:
    //const bulkInputString = JSON.stringify(documentsBulk);
    logger.info(`${scriptName}: Documents Sent: ${documentsBulk.total}`);
    // Field _type is no longer being sent to ES so this version of the code works with ES > 7
    esClient.bulk(documentsBulk, (error, response) => {
        if (error) {
            logger.error(`${scriptName}: bulkLoad ERROR #1: ${JSON.stringify(documentsBulk)}, Due to: ${JSON.stringify(error)}`);
        } else {
            if (response.errors) {
                logger.error(`${scriptName}: bulkLoad ERROR #2: ${JSON.stringify(documentsBulk)}, Due to: ${JSON.stringify(response.errors)}`);
            } else {
                logger.info(`${scriptName}: Indexed ${response.items.length} documents from total ${documentsBulk.total}`);
            }
        }
    });
    documentsBulk = {
        body: [],
        total: 0
    };
}

const subscribe = () => {
    // Reset important variables
    registerTimeOutFn = null;
    documentsBulk = {
        body: [],
        total: 0
    };
    logger.info(`${scriptName}: Subscribing Replication to queue: ${config.replica.elasticQueue}`);
    jms.subscribe({
        destination: config.replica.elasticQueue,
        ack: 'client-individual'
    }, (error, message) => {
        if (error) {
            logger.error(`${scriptName}: Subscribe error due to: ${error}`);
        } else {
            message.readString('utf-8', (error, messageBody) => {
                if (error) {
                    logger.error(`${scriptName}: Message cannot be parsed due to: ${error}`);
                } else {
                    // Process: Whatever happens first of the following will cause this process to send a bulk of entries to ES
                    // 1) a timeOut of replica.timer milisecond have been reached  
                    // 2) or a number of total records defined replica.bulk
                    if (!registerTimeOutFn) {
                        registerTimeOutFn = setTimeout(sendToElastic, config.replica.timer);
                    }
                    if (config.replica.bulk > 0 && messageBody.action) {
                        let header;
                        message.ack();
                        switch (messageBody.action) {
                            case 'index':
                            case 'update':
                                header = {
                                    index: {
                                        _index: (config.replica.environment || '') + messageBody.index,
                                        _id: messageBody.id
                                    }
                                };
                                if (messageBody.parent) {
                                    header.index._parent = messageBody.parent;
                                  }
                                // Each index action should have 2 entries in documentsBulk: Header and body 
                                documentsBulk.body.push(header);
                                documentsBulk.body.push(messageBody.body);
                                documentsBulk.total++;
                                break;
                            case 'delete':
                                header = {
                                    delete: {
                                        _index: (config.replica.environment || '') + messageBody.index,
                                        _id: messageBody.id
                                    }
                                };
                                // Each delete actaion should have 1 entry in documentsBulk
                                documentsBulk.body.push(header);
                                documentsBulk.total++;
                                break;
                            default:
                                logger.error(`${scriptName}: Invalid action specifed: ${messageBody.action} - could not load ${JSON.stringify(messageBody.body)}`);
                                return;
                        }
                        // client.bulk({body: Object: The operation definition and data (action-data pairs), separated by newlines})
                        if (documentsBulk.total >= config.replica.bulk) {
                            //console.log("config.replica.bulk", config.replica.bulk);
                            sendToElastic();
                        }
                    }
                }
            });
        }
    });
}

module.exports = (_jms, _config, _logger) => {
    if (!_jms || !_config || !_logger) {
        throw new Error('JMS Service, ha-replica-config.json or logger not passed in');
    }
    config = _config;
    logger = _logger;
    jms = _jms;

    logger.info(`${scriptName}: config.replica.bulk=${config.replica.bulk || ''}`);
    logger.info(`${scriptName}: config.replica.timer=${config.replica.timer || ''}`);
    logger.info(`${scriptName}: config.replica.elasticQueue=${config.replica.elasticQueue || ''}`);
    // We are assuming config.elasticsearch has been set-up
    logger.info(`${scriptName}: config.elasticsearch.user=${config.elasticSearch.user || ''}`);
    logger.info(`${scriptName}: config.elasticsearch.password=${config.elasticSearch.password ? config.elasticSearch.password.replace(/./g, '*') : ''}`);
    logger.info(`${scriptName}: config.elasticsearch.url=${config.elasticSearch.url || ''}`);
    logger.info(`${scriptName}: config.elasticsearch.apiVersion=${config.elasticSearch.apiVersion || ''}`);

    if (!config.replica.elasticQueue) {
        throw new Error('Please set up replica.elasticQueue in the config ha-replica.config.json');
    }
    // Initialise ES Service: at this point config is available
    esClient = new elasticSearch.Client({
        host: config.elasticSearch.user + ':' + config.elasticSearch.password + '@' + config.elasticSearch.url,
        apiVersion: config.elasticSearch.esApiVersion
    });
    return {
        subscribe: subscribe
    };
}