var Ikea = require('node-tradfri-client');

module.exports = class Gateway  {

    constructor(log, config) {

        config = Object.assign({}, config);

        if (config.psk && !config.securityCode)
            config.securityCode = config.psk;

        if (process.env.IKEA_TRADFRI_SECURITY_CODE)
            config.securityCode = process.env.IKEA_TRADFRI_SECURITY_CODE;

        if (process.env.IKEA_TRADFRI_HOST)
            config.host = process.env.IKEA_TRADFRI_HOST;

        if (config.securityCode == undefined && (config.psk == undefined))
            throw new Error('The security code from the back of the IKEA gateway must be specified in ~/.homebridge/config.json.')

        if (config.securityCode == undefined && (config.psk == undefined || config.identity == undefined))
            throw new Error('You have to supply an identity and the corresponding psk!')

        this.config         = config;
        this.log            = log;
        this.gateway        = null;
    }

    getHostName() {
        return new Promise((resolve, reject) => {

            if (this.config.host != undefined)
                resolve(this.config.host);
            else {
                this.log('Discovering gateway...');

                Ikea.discoverGateway().then((discovery) => {
                    if (discovery && discovery.name) {
                        this.log('Discovered host "%s"', discovery.name);
                        resolve(discovery.name);
                    }
                    else {
                        reject(new Error('Cannot discover gateway address. Sorry, you have to enter the IP address yourself in ~/.homebridge/config.json.'));    
                    }

                })
                .catch((error) => {
                    reject(error);
                })
            }
        });        
    }

    enablePing() {

        setInterval(() => {
            this.gateway.ping().then(() => {
                // this.log('Ping OK.');
            })
            .catch((error) => {
                this.log('Ping failed!');
                this.log(error);
            })
        }, 60000);

        return Promise.resolve();

    }

    connect() {
        return new Promise((resolve, reject) => {
            Promise.resolve().then(() => {
                return this.getHostName();
            })

            .then((host) => {
                this.gateway = new Ikea.TradfriClient(host);

                this.gateway.on('device updated', (device) => {
                    this.deviceUpdated(device);
                });
        
                this.gateway.on('group updated', (group) => {
                    this.groupUpdated(group);
                });
                return Promise.resolve();
            })

            .then(() => {
	        if (this.config.identity != undefined && this.config.psk != undefined) {
	            return { "identity": this.config.identity, "psk": this.config.psk };
	        } else {
                    return this.gateway.authenticate(this.config.securityCode);
	        }
            })
            .then((credentials) => {
                return this.gateway.connect(credentials.identity, credentials.psk);
            })
            .then((connected) => {
                if (connected)
                    return Promise.resolve();
                else
                    reject(new Error('Could not connect.'));
            })
            .then(() => {
                this.log('Loading devices...');
                return this.gateway.observeDevices();
            })
            .then(() => {
                this.log('Loading groups and scenes...');
                return this.gateway.observeGroupsAndScenes();

            })
            .then(() => {
                return this.enablePing();
            })
            .then(() => {
                this.log('Done.');
                resolve();
            })
            .catch((error) => {
                reject(error);
            })
        });
    }

    deviceUpdated(device) {
    }

    groupUpdated(group) {
    }
}
