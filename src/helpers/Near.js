const Base64 = require('js-base64').Base64
const nacl = require('tweetnacl')
const bs58 = require('bs58')
const sha256 = require('js-sha256')
const axios = require('axios')

const configs = require('../config/configs')

const _hexToArr = (str) => {
	return new Uint8Array(str.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)))
}

class Near {
	async authSignature(authHeader) {
		try {
			const decodeAuthHeader = Base64.decode(authHeader)
			const [accountId, pubKey, signature] = decodeAuthHeader.split('&')
			const pubKeyArr = _hexToArr(pubKey)
			const signatureArr = _hexToArr(signature)
			const hash = new Uint8Array(sha256.sha256.array(accountId))
			const verify = nacl.sign.detached.verify(hash, signatureArr, pubKeyArr)

			if (!verify) {
				throw new Error('unauthorized')
			}

			const b58pubKey = bs58.encode(Buffer.from(pubKey.toUpperCase(), 'hex'))
			const response = await axios.post(configs.nearConfig.nodeUrl, {
				jsonrpc: '2.0',
				id: 'dontcare',
				method: 'query',
				params: {
					request_type: 'view_access_key',
					finality: 'final',
					account_id: accountId,
					public_key: `ed25519:${b58pubKey}`,
				},
			})

			if (response.data.result && response.data.result.error && pubKey !== accountId) {
				throw new Error('unauthorized')
			}
			return accountId
		} catch (error) {
			console.log(error)
			throw error
		}
	}
}

module.exports = Near
