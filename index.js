const express = require('express')
const main = async () => {
	const server = express()

	server.get('/', (req, res) => {
		res.send('Hello world')
	})

	const port = process.env.PORT || 5000
	server.listen(port)
}

main()
