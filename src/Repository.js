const { ObjectId } = require('mongodb')
const { snipeStatusEnum } = require('./enums')

class Repository {
	constructor(db, cache, near) {
		this.db = db
		this.cache = cache
		this.near = near

		this.activitesDb = db.mongo.collection('activities')
		this.snipesDb = db.mongo.collection('snipes')
	}

	async createSessionTransaction() {
		return await this.db.mongoClient.startSession()
	}

	async abortTransaction(session) {
		await session.abortTransaction()
	}

	async commitTransaction(session) {
		await session.commitTransaction()
	}

	async endSession(session) {
		await session.endSession()
	}

	async insertActivitiesWithSession(session, activites) {
		await this.activitesDb.insertMany(activites, { session })
	}

	async createSnipe(snipe) {
		return await this.snipesDb.insertOne(snipe)
	}

	async createSnipeWithSession(session, snipe) {
		await this.snipesDb.insertOne(snipe, {
			session,
		})
	}

	async getSnipes(accountId, skip = 0, limit = 30) {
		return await this.snipesDb
			.find({
				accountId,
			})
			.skip(skip)
			.limit(limit)
			.toArray()
	}

	async getSnipeByIdOrExternalId(accountId, idOrExternalId) {
		return await this.snipesDb.findOne({
			$or: [
				{
					_id: ObjectId(idOrExternalId),
				},
				{
					externalId: idOrExternalId,
				},
			],
			accountId,
		})
	}

	async countSnipe(accountId) {
		return await this.snipesDb.count({
			accountId,
		})
	}

	async updateSnipe(accountId, idOrExternalId, data) {
		await this.snipesDb.updateOne(
			{
				$or: [
					{
						_id: ObjectId(idOrExternalId),
					},
					{
						externalId: idOrExternalId,
					},
				],
				accountId,
			},
			{
				$set: data,
			}
		)
	}

	async updateSnipeByExternalIdWithSession(session, accountId, externalId, data) {
		await this.snipesDb.updateOne(
			{
				externalId,
				accountId,
			},
			{
				$set: data,
			},
			{
				session,
			}
		)
	}

	async updateSnipeByIdWithSession(session, accountId, id, data) {
		await this.snipesDb.updateOne(
			{
				_id: ObjectId(id),
				accountId,
			},
			{
				$set: data,
			},
			{
				session,
			}
		)
	}

	async updateNotActiveSnipeByIdWithSession(session, accountId, id, data) {
		await this.snipesDb.updateOne(
			{
				_id: ObjectId(id),
				accountId,
				status: snipeStatusEnum.notActive,
			},
			{
				$set: data,
			},
			{
				session,
			}
		)
	}

	async deleteSnipe(accountId, id) {
		await this.snipesDb.deleteOne({
			_id: ObjectId(id),
			accountId,
		})
	}

	async deleteSnipeByExternalIdWithSession(session, accountId, externalId) {
		await this.snipesDb.deleteOne(
			{
				externalId,
				accountId,
			},
			{
				session,
			}
		)
	}

	// exact nft (contractId, tokenId) not a collection
	async getSnipesGreaterOrEqualPrice(contractId, tokenId, price) {
		return await this.snipesDb
			.find({
				contractId,
				tokenId,
				['_meta.formatNearAmount']: {
					$gte: price,
				},
				status: snipeStatusEnum.waiting,
			})
			.toArray()
	}

	async setSnipeStatus(id, status) {
		await this.snipesDb.updateOne(
			{
				_id: ObjectId(id),
			},
			{
				$set: {
					status,
				},
			}
		)
	}

	async setSnipesStatusWithSession(session, objectIds, status) {
		await this.snipesDb.updateMany(
			{
				_id: {
					$in: objectIds,
				},
			},
			{
				$set: {
					status,
				},
			},
			{ session }
		)
	}

	async addSubscriptiondWebPushNotificationToAccount(accountId, subscription) {
		await this.db.mongo.collection('accounts').updateOne(
			{
				accountId: accountId,
			},
			{
				$addToSet: {
					webPushSubcriptions: subscription,
				},
			},
			{
				upsert: true,
			}
		)
	}

	async removeSubscriptiondWebPushNotificationToAccount(accountId, subscription) {
		await this.db.mongo.collection('accounts').updateOne(
			{
				accountId: accountId,
			},
			{
				$pull: {
					webPushSubcriptions: subscription,
				},
			}
		)
	}

	async getAccountByAccountId(accountId) {
		return await this.db.mongo.collection('accounts').findOne({
			accountId,
		})
	}

	async buyToken(marketplaceContracId, price, externalId) {
		await this.near.snipeNearContract.buy_token({
			args: {
				marketplace_contract_id: marketplaceContracId,
				price: price,
				snipe_id: externalId,
			},
			gas: '300000000000000', // TODO optimize gas
		})
	}

	async viewNftToken(contractId, tokenId) {
		return await this.near.snipeNearAccount.viewFunctionV2({
			contractId,
			methodName: 'nft_token',
			args: { token_id: tokenId },
		})
	}

	async viewNftMetadata(contractId) {
		return await this.near.snipeNearAccount.viewFunctionV2({
			contractId,
			methodName: 'nft_metadata',
			args: {},
		})
	}

	async getNftDataCache(contractId, tokenId) {
		return await this.getCache(`nft_data:${contractId}:${tokenId}`)
	}

	async setNftDataCache(contractId, tokenId, data) {
		await this.setCache(`nft_data:${contractId}:${tokenId}`, data)
	}

	async setCache(key, data, ttl = 3600 * 24) {
		await this.cache.redis.set(key, JSON.stringify(data), 'EX', ttl)
	}

	async getCache(key) {
		const data = await this.cache.redis.get(key)
		if (!data) {
			return null
		}
		return JSON.parse(data)
	}
}

module.exports = Repository
