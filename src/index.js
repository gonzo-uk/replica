'use strict';
const scriptName = 'index';
// Make sure all dependencies are loaded first 
const haDepInjection = require('./lib/haDepInjection');
// Now import dependecies
const config = haDepInjection.getDependency('config');
const logger = haDepInjection.getDependency('logger');
const jms = haDepInjection.getDependency('jmsClient');
logger.info(`${scriptName}: replication process being initialised`);
const elasticReplica = require('./replica/haReplicaMain');
const { subscribe } = elasticReplica(jms, config, logger);
subscribe();
logger.info(`${scriptName}: replication process started`);
