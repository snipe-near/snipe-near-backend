module.exports = (near) => {
	return async (req, res, next) => {
		try {
			const accountId = await near.authSignature(req.headers.authorization)
			if (accountId) {
				req.account_id = accountId
				next()
			} else {
				throw new Error('unauthorized')
			}
		} catch (error) {
			return res.status(401).json({
				status: 0,
				message: 'unauthorized',
			})
		}
	}
}
