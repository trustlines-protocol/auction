import axios from 'axios'
import mainConfig from './config'
import BN from 'bn.js'

const _3 = new BN(3)
const _1 = new BN(1)
const DECAY_FACTOR = new BN(746571428571)

export default class EthEventsClient {

    constructor() {

        this._baseUrl = `${mainConfig.database.ethEvents.host}/${mainConfig.validatorAuction.network}/es`
        this._contractAddress = mainConfig.validatorAuction.contractAddress

        this._axisConfig = {
            headers: { 'Authorization': `Bearer ${mainConfig.database.ethEvents.token}` }
        }
    }

    async getAuctionSummary() {
        const result = {
            contractAddress: this._contractAddress
        }
        const [currentBlockTime, bids, auctionStart, whitelistedAddresses, deploymentParams] = await Promise.all([
            this.getCurrentBlockTime(),
            this.getBidEvents(),
            this.getAuctionStartInSeconds(),
            this.getWhitelistedAddresses(),
            this.getAuctionDeploymentParameters()
        ])

        result.whitelistedAddresses = whitelistedAddresses
        result.bids = bids
        result.takenSlotsCount = bids.length
        result.freeSlotsCount = deploymentParams.numberOfParticipants - result.takenSlotsCount
        result.remainingSeconds = EthEventsClient.calculateRemainingAuctionSeconds(auctionStart, currentBlockTime, deploymentParams.durationInDays)
        result.currentPriceInWEI = EthEventsClient.getCurrentPriceAsBigNumber(auctionStart * 1000, currentBlockTime * 1000, deploymentParams.durationInDays, deploymentParams.startPrice).toString()
        result.priceFunction = EthEventsClient.calculateAllSlotPrices(auctionStart, deploymentParams.durationInDays, deploymentParams.startPrice)
        result.currentBlocktimeInMs = currentBlockTime * 1000
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
        if (response.data.hits.total > 0) {
            return response.data.hits.hits[0]._source.timestamp
        } else {
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

    async getAuctionDeploymentParameters() {
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
                                'event.raw': 'AuctionDeployed'
                            }
                        }
                    ]
                }
            },
            '_source': 'args'
        }, this._axisConfig)
        if (response.data.hits.total > 0) {
            const args = response.data.hits.hits[0]._source.args
            const startPriceArg = args.find(a => a.name === 'startPrice')
            const durationInDaysArg = args.find(a => a.name === 'auctionDurationInDays')
            const numberOfParticipantsArg = args.find(a => a.name === 'numberOfParticipants')
            return {
                startPrice: new BN(startPriceArg['value.hex'], 16),
                durationInDays: durationInDaysArg['value.num'],
                numberOfParticipants: numberOfParticipantsArg['value.num']
            }
        } else {
            return undefined
        }
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
                bidValue: bidValueArg['value.hex'],
                slotPrice: slotPriceArg['value.hex'],
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

    static getCurrentPriceAsBigNumber(startInMs, nowInMs, durationInDays, startPriceWEI) {
        // See: https://github.com/trustlines-network/project/issues/394
        // and https://github.com/trustlines-protocol/auction/issues/7
        const t = new BN(nowInMs - startInMs).div(new BN(durationInDays))
        const decay = t.pow(_3).div(DECAY_FACTOR)
        return startPriceWEI.mul(_1.add(t)).div(_1.add(t).add(decay))
    }

    static calculateAllSlotPrices(startInSeconds, durationInDays, startPriceWEI, ticks = 128) {
        const allPrices = []
        const remainingSeconds = EthEventsClient.calculateRemainingAuctionSeconds(startInSeconds, startInSeconds, durationInDays)
        const tick = Math.round(remainingSeconds / ticks)
        const startInMs = startInSeconds * 1000
        let currentTickInSeconds = startInSeconds
        for (let i = 0; i < ticks; ++i) {
            allPrices.push({
                timestamp: currentTickInSeconds,
                slotPrice: EthEventsClient.getCurrentPriceAsBigNumber(startInMs, currentTickInSeconds * 1000, durationInDays, startPriceWEI).toString(16)
            })
            currentTickInSeconds = currentTickInSeconds + tick
        }
        return allPrices
    }

    static calculateRemainingAuctionSeconds(startInSeconds, nowInSeconds, durationInDays) {
        if (startInSeconds === 0) {
            return -1
        }
        const end = startInSeconds + (durationInDays * 24 * 60 * 60)
        return Math.max(end - Math.round(nowInSeconds), 0)
    }
}
