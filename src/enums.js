const activityTypeEnum = Object.freeze({
	listing: 'listing',
	snipe: 'snipe',
	deleteSnipe: 'delete_snipe',
	buyToken: 'buy_token',
})

const snipeStatusEnum = Object.freeze({
	waiting: 'waiting',
	sniping: 'sniping',
	success: 'success',
	failed: 'failed',
	notActive: 'not_active',
})

module.exports = {
	activityTypeEnum,
	snipeStatusEnum,
}
