class Service {
	constructor(repo) {
		this.repo = repo
	}

	async _watchListingActivity(activity) {}

	async processActivites(activities) {
		const session = await this.repo.createSessionTransaction()
		try {
			session.startTransaction()

			await this.repo.insertActivitiesWithSessin(session, activities)

			await this.repo.commitTransaction(session)
		} catch (error) {
			await this.repo.abortTransaction(session)
			throw error
		} finally {
			await this.repo.endSession(session)
		}
	}

	async snipe(body) {
		console.log({ body })
		return {
			foo: 1,
		}
	}

	async getSnipes(skip = 0, limit = 30) {
		console.log({ skip, limit })
		return {
			foo: 1,
		}
	}

	async updateSnipe(id, body) {
		console.log({ id, body })
		return {
			foo: 1,
		}
	}

	async deleteSnipe(id) {
		console.log({ id })
		return {
			foo: 1,
		}
	}
}

module.exports = Service
