const {
	validateSnipe,
	validateSubscribeWebPushNotification,
	validateUpdateSnipe,
	validateCheckNft,
} = require('./validator')
const { utils } = require('near-api-js')
const snipeTokenEmailTemplate = require('./email-templates/emailToken')
const snipeTokenAutoBuyEmailTemplate = require('./email-templates/emailTokenAutoBuy')
const { snipeStatusEnum, activityTypeEnum } = require('./enums')
const { ObjectId } = require('mongodb')
const CID = require('cids')
const axios = require('axios')
const AsyncRetry = require('async-retry')
const crypto = require('crypto')

class Service {
	constructor(repo, mail, snipeQueue, webPush) {
		this.repo = repo
		this.mail = mail
		this.snipeQueue = snipeQueue
		this.webPush = webPush
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
				from: '"EverSnipe" <no-reply@eversnipe.xyz>',
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
		const currentDate = new Date()
		const dateTimeUtc = `${currentDate.getUTCDate()}/${
			currentDate.getUTCMonth() + 1
		}/${currentDate.getUTCFullYear()} ${currentDate.getUTCHours()}:${currentDate.getUTCMinutes()}:${currentDate.getUTCSeconds()}`

		const subject = `Hurry Up! Checkout your Token snipe now! - [${dateTimeUtc} UTC]`
		const template = snipeTokenEmailTemplate(price, imgUrl, mySnipeUrl, marketplaceUrl)
		await this._sendEmail(toEmail, subject, template)
	}

	async _sendEmailTokenSnipedAutoBuy(toEmail, imgUrl) {
		const currentDate = new Date()
		const dateTimeUtc = `${currentDate.getUTCDate()}/${
			currentDate.getUTCMonth() + 1
		}/${currentDate.getUTCFullYear()} ${currentDate.getUTCHours()}:${currentDate.getUTCMinutes()}:${currentDate.getUTCSeconds()}`

		const subject = `Ayo! Check your wallet now! - [${dateTimeUtc} UTC]`
		const template = snipeTokenAutoBuyEmailTemplate(imgUrl)
		await this._sendEmail(toEmail, subject, template)
	}

	async _getSnipesGreaterOrEqualPrice(contractId, tokenId, price) {
		//TODO optimize search mechanism
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

		// when the snipe is autobuy, it's only needed to add the first snipe to the queue
		let isAutoBuyHasBeenAdded = false
		for (const snipe of snipes) {
			if (!snipe.isAutoBuy) {
				await this.repo.setSnipesStatusWithSession(session, [snipe._id], snipeStatusEnum.sniping) // TODO optimize
				await this.snipeQueue.add({ snipe, activity })
				continue
			}

			if (isAutoBuyHasBeenAdded === true) continue
			await this.repo.setSnipesStatusWithSession(session, [snipe._id], snipeStatusEnum.sniping) // TODO optimize
			await this.snipeQueue.add({ snipe, activity })
			isAutoBuyHasBeenAdded = true
		}
	}

	async _watchSnipeActivity(session, activity) {
		if (activity.type === activityTypeEnum.snipe) {
			if (!ObjectId.isValid(activity.data.memo)) {
				return
			}

			await this.repo.updateNotActiveSnipeByIdWithSession(
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
					buyReceiptId: activity.receiptId,
				}
			)

			if (activity.data.status === snipeStatusEnum.success) {
				const snipe = await this.repo.getSnipeByIdOrExternalId(
					activity.data.accountId,
					activity.data.snipeId
				)
				if (!snipe) {
					return
				}
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
			if (snipe.isAutoBuy) {
				this._sendEmailTokenSnipedAutoBuy(snipe.settings?.emailNotification, snipe._meta?.mediaUrl)
			} else {
				this._sendEmailTokenSniped(
					snipe.settings?.emailNotification,
					snipe._meta?.formatNearAmount,
					snipe._meta?.mediaUrl,
					'https://eversnipe.xyz',
					'https://eversnipe.xyz'
				)
			}
		}

		if (snipe.settings.enablePushNotification) {
			this._sendOneSignalPushNotification(snipe.accountId, {
				title: 'EverSnipe',
				content: 'Your token has been sniped!',
			})
		}
	}

