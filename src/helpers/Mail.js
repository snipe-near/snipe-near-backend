const nodemailer = require('nodemailer')
const mg = require('nodemailer-mailgun-transport')
const configs = require('../config/configs')

class Mail {
	constructor() {
		this.mailgunTransport = null
	}

	async init() {
		try {
			const auth = {
				auth: {
					api_key: configs.mailGun.apiKey,
					domain: configs.mailGun.domain,
				},
			}
			this.mailgunTransport = nodemailer.createTransport(mg(auth))
		} catch (error) {
			throw error
		}
	}
}

module.exports = Mail
