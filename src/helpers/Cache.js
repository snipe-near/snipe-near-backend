const configs = require('../config/configs')
const Redis = require('ioredis')

class Cache {
	constructor() {
		this.ready = null
		this.redis = new Redis(configs.redisUrl)
	}

	async init() {
		try {
			this.ready = true
		} catch (error) {
			console.error(error)
			throw error
		}
	}
}

module.exports = Cache
