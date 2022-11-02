const { MongoClient, Logger } = require('mongodb')
const configs = require('../config/configs')

class Database {
	constructor() {
		this.ready = null
		this.mongoClient = new MongoClient(`${configs.mongoUrl}?retryWrites=true&w=majority`, {
			useNewUrlParser: true,
			useUnifiedTopology: true,
		})
	}

	async init() {
		try {
			await this.mongoClient.connect()
			this.mongo = this.mongoClient.db(process.env.DB_NAME_MARKETPLACE)
			if (process.env.NODE_ENV === 'development') {
				Logger.setLevel('debug')
			}
			this.ready = true
		} catch (err) {
			console.log(err)
			throw err
		}
	}
}

module.exports = Database
