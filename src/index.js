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
const WebPush = require('./helpers/Web-push')
const cors = require('cors')

const main = async () => {
	const database = new Database()
	await database.init()

	const cache = new Cache()
	await cache.init()

	const near = new Near()
	await near.init()

	const mail = new Mail()
	await mail.init()

	const webPush = new WebPush()
	await webPush.init()

	const indexerQueue = new Queue('indexer', configs.redisUrl)
	const snipeQueue = new Queue('snipe', configs.redisUrl)

	const repository = new Repository(database, cache)
	const service = new Service(repository, mail, snipeQueue, webPush, near)

	const server = express()
	server.use(cors())
	server.use(bodyParser.urlencoded({ extended: true }))
	server.use(bodyParser.json())

	indexerQueue.process(async (job, done) => {
		const activites = job.data.activities
		await service.processActivites(activites)
		done()
	})

	snipeQueue.process(async (job, done) => {
		const { snipe, activity } = job.data
		await service.processSnipe(snipe, activity)
		done()
	})

	server.get('/', (_, res) => {
		res.send('ok')
	})

	server.post('/snipes', authorizeNear(near), async (req, res) => {
		try {
			const accountId = req.account_id
			const snipeData = req.body
			const result = await service.snipe(accountId, snipeData)

			res.json({
				status: 1,
				data: result,
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

	server.post('/subscribe-web-push-notification', authorizeNear(near), async (req, res) => {
		try {
			const accountId = req.account_id
			const subscription = req.body

			await service.subscribeWebPushNotification(accountId, subscription)
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

	server.post('/unsubscribe-web-push-notification', authorizeNear(near), async (req, res) => {
		try {
			const accountId = req.account_id
			const subscription = req.body

			await service.unSubscribeWebPushNotification(accountId, subscription)
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

	server.get('/test-send-notif', authorizeNear(near), async (req, res) => {
		try {
			const accountId = req.account_id

			const payload = { title: 'HELLO' }
			await service._sendWebPushNotification(accountId, payload)
			res.status(200).json({
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
