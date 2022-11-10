const yup = require('yup')

module.exports = {
	validateSnipe: yup.object().shape({
		contractId: yup.string().required(),
		tokenId: yup.string().required(),
		price: yup.string().required(),
		settings: yup
			.object()
			.shape({
				emailNotification: yup.string().email().optional(),
				enablePushNotification: yup.boolean().optional(),
			})
			.required(),
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
	validateCheckNft: yup.object().shape({
		contractId: yup.string().required(),
		tokenId: yup.string().required(),
	}),
}
