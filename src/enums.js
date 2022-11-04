const activityTypeEnum = Object.freeze({
	listing: 'listing',
})

const snipeStatusEnum = Object.freeze({
	waiting: 'waiting',
	sniping: 'sniping',
	success: 'success',
	failed: 'failed',
})

module.exports = {
	activityTypeEnum,
	snipeStatusEnum,
}
