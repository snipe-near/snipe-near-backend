const webpush = require('web-push')
const configs = require('../config/configs')

class WebPush {
	constructor() {
		this.webPush = null
	}

	async init() {
		try {
			webpush.setVapidDetails(
				'mailto:contact@snipenear.xyz',
				configs.VAPIdKeys.publicKey,
				configs.VAPIdKeys.privateKey
			)
		} catch (error) {
			throw error
		}
	}

	async sendNotification(subscription, payload) {
		try {
			await webpush.sendNotification(subscription, payload)
		} catch (error) {
			throw error
		}
	}
}

module.exports = WebPush
