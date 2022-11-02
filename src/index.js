require('dotenv').config()
const express = require('express')
const Cache = require('./helpers/Cache')
const Database = require('./helpers/Database')
const Repository = require('./Repository')
const Service = require('./Service')

const main = async () => {
	const database = new Database()
	await database.init()
	const cache = new Cache()
	await cache.init()

	const repository = new Repository(database, cache)
	const service = new Service(repository)

	const server = express()

	server.get('/', (req, res) => {
		res.send('Hello world')
	})

	const port = process.env.PORT || 5000
	server.listen(port)
	console.log('App is running on port: ', port)
}

main()
