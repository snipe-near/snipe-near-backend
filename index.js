const express = require('express')
const main = async () => {
	const server = express()

	server.get('/', (req, res) => {
		res.send('Hello world')
	})

	server.listen(9090)
}

main()