	async _processAutoBuy(snipe, listingActivity) {
		// fire and forget, the indexer will update the status later
		this.repo.buyToken(
			listingActivity.data.marketplaceContractId,
			listingActivity.data.price,
			snipe.externalId,
			listingActivity.data.marketplaceType
		)
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
	async _getUrlFromValueNftData(data) {
		if (!data) {
			return ''
		}

		const dataLowerCase = data.toLowerCase()
		if (dataLowerCase.includes('http://') || dataLowerCase.includes('https://')) {
			if (dataLowerCase.includes('ipfs.io/ipfs')) {
				return data.replace('ipfs.io/ipfs', 'snipenear.infura-ipfs.io/ipfs')
			}
			return data
		}

		let hash
		if (!dataLowerCase.includes('ipfs://')) {
			hash = new CID(dataLowerCase).toString()
		} else {
			let ipfsSplit = dataLowerCase.split('://')
			if (ipfsSplit.length === 0) {
				return null
			}

			hash = new CID(ipfsSplit[1]).toString()
		}

		return `https://snipenear.infura-ipfs.io/ipfs/${hash}`
	}

	_getObjFromExtra(extra) {
		if (extra === null || extra === undefined || Number.isInteger(extra)) {
			return {}
		}
		let extraObj
		try {
			extraObj = JSON.parse(extra)
		} catch {
			return {}
		}

		return extraObj
	}

	_getFullUrlFromBaseUri(nftMetadata, url) {
		if (nftMetadata.base_uri) {
			let baseUri = nftMetadata.base_uri
			if (baseUri.slice(-1) !== '/') {
				baseUri = baseUri + '/'
			}

			return baseUri + url
		}

		return url
	}

	async _getObjFromReference(nftToken, nftMetadata) {
		if (!nftToken?.metadata?.reference) {
			return {}
		}
		const reference = this._getFullUrlFromBaseUri(nftMetadata, nftToken.metadata.reference)

		const referenceUrl = await this._getUrlFromValueNftData(reference)
		const response = await AsyncRetry(
			async () => {
				try {
					return await axios.get(referenceUrl)
				} catch (error) {
					console.error(error)
					throw error
				}
			},
			{
				retries: 10,
				minTimeout: 1000,
				maxTimeout: 5000,
			}
		)
		if (!(response && (typeof response.data === 'object' || response === 'object'))) {
			return {}
		}

		return response.data
	}

	_omitNull(obj) {
		if (!obj) return {}

		Object.keys(obj)
			.filter((k) => obj[k] === null)
			.forEach((k) => delete obj[k])
		return obj
	}

	async _getMediaUrl(nftToken, nftMetadata) {
		const media = this._getFullUrlFromBaseUri(nftMetadata, nftToken.metadata.media)
		return await this._getUrlFromValueNftData(media)
	}

	async _getDeepNftData(contractId, tokenId) {
		try {
			const cache = await this.repo.getNftDataCache(contractId, tokenId)
			if (cache) {
				return cache
			}

			const [nftToken, nftMetadata] = await Promise.all([
				this.repo.viewNftToken(contractId, tokenId),
				this.repo.viewNftMetadata(contractId),
			])

			// TODO hack, only get reference when the media is not exist
			let reference = {}
			if (!nftToken?.metadata?.media || !nftToken?.metadata?.title) {
				reference = await this._getObjFromReference(nftToken, nftMetadata)
			}

			const extra = this._getObjFromExtra(nftToken.metadata?.extra)
			const metadata = {
				...this._omitNull(reference),
				...this._omitNull(extra),
				...this._omitNull(nftToken.metadata),
			}
			nftToken.metadata = metadata

			const mediaUrl = await this._getMediaUrl(nftToken, nftMetadata)

			const result = {
				mediaUrl,
				nftToken: nftToken,
				nftMetadata: nftMetadata,
			}

			this.repo.setNftDataCache(contractId, tokenId, result)

			return result
		} catch (error) {
			console.error(error)
			return null
		}
	}

	async checkNft(contractId, tokenId) {
		await validateCheckNft.validate(
			{
				contractId,
				tokenId,
			},
			{
				strict: true,
			}
		)

		const currentDateTime = new Date().getTime()
		const [nftData, queueNumber] = await Promise.all([
			this._getDeepNftData(contractId, tokenId),
			this.repo.getQueueNumberAutoBuy(contractId, tokenId, currentDateTime),
		])
		if (!nftData) {
			throw new Error('errors.nft error or invalid')
		}

		return {
			...nftData,
			queueNumber,
		}
	}

	async snipe(accountId, body) {
		await validateSnipe.validate(body, {
			strict: true,
		})

		const nftData = await this._getDeepNftData(body.contractId, body.tokenId)
		if (!nftData) {
			throw new Error('errors.nft error or invalid')
		}

		const result = await this.repo.createSnipe({
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
			},
			status: body.isAutoBuy === true ? snipeStatusEnum.notActive : snipeStatusEnum.waiting,
			createdAt: new Date().getTime(),
			updatedAt: null,
			_meta: {
				formatNearAmount: parseFloat(utils.format.formatNearAmount(body.price)),
				...nftData,
			},
		})

		return {
			_id: result.insertedId,
		}
	}

	async getSnipes(accountId, skip = 0, limit = 30) {
		let [results, count] = await Promise.all([
			this.repo.getSnipes(accountId, skip, limit),
			this.repo.countSnipe(accountId),
		])

		results = await Promise.all(
			results.map(async (result) => {
				if (!result.isAutoBuy || result.status !== snipeStatusEnum.waiting) {
					return result
				}

				result.queueNumberAutoBuy = await this.repo.getQueueNumberAutoBuy(
					result.contractId,
					result.tokenId,
					result.createdAt
				)
				return result
			})
		)

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

		snipe.updatedAt = new Date().getTime()
		snipe._meta.formatNearAmount = parseFloat(utils.format.formatNearAmount(body.price))

		await this.repo.updateSnipe(accountId, idOrExternalId, {
			...snipe,
			...{
				price: body.price,
				settings: {
					emailNotification: body.settings.emailNotification || null,
					enablePushNotification: body.settings.enablePushNotification || false,
				},
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
		const account = await this.repo.getAccountByAccountId(accountId)
		if (!account) return
		if (!Array.isArray(account.webPushSubcriptions)) return

		for (let subscription of account.webPushSubcriptions) {
			subscription = new Buffer.from(subscription, 'base64')
			subscription = JSON.parse(subscription.toString())
			this.webPush.sendNotification(subscription, JSON.stringify(payload))
		}
	}

	async _sendOneSignalPushNotification(accountId, payload) {
		const account = await this.repo.getAccountByAccountId(accountId)
		if (!account) return
		if (!Array.isArray(account.identities)) return

		await this.repo.sendNotifOneSignal(account.identities, payload)
	}

	async accountIdentity(accountId, inputIdentity) {
		const identity = crypto.createHash('sha256').update(inputIdentity).digest('hex')
		await this.repo.setAccountIdentity(accountId, identity)
		return identity
	}

	async removeAccountIdentity(accountId, inputIdentity) {
		const identity = crypto.createHash('sha256').update(inputIdentity).digest('hex')
		await this.repo.removeAccountIdentity(accountId, identity)
		return identity
	}
}

module.exports = Service
