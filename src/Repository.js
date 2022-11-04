const { ObjectId } = require('mongodb')
const { snipeStatusEnum } = require('./enums')

class Repository {
	constructor(db, cache) {
		this.db = db
		this.cache = cache

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
		await this.snipesDb.insertOne(snipe)
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

	async countSnipe(accountId) {
		return await this.snipesDb.count({
			accountId,
		})
	}

	async updateSnipe(accountId, id, snipe) {
		await this.snipesDb.updateOne(
			{
				_id: ObjectId(id),
				accountId,
			},
			{
				$set: snipe,
			}
		)
	}

	async deleteSnipe(accountId, id) {
		await this.snipesDb.deleteOne({
			_id: ObjectId(id),
			accountId,
		})
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

	async getAccountByAccountId(accountId) {
		return await this.db.mongo.collection('accounts').findOne({
			accountId,
		})
	}
}

module.exports = Repository
