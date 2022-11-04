const { validateSnipe } = require('./validator')
const { utils } = require('near-api-js')
const snipeTokenEmailTemplate = require('./email-templates/emailToken')

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
					console.log(error)
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
		await this.sendEmail(toEmail, subject, template)
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
