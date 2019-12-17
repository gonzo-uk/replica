"use strict";
const fs = require('fs');
const path = require('path');
const serviceLocator = require('./haServiceLocator');

let configFileLoc, config;
try {
    // Load ha-api-config.json
    configFileLoc = path.join(__dirname, 'ha-replica-config.json');
    if (!fs.existsSync(configFileLoc)) configFileLoc = path.join(__dirname, '..', 'ha-replica-config.json');
    if (!fs.existsSync(configFileLoc)) throw new Error(`Cannot find ${configFileLoc}`);
    config = JSON.parse(fs.readFileSync(configFileLoc, 'utf-8'));
} catch (e) {
    throw e;
}

// Register Services 
serviceLocator.register('jmsClient', () => {
    const jmsClient = require('../jms/haJMSClient');
    return new jmsClient(config);
});

serviceLocator.register('logger', () => {
    const logger = require('../logger/logger');
    return logger.initialise(config);
});

module.exports = serviceLocator;