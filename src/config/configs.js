const getNearConfig = require('./near.js')

module.exports = {
	port: process.env.PORT || 5000,
	nodeEnv: process.env.NODE_ENV || 'testnet',
	redisUrl: process.env.REDIS_URL,
	mongoUrl: process.env.MONGO_URL,
	dbName: process.env.DB_NAME,
	nearConfig: getNearConfig(process.env.NODE_ENV || 'testnet'),
	mailGun: {
		apiKey: process.env.MAILGUN_API_KEY,
		domain: process.env.MAILGUN_DOMAIN,
	},
	VAPIdKeys: {
		publicKey: process.env.VAPID_PUBLIC_KEY,
		privateKey: process.env.VAPID_PRIVATE_KEY,
	},
}
