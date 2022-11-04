const { validateSnipe } = require('./validator')

class Service {
	constructor(repo, mail) {
		this.repo = repo
		this.mail = mail
	}

	async _watchListingActivity(activity) {}

	async processActivites(activities) {
		const session = await this.repo.createSessionTransaction()
		try {
			session.startTransaction()

			await this.repo.insertActivitiesWithSession(session, activities)

			await this.repo.commitTransaction(session)
		} catch (error) {
			await this.repo.abortTransaction(session)
			throw error
		} finally {
			await this.repo.endSession(session)
		}
	}

	async sendEmail(to, subject, html) {
		await this.mail.mailgunTransport.sendMail(
			{
				from: '"Snipe Near" <no-reply@snipenear.xyz>',
				to,
				subject,
				html,
			},
			(error, info) => {
				if (error) {
					throw err
				} else {
					console.log(`Email sent: ${to} ${info.id}`)
				}
			}
		)
	}

	async snipe(accountId, body) {
		await validateSnipe.validate(body, {
			strict: true,
		})

		// await this.sendEmail('hafizjoundys@gmail.com', 'TEST SNIPE NEAR', 'BODY EMAIL')
		//TODO validate contract
		await this.repo.createSnipe({
			accountId,
			...body,
			createdAt: new Date().getTime(),
			updatedAt: null,
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
			...body,
			updatedAt: new Date().getTime(),
		})
	}

	async deleteSnipe(accountId, id) {
		await this.repo.deleteSnipe(accountId, id)
	}
}

module.exports = Service
