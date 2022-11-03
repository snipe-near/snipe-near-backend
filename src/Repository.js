class Repository {
	constructor(db, cache) {
		this.db = db
		this.cache = cache

		this.activitesDb = db.mongo.collection('activities')
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

	async insertActivitiesWithSessin(session, activites) {
		await this.activitesDb.insertMany(activites, { session })
	}
}

module.exports = Repository
