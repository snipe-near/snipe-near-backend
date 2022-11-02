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
		} catch (err) {
			console.log(err)
			throw err
		}
	}
}

module.exports = Cache
