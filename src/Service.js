class Service {
	constructor(repo) {
		this.repo = repo
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
