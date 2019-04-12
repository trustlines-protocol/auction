import axios from 'axios'
import mainConfig from './config'
import WHITELISTED_ADDRESSES from './whitelistAddresses.json'

export const _14_DAYS_IN_SECONDS = 1209600

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

        const bidEvents = await this.getBidEvents()
        result.bids = bidEvents
        result.freeSlotsCount = 123 - bidEvents.length
        result.takenSlotsCount = 123 - result.freeSlotsCount

        const auctionStart = await this.getAuctionStart()
        result.remainingSeconds = this.calculateRemainingAuctionSeconds(auctionStart)

        result.whitelistedAddresses = WHITELISTED_ADDRESSES

        result.currentPrice = this.getCurrentPrice(bidEvents)

        return result
    }

    getCurrentPrice(events) {
        // TODO
        return events
    }

    calculateRemainingAuctionSeconds(start) {
        return start === 0 ? -1 : start - _14_DAYS_IN_SECONDS
    }

    async getAuctionStart() {
        const events = await axios.post(`${this._baseUrl}/event/search/`, {
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
        if (events.data.hits.total > 0) {
            return events.data.hits.hits[0]._source.args[0]['value.num']
        } else {
            return 0
        }
    }

    async getBidEvents() {
        const events = await axios.post(`${this._baseUrl}/event/search/`, {
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
        return events.data.hits.hits.map(hit => {
            // better check if they are in that sequence
            const firstArg = hit._source.args.find(a => a.pos === 0)
            const secondArg = hit._source.args.find(a => a.pos === 1)
            const thirdArg = hit._source.args.find(a => a.pos === 2)
            return {
                bidder: firstArg['value.hex'],
                bidValue: secondArg['value.hex'],
                timestamp: thirdArg['value.num']
            }
        })
    }
}
