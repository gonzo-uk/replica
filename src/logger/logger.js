'use strict';
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, prettyPrint, colorize, align, printf } = format;

class Logger {
    static initialise(config) {
        const transportOptions = [];
        const plainFormatFile = combine(align(), printf(
            data => `${(new Date()).toISOString()} ${data.level}: ${data.message}`
        ));
        // Example of the console output
        // 2019-09-20T09:06:23.425Z info:  Starting server.js
        const plainFormatConsole = combine(colorize(), align(), printf(
            data => `${(new Date()).toISOString()} ${data.level}: ${data.message}`
        ));
        const jsonFormat = combine(
            timestamp(),
            prettyPrint()
        );
        if (config.logging && config.logging.console) {
            transportOptions.push(
                new transports.Console({
                    level: config.logging.console.level || 'error',
                    handleExceptions: true,
                    format: config.logging.console.format === "json" ? jsonFormat : plainFormatConsole
                })
            );
        }
        if (config.logging && config.logging.file && config.logging.file.fileName) {
            transportOptions.push(
                new transports.File({
                    filename: config.logging.file.fileName,
                    level: config.logging.file.level || 'error',
                    handleExceptions: true,
                    maxsize: config.logging.file.maxSize || 117760, // 5MG
                    maxFiles: config.logging.file.maxFiles || 1,
                    format: config.logging.file.format === "json" ? jsonFormat : plainFormatFile
                })
            );
        }
        return createLogger({
            transports: transportOptions,
            exitOnError: false // todo: Check if this is going to be a problem if it fails in creating 
        });
    }
}
module.exports = Logger;