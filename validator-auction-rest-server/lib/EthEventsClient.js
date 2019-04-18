import axios from 'axios'
import mainConfig from './config'

const _14_DAYS_IN_SECONDS = 1209600
const price_start = 10 ** 22
const MAX_SLOTS_COUNT = 123

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
        const [currentBlockTime, bids, auctionStart, whitelistedAddresses] = await Promise.all([
            this.getCurrentBlockTime(),
            this.getBidEvents(),
            this.getAuctionStartInSeconds(),
            this.getWhitelistedAddresses()
        ])

        result.whitelistedAddresses = whitelistedAddresses
        result.bids = bids
        result.takenSlotsCount = bids.length
        result.freeSlotsCount = MAX_SLOTS_COUNT - result.takenSlotsCount
        result.remainingSeconds = EthEventsClient.calculateRemainingAuctionSeconds(auctionStart, currentBlockTime)
        result.currentPrice = EthEventsClient.getCurrentPrice(auctionStart * 1000, currentBlockTime * 1000)
        return result
    }

    async getCurrentBlockTime() {
        const response = await axios.post(`${this._baseUrl}/block/search/`, {
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
        }, this._axisConfig)
        if(response.data.hits.total > 0) {
            return response.data.hits.hits[0]._source.timestamp
        }
        else {
            throw new Error('Could not get block time')
        }
    }

    async getAuctionStartInSeconds() {
        const response = await axios.post(`${this._baseUrl}/event/search/`, {
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
        }, this._axisConfig)
        return response.data.hits.total > 0 ? response.data.hits.hits[0]._source.args[0]['value.num'] : 0
    }

    async getBidEvents() {
        const response = await axios.post(`${this._baseUrl}/event/search/`, {
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
        }, this._axisConfig)

        return response.data.hits.hits.map(hit => {
            const bidderArg = hit._source.args.find(a => a.name === 'bidder')
            const bidValueArg = hit._source.args.find(a => a.name === 'bidValue')
            const slotPriceArg = hit._source.args.find(a => a.name === 'slotPrice')
            const timestampArg = hit._source.args.find(a => a.name === 'timestamp')
            return {
                bidder: bidderArg['value.hex'],
                bidValue: bidValueArg['value.scaled'],
                slotPrice: slotPriceArg['value.scaled'],
                timestamp: timestampArg['value.num']
            }
        }).sort((a, b) => Number.parseInt(a.timestamp) - Number.parseInt(b.timestamp))
    }

    async getWhitelistedAddresses() {
        const response = await axios.post(`${this._baseUrl}/event/search/`, {
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
                                'event.raw': 'AddressWhitelisted'
                            }
                        }
                    ]
                }
            },
            '_source': 'args'
        }, this._axisConfig)

        return response.data.hits.hits.map(hit => {
            const firstArg = hit._source.args.find(a => a.pos === 0)
            return firstArg['value.hex']
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
