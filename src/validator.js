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
		metadata: yup
			.object()
			.shape({
				title: yup.string().optional(),
				media: yup.string().optional(),
			})
			.optional(),
		isAutoBuy: yup.boolean().required(),
	}),
	validateUpdateSnipe: yup.object().shape({
		price: yup.string().required(),
		settings: yup
			.object()
			.shape({
				emailNotification: yup.string().email().optional(),
				enablePushNotification: yup.boolean().optional(),
			})
			.required(),
	}),
	validateSubscribeWebPushNotification: yup.object().shape({
		endpoint: yup.string().required(),
		expirationTime: yup.string().nullable(),
		keys: yup
			.object()
			.shape({
				p256dh: yup.string().required(),
				auth: yup.string().required(),
			})
			.required(),
	}),
}
