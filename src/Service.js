const { validateSnipe } = require('./validator')
const { utils } = require('near-api-js')
const snipeTokenEmailTemplate = require('./email-templates/emailToken')
const { snipeStatusEnum, activityTypeEnum } = require('./enums')

class Service {
	constructor(repo, mail, snipeQueue) {
		this.repo = repo
		this.mail = mail
		this.snipeQueue = snipeQueue
	}

	async processActivites(activities) {
		const session = await this.repo.createSessionTransaction()
		try {
			session.startTransaction()

			for (const activity of activities) {
				await this._watchListingActivity(session, activity)
			}

			await this.repo.insertActivitiesWithSession(session, activities)

			await this.repo.commitTransaction(session)
		} catch (error) {
			await this.repo.abortTransaction(session)
			throw error
		} finally {
			await this.repo.endSession(session)
		}
	}

	async _sendEmail(to, subject, html) {
		await this.mail.mailgunTransport.sendMail(
			{
				from: '"Snipe Near" <no-reply@snipenear.xyz>',
				to,
				subject,
				html,
			},
			(error, info) => {
				if (error) {
					console.error(error)
					throw error
				} else {
					console.log(`Email sent: ${to} ${info.id}`)
				}
			}
		)
	}

	async _sendEmailTokenSniped(toEmail, price, imgUrl, mySnipeUrl, marketplaceUrl) {
		const subject = 'Hurry Up! Checkout your Token snipe now!'
		const template = snipeTokenEmailTemplate(price, imgUrl, mySnipeUrl, marketplaceUrl)
		await this._sendEmail(toEmail, subject, template)
	}

	async _getSnipesGreaterOrEqualPrice(contractId, tokenId, price) {
		//TODO search snipes by collection
		return await this.repo.getSnipesGreaterOrEqualPrice(contractId, tokenId, price)
	}

	async _watchListingActivity(session, activity) {
		if (activity.type !== activityTypeEnum.listing) return

		const snipes = await this._getSnipesGreaterOrEqualPrice(
			activity.data.nftContractId,
			activity.data.tokenId,
			parseFloat(utils.format.formatNearAmount(activity.data.price))
		)

		await this.repo.setSnipesStatusWithSession(
			session,
			snipes.map((snipe) => snipe._id),
			snipeStatusEnum.sniping
		)

		for (const snipe of snipes) {
			await this.snipeQueue.add({ snipe })
		}
	}

	async _sendNotification(snipe) {
		if (!snipe.settings.emailNotification) return
		// TODO get token image
		// TODO get marketplace url by receiverId
		// TODO get my snipe url

		this._sendEmailTokenSniped(
			snipe.settings.emailNotification,
			snipe._meta.formatNearAmount,
			'https://i.ytimg.com/vi/nm8q5ZfFpdc/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLAhJHl20hmEobcrCisIbaqqcprL-Q',
			'https://google.com',
			'https://google.com'
		)
		//TODO send push notification
	}

	async processSnipe(snipe) {
		try {
			await this._sendNotification(snipe)
			//TODO process auto buy
			await this.repo.setSnipeStatus(snipe._id, snipeStatusEnum.success)
		} catch (error) {
			console.error('errors.snipe token', error)
			await this.repo.setSnipeStatus(snipe._id, snipeStatusEnum.failed)
		}
	}

	async snipe(accountId, body) {
		await validateSnipe.validate(body, {
			strict: true,
		})

		//TODO validate contract
		await this.repo.createSnipe({
			accountId,
			...{
				contractId: body.contractId,
				tokenId: body.tokenId,
				price: body.price,
				settings: {
					emailNotification: body.settings.emailNotification || null,
					enablePushNotification: body.settings.enablePushNotification || false,
				},
			},
			status: snipeStatusEnum.waiting,
			createdAt: new Date().getTime(),
			updatedAt: null,
			_meta: {
				formatNearAmount: parseFloat(utils.format.formatNearAmount(body.price)),
			},
		})
	}

	async getSnipes(accountId, skip = 0, limit = 30) {
		const [results, count] = await Promise.all([
			this.repo.getSnipes(accountId, skip, limit),
			this.repo.countSnipe(accountId),
		])

		return {
			data: results,
			count,
			skip,
			limit,
		}
	}

	async updateSnipe(accountId, id, body) {
		await validateSnipe.validate(body, {
			strict: true,
		})

		// TOOD validate contract
		await this.repo.updateSnipe(accountId, id, {
			...{
				contractId: body.contractId,
				tokenId: body.tokenId,
				price: body.price,
				settings: {
					emailNotification: body.settings.emailNotification || null,
					enablePushNotification: body.settings.enablePushNotification || false,
				},
			},
			updatedAt: new Date().getTime(),
			_meta: {
				formatNearAmount: parseFloat(utils.format.formatNearAmount(body.price)),
			},
		})
	}

	async deleteSnipe(accountId, id) {
		await this.repo.deleteSnipe(accountId, id)
	}
}

module.exports = Service
