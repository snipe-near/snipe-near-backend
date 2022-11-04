const { ObjectId } = require('mongodb')

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
}

module.exports = Repository
