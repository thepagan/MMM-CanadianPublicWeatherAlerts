/* Magic Mirror
 * Module: CanadianPublicWeatherAlerts
 *
 * By Alex Souchereau http://github.com/aSouchereau
 * MIT Licensed.
 */
Module.register('MMM-CanadianPublicWeatherAlerts', {
    defaults: {
        lang: 'en',
        regions: [
            {
                code: ""
            }
        ],
        updateInterval: 60000, // once every minute (ms)
        animationSpeed: 1000, // one second (ms)
        displayInterval: 5000, // displays each alert for 5 seconds
        showNoAlertsMsg: false, // Displays "No alerts in Effect" message for each region if true
        periodicSync: false, // If enabled, module will send config to node helper every user-defined interval (useful for server only setups)
        syncInterval: 600000, // once every ten minutes (ms)

        apiBase: 'weather.gc.ca'
    },


    getStyles() {
        return ["MMM-CanadianPublicWeatherAlerts.css"];
    },


    getScripts() {
       return ["moment.js"];
    },


    start() {
        Log.log("Starting module: " + this.name);

        this.loaded = false;
        this.currentAlerts = [];

        // Preserve original animation speed so we can temporarily disable it for single-alert cases
        this.baseAnimationSpeed = this.config.animationSpeed;

        moment.locale(this.config.lang);

        this.sendSocketNotification('CPWA_CONFIG', this.config);
        if (this.config.periodicSync) {
            setInterval( () => { this.syncClient() }, this.config.syncInterval);
        }
        this.scheduleUpdate(this.config.updateInterval);
    },


    // Sends update request to server every configured interval
    scheduleUpdate(delay) {
        this.sendSocketNotification('CPWA_REQUEST_UPDATE', true);

        setInterval( () => { this.sendSocketNotification('CPWA_REQUEST_UPDATE', true) }, delay);
    },

    // Actions to be performed when a periodic sync is requested
    syncClient() {
        console.log("[" + this.name + "] Syncing with server");
        this.sendSocketNotification('CPWA_CONFIG', this.config);
        this.sendSocketNotification('CPWA_REQUEST_UPDATE', true);
    },


    getDom() {
        let wrapper = document.createElement("div");
        let innerElem = document.createElement("div");
        if (!this.loaded) {
            innerElem.innerHTML = "";
        }
        else {
            innerElem.innerHTML = this.AlertTitle + this.AlertRegion + this.AlertTime;
        }
        wrapper.appendChild(innerElem);
        return wrapper;
    },


    // Sets element variables to the current alert being displayed
    displayAlerts() {
        const timePrefix = (this.config.lang === "fr" ? "Publié" : "Issued");
        const displayedAlert = this.currentAlerts[this.currentAlertID];

        if (!displayedAlert) {
            this.AlertTitle = "";
            this.AlertRegion = "";
            this.AlertTime = "";
            this.updateDom(this.config.animationSpeed);
            return;
        }

        const rawTitle = (displayedAlert.title && displayedAlert.title[0]) ? String(displayedAlert.title[0]) : "";
        const parts = rawTitle.split(", ");
        const titleText = parts[0] || rawTitle;
        const regionText = (parts.length > 1) ? parts.slice(1).join(", ") : "";

        const updatedRaw = (displayedAlert.updated && displayedAlert.updated[0]) ? displayedAlert.updated[0] : null;
        const timeText = updatedRaw ? moment(updatedRaw).fromNow() : "";

        this.AlertTitle = `<div class="${this.name} alert-title bright">${titleText}</div>`;
        this.AlertRegion = regionText ? `<div class="${this.name} alert-region">${regionText}</div>` : "";
        this.AlertTime = timeText ? `<div class="${this.name} alert-time">${timePrefix} ${timeText}</div>` : "";

        this.updateDom(this.config.animationSpeed);
    },


    // Iterates through currentAlerts, used instead of for loop to control speed
    startDisplayTimer() {
        this.currentAlertID = 0;
        clearInterval(this.timer);

        // Display immediately so we don't wait for the first interval tick
        this.loaded = true;
        this.displayAlerts();

        this.timer = setInterval(() => {
            if (!this.currentAlerts || this.currentAlerts.length === 0) return;
            this.currentAlertID = (this.currentAlertID + 1) % this.currentAlerts.length;
            this.displayAlerts();
        }, this.config.displayInterval + this.config.animationSpeed);
    },


    socketNotificationReceived(notification, payload) {
        if (notification === "CPWA_STARTED") { // Updates dom after node_helper receives config
            this.updateDom();
        }
        else if (notification === "CPWA_UPDATE") {
            this.currentAlerts = [];

            if (payload.length !== 0) {
                // If only one alert, temporarily disable transition animation.
                // Restore the original animation speed when multiple alerts are present.
                if (payload.length === 1) {
                    this.config.animationSpeed = 0;
                } else {
                    this.config.animationSpeed = this.baseAnimationSpeed;
                }

                this.currentAlerts = payload;
                this.startDisplayTimer();

            } else {
                this.AlertTitle = "";
                this.AlertRegion = "";
                this.AlertTime = "";
                this.updateDom();

                clearInterval(this.timer);
                this.config.animationSpeed = this.baseAnimationSpeed;

                Log.log(`[${this.name}] No Alerts in effect for configured regions`);
            }

        }
    }
});