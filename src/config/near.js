function getNearConfig(env) {
	switch (env) {
		case 'mainnet':
			return {
				networkId: 'mainnet',
				nodeUrl: 'https://rpc.mainnet.near.org',
				walletUrl: 'https://wallet.mainnet.near.org',
				helperUrl: 'https://helper.mainnet.near.org',
			}
		case 'testnet':
			return {
				networkId: 'default',
				nodeUrl: 'https://rpc.testnet.near.org',
				walletUrl: 'https://wallet.testnet.near.org',
				helperUrl: 'https://helper.testnet.near.org',
			}
		default:
			throw Error(`Unconfigured environment '${env}'`)
	}
}

module.exports = getNearConfig
