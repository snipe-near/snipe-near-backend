require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const Queue = require('bull')
const Cache = require('./helpers/Cache')
const Database = require('./helpers/Database')
const Repository = require('./Repository')
const Service = require('./Service')
const configs = require('./config/configs')
const Near = require('./helpers/Near')
const authorizeNear = require('./middleware/authorize-near')
const Mail = require('./helpers/Mail')

const main = async () => {
	const database = new Database()
	await database.init()
	const cache = new Cache()
	await cache.init()
	const near = new Near()
	const mail = new Mail()
	await mail.init()

	const indexerQueue = new Queue('indexer', configs.redisUrl)

	const repository = new Repository(database, cache)
	const service = new Service(repository, mail)

	const server = express()
	server.use(bodyParser.urlencoded({ extended: true }))
	server.use(bodyParser.json())

	indexerQueue.process(async (job, done) => {
		const activites = job.data.activities
		await service.processActivites(activites)
		done()
	})

	server.get('/', (_, res) => {
		res.send('ok gan')
	})

	server.post('/snipes', authorizeNear(near), async (req, res) => {
		try {
			const accountId = req.account_id
			const snipeData = req.body
			await service.snipe(accountId, snipeData)

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

	server.get('/snipes', authorizeNear(near), async (req, res) => {
		try {
			const accountId = req.account_id
			let { skip, limit } = req.query
			skip = parseInt(skip) || 0
			limit = Math.min(parseInt(limit), 30) || 30

			const results = await service.getSnipes(accountId, skip, limit)
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

	server.put('/snipes/:snipeId', authorizeNear(near), async (req, res) => {
		try {
			const accountId = req.account_id
			const snipeId = req.params.snipeId
			const snipeData = req.body

			await service.updateSnipe(accountId, snipeId, snipeData)
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

	server.delete('/snipes/:snipeId', authorizeNear(near), async (req, res) => {
		try {
			const accountId = req.account_id
			const snipeId = req.params.snipeId

			await service.deleteSnipe(accountId, snipeId)
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

	server.listen(configs.port)
	console.log('App is running on port: ', configs.port)
}

main()
