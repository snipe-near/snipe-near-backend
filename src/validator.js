const yup = require('yup')

module.exports = {
	validateSnipe: yup.object().shape({
		contractId: yup.string().required(),
		tokenId: yup.string().optional(),
		price: yup.string().required(),
		settings: yup
			.object()
			.shape({
				emailNotification: yup.string().email().optional(),
				enablePushNotification: yup.boolean().optional(),
			})
			.required(),
	}),
}
