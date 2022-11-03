module.exports = {
	port: process.env.PORT || 5000,
	redisUrl: process.env.REDIS_URL,
	mongoUrl: process.env.MONGO_URL,
	dbName: process.env.DB_NAME,
}
