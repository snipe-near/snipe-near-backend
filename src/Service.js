const {
	validateSnipe,
	validateSubscribeWebPushNotification,
	validateUpdateSnipe,
} = require('./validator')
const { utils } = require('near-api-js')
const snipeTokenEmailTemplate = require('./email-templates/emailToken')
const { snipeStatusEnum, activityTypeEnum } = require('./enums')
const { ObjectId } = require('mongodb')

class Service {
	constructor(repo, mail, snipeQueue, webPush, near) {
		this.repo = repo
		this.mail = mail
		this.snipeQueue = snipeQueue
		this.webPush = webPush
		this.near = near
	}

	async processActivites(activities) {
		const session = await this.repo.createSessionTransaction()
		try {
			session.startTransaction()

			for (const activity of activities) {
				await this._watchListingActivity(session, activity)
				await this._watchSnipeActivity(session, activity)
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
		const subject = `Hurry Up! Checkout your Token snipe now! - [${new Date().toISOString()}]`
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
			await this.snipeQueue.add({ snipe, activity })
		}
	}

	async _watchSnipeActivity(session, activity) {
		if (activity.type === activityTypeEnum.snipe) {
			if (!ObjectId.isValid(activity.data.memo)) {
				return
			}

			await this.repo.updateSnipeByIdWithSession(
				session,
				activity.data.accountId,
				activity.data.memo,
				{
					externalId: activity.data.snipeId,
					accountId: activity.data.accountId,
					contractId: activity.data.contractId,
					tokenId: activity.data.tokenId,
					deposit: activity.data.deposit,
					status: snipeStatusEnum.waiting,
					isAutoBuy: true,
				}
			)
		}

		if (activity.type === activityTypeEnum.deleteSnipe) {
			await this.repo.deleteSnipeByExternalIdWithSession(
				session,
				activity.data.accountId,
				activity.data.snipeId
			)
		}

		if (activity.type === activityTypeEnum.buyToken) {
			await this.repo.updateSnipeByExternalIdWithSession(
				session,
				activity.data.accountId,
				activity.data.snipeId,
				{
					status: activity.data.status,
					_meta: {
						buyReceiptId: activity.receiptId,
					},
				}
			)

			if (activity.data.status === snipeStatusEnum.success) {
				const snipe = await this.repo.getSnipeByExternalId(
					activity.data.accountId,
					activity.data.snipeId
				)

				await this._sendNotification(snipe)
			}
		}
	}

	async _sendNotification(snipe) {
		// TODO send notification isAutobuy, should be different from normal snipe
		if (snipe.settings.emailNotification) {
			// TODO get token image
			// TODO get marketplace url by receiverId
			// TODO get my snipe url
			this._sendEmailTokenSniped(
				snipe.settings.emailNotification,
				snipe._meta.formatNearAmount,
				snipe.metadata.media,
				'https://google.com',
				'https://google.com'
			)
		}

		if (snipe.settings.enablePushNotification) {
			this._sendWebPushNotification(snipe.accountId, {
				title: 'Snipe Near',
			})
		}
	}

	async _processAutoBuy(listingActivity) {
		// fire and forget, the indexer will update the status later
		this.near.snipeNearContract.buy_token({
			args: {
				marketplace_contract_id: listingActivity.data.marketplaceContractId,
				price: listingActivity.data.price,
				snipe_id: externalId,
			},
			gas: '300000000000000', // TODO optimize gas
		})
	}

	async processSnipe(snipe, activity) {
		try {
			if (!snipe.isAutoBuy) {
				await this._sendNotification(snipe)
				await this.repo.setSnipeStatus(snipe._id, snipeStatusEnum.success)
				return
			}

			await this._processAutoBuy(snipe, activity)
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
				isAutoBuy: body.isAutoBuy,
				// TODO move metadata to _meta & get value from view contract
				metadata: {
					title: body.metadata.title || null,
					media: body.metadata.media || null,
				},
			},
			status: body.isAutoBuy === true ? snipeStatusEnum.notActive : snipeStatusEnum.waiting,
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

	async updateSnipe(accountId, idOrExternalId, body) {
		await validateUpdateSnipe.validate(body, {
			strict: true,
		})

		const snipe = await this.repo.getSnipeByIdOrExternalId(accountId, idOrExternalId)
		if (snipe.status !== snipeStatusEnum.waiting) {
			throw new Error('errors.snipe is not in waiting state')
		}

		await this.repo.updateSnipe(accountId, idOrExternalId, {
			...{
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
		const snipe = await this.repo.getSnipeByIdOrExternalId(accountId, id)
		if (snipe.isAutoBuy) {
			throw new Error('errors.snipe is auto buy type')
		}
		if (snipe.status !== snipeStatusEnum.waiting) {
			throw new Error('errors.snipe is not in waiting state')
		}

		await this.repo.deleteSnipe(accountId, id)
	}

	async subscribeWebPushNotification(accountId, subscription) {
		await validateSubscribeWebPushNotification.validate(subscription, {
			strict: true,
		})
		const subscriptionBase64 = Buffer.from(JSON.stringify(subscription)).toString('base64')
		await this.repo.addSubscriptiondWebPushNotificationToAccount(accountId, subscriptionBase64)
	}

	async unSubscribeWebPushNotification(accountId, subscription) {
		await validateSubscribeWebPushNotification.validate(subscription, {
			strict: true,
		})
		const subscriptionBase64 = Buffer.from(JSON.stringify(subscription)).toString('base64')
		await this.repo.removeSubscriptiondWebPushNotificationToAccount(accountId, subscriptionBase64)
	}

	async _sendWebPushNotification(accountId, payload) {
		console.log({ accountId, payload })
		const account = await this.repo.getAccountByAccountId(accountId)
		if (!account) return

		for (let subscription of account.webPushSubcriptions) {
			subscription = new Buffer.from(subscription, 'base64')
			subscription = JSON.parse(subscription.toString())
			this.webPush.sendNotification(subscription, JSON.stringify(payload))
		}
	}
}

module.exports = Service
