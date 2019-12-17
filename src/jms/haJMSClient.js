"use strict";
const stompit = require('stompit');
const serviceLoc = require('../lib/haServiceLocator');
const logger = serviceLoc.getDependency('logger');
const scriptName = 'haJMSClient';

class JmsClient {
	constructor(config = {}) {
		if (!config.jms) {
			throw new Error('Please set-up jms section in your ha-api-config.json file');
		}
		logger.info(`${scriptName}: config.jms.host=${config.jms.host || ''}`);
		logger.info(`${scriptName}: config.jms.port=${config.jms.port || ''}`);
		logger.info(`${scriptName}: config.jms.user=${config.jms.user || ''}`);
		logger.info(`${scriptName}: config.jms.password=${config.jms.password || ''}`);
		if (!config.jms.host || !config.jms.port || !config.jms.user || !config.jms.password) {
			throw new Error('Please provide jms.host, jms.port, jms.user & jms.password properties in your ha-api-config.json file');
		}
		this._connections = null;
		this._channel = null;
		this._log = null;

		this._serverMain = {
			'host': config.jms.host,
			'port': config.jms.port,
			'connectHeaders': {
				'login': config.jms.user,
				'passcode': config.jms.password,
				'host': config.jms.host,
				'heart-beat': '15000,15000'
			}
		};
		this._servers = [this._serverMain];
		if (config.jms.hostFailover && config.jms.portFailover && config.jms.userFailover && config.jms.passwordFailover) {
			this._serverFailover = {
				'host': config.jms.hostFailover,
				'port': config.jms.portFailover,
				'connectHeaders': {
					'login': config.jms.userFailover,
					'passcode': config.jms.passwordFailover,
					'host': config.jms.hostFailover,
					'heart-beat': '15000,15000'
				}
			};
			this._servers.push(this._serverFailover);
		}
		// it seems that these options are ignored
		const reconnectOptions = {
			maxReconnectAttempts: 10,
			maxAttempts: 10
		};
		this._connections = new stompit.ConnectFailover(this._servers, reconnectOptions);
		// Set up connection listeners - this will fire as soon as we create a Channel
		this._connections.on('connecting', (connector) => {
			const address = connector.serverProperties.remoteAddress.transportPath;
			logger.info(`${scriptName}: Connecting to ${address}`);
		});
		this._connections.on('connect', (connector) => {
			logger.info(`${scriptName}: Connection is ready`);
		});
		this._connections.on('error', (error) => {
			logger.info(`${scriptName}: Connection lost due to: ${error.message}`);
		});
		this._channel = new stompit.Channel(this._connections, {
			'alwaysConnected': true
		});
	}
	get servers() {
		return this._servers;
	}
	get connections() {
		return this._connections;
	}
	get channel() {
		return this._channel;
	}

	// METHODS
	// They'll remain as call-back functions
	subscribe(headers, callback) {
		return this._channel.subscribe(headers, callback);
	};

	send(headers, body, callback) {
		return this._channel.send(headers, body, callback);
	};
}

module.exports = JmsClient;
