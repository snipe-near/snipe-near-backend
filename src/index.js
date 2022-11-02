require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
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
	server.use(bodyParser.urlencoded({ extended: true }))
	server.use(bodyParser.json())

	server.get('/', (req, res) => {
		res.send('ok gan')
	})

	server.post('/snipes', async (req, res) => {
		try {
			const snipeData = req.body
			await service.snipe(snipeData)

			res.json({
				status: 1,
			})
		} catch (error) {
			const message = error.message || err
			res.status(500).json({
				status: 0,
				message: message,
			})
		}
	})

	server.get('/snipes', async (req, res) => {
		try {
			let { skip, limit } = req.query
			skip = parseInt(skip) || 0
			limit = Math.min(parseInt(limit), 30) || 30

			const results = await service.getSnipes(skip, limit)
			res.json({
				status: 1,
				data: results,
			})
		} catch (error) {
			const message = error.message || err
			res.status(500).json({
				status: 0,
				message: message,
			})
		}
	})

	server.put('/snipes/:snipeId', async (req, res) => {
		try {
			const snipeId = req.params.snipeId
			const snipeData = req.body

			await service.updateSnipe(snipeId, snipeData)
			res.json({
				status: 1,
			})
		} catch (error) {
			const message = error.message || err
			res.status(500).json({
				status: 0,
				message: message,
			})
		}
	})

	server.delete('/snipes/:snipeId', async (req, res) => {
		try {
			const snipeId = req.params.snipeId

			await service.deleteSnipe(snipeId)
			res.json({
				status: 1,
			})
		} catch (error) {
			const message = error.message || err
			res.status(500).json({
				status: 0,
				message: message,
			})
		}
	})

	const port = process.env.PORT || 5000
	server.listen(port)
	console.log('App is running on port: ', port)
}

main()
