"use strict";

class ServiceLocator {

    constructor() {
        this.dependencyMap = {};
        this.dependencyCache = {};
    }

    register(dependencyName, constructor) {
        if (typeof constructor !== 'function') {
            throw new Error(`${dependencyName}: Dependency contructor is not a function`);
        }
        if (!dependencyName) {
            throw new Error('Invalid dependency name provided');
        }
        this.dependencyMap[dependencyName] = constructor;
    }

    getDependency(dependencyName) {
        if(! this.dependencyMap[dependencyName]){
            throw new Error(`${dependencyName}: Attempting to retrieve unknown dependency`);
        }
        if (this.dependencyCache[dependencyName] === undefined) {
            const dependencyContructor = this.dependencyMap[dependencyName];
            const dependency = dependencyContructor();
            if (dependency) {
                this.dependencyCache[dependencyName] = dependency;
            }
        }
        return this.dependencyCache[dependencyName];
    }
    
    clear() {
        this.dependencyMap = {};
        this.dependencyCache = {};
    }
}
// This is not normally good practice
const serviceLocator = new ServiceLocator();

module.exports = serviceLocator;