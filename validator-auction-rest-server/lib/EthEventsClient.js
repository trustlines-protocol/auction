import axios from 'axios'
import mainConfig from './config'

const _14_DAYS_IN_SECONDS = 1209600
const price_start = 10 ** 22

export default class EthEventsClient {

    constructor() {
        this._baseUrl = `${mainConfig.database.ethEvents.host}/${mainConfig.validatorAuction.network}/es`
        this._contractAddress = mainConfig.validatorAuction.contractAddress

        this._axisConfig = {
            headers: {'Authorization': `Bearer ${mainConfig.database.ethEvents.token}`}
        }
    }

    async getAuctionSummary() {
        const result = {
            contractAddress: this._contractAddress
        }
        const remoteCalls = await Promise.all([this.getCurrentBlockTime(), this.getBidEvents(), this.getAuctionStartInSeconds(), this.getWhitelistedAddresses()])

        const currentBlockTime = remoteCalls[0]
        const auctionStart = remoteCalls[2]

        result.whitelistedAddresses = remoteCalls[3]
        result.bids = remoteCalls[1]
        result.freeSlotsCount = 123 - result.bids.length
        result.takenSlotsCount = 123 - result.freeSlotsCount
        result.remainingSeconds = EthEventsClient.calculateRemainingAuctionSeconds(auctionStart, currentBlockTime)
        result.currentPrice = EthEventsClient.getCurrentPrice(auctionStart * 1000, currentBlockTime * 1000)
        return result
    }

    getCurrentBlockTime() {
        return axios.post(`${this._baseUrl}/block/search/`, {
            'query': {
                'match_all': {}
            },
            'size': 1,
            'sort': [
                {
                    'number.num': {
                        'order': 'desc'
                    }
                }
            ],
            '_source': 'timestamp'
        }, this._axisConfig).then(r => {
            return r.data.hits.total > 0 ? r.data.hits.hits[0]._source.timestamp : 0
        })
    }

    getAuctionStartInSeconds() {
        return axios.post(`${this._baseUrl}/event/search/`, {
            'size': 1,
            'query': {
                'bool': {
                    'must': [
                        {
                            'term': {
                                'address.raw': this._contractAddress
                            }
                        },
                        {
                            'term': {
                                'event.raw': 'AuctionStarted'
                            }
                        }
                    ]
                }
            },
            '_source': 'args'
        }, this._axisConfig).then(r => {
            return r.data.hits.total > 0 ? r.data.hits.hits[0]._source.args[0]['value.num'] : 0
        })
    }

    getBidEvents() {
        return axios.post(`${this._baseUrl}/event/search/`, {
            'size': 1000,
            'query': {
                'bool': {
                    'must': [
                        {
                            'term': {
                                'address.raw': this._contractAddress
                            }
                        },
                        {
                            'term': {
                                'event.raw': 'BidSubmitted'
                            }
                        }
                    ]
                }
            },
            '_source': 'args'
        }, this._axisConfig).then(r => {
            return r.data.hits.hits.map(hit => {
                // better check if they are in that sequence
                const firstArg = hit._source.args.find(a => a.pos === 0)
                const secondArg = hit._source.args.find(a => a.pos === 1)
                const thirdArg = hit._source.args.find(a => a.pos === 2)
                return {
                    bidder: firstArg['value.hex'],
                    bidValue: secondArg['value.hex'],
                    timestamp: thirdArg['value.num']
                }
            }).sort((a, b) => Number.parseInt(a.timestamp) - Number.parseInt(b.timestamp))
        })
    }

    getWhitelistedAddresses() {
        return axios.post(`${this._baseUrl}/event/search/`, {
            'size': 1000,
            'query': {
                'bool': {
                    'must': [
                        {
                            'term': {
                                'address.raw': this._contractAddress
                            }
                        },
                        {
                            'term': {
                                // TODO: Ask come for name
                                'event.raw': 'WhiteListed'
                            }
                        }
                    ]
                }
            },
            '_source': 'args'
        }, this._axisConfig).then(r => {
            return r.data.hits.hits.map(hit => {
                // TODO could still change
                const firstArg = hit._source.args.find(a => a.pos === 0)
                return firstArg['value.hex']
            })
        })
    }

    static getCurrentPrice(startInMs, nowInMs) {
        // See: https://github.com/trustlines-network/project/issues/394
        const t = nowInMs - startInMs
        const decay = (t ** 3) / 146328000000000
        return price_start * (1 + t) / (1 + t + decay)
    }

    static calculateRemainingAuctionSeconds(startInSeconds, nowInSeconds) {
        if (startInSeconds === 0) {
            return -1
        }
        const end = startInSeconds + _14_DAYS_IN_SECONDS
        return Math.max(end - Math.round(nowInSeconds), 0)
    }
}
