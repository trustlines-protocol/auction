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
            headers: {'Authorization': `Bearer ${mainConfig.database.ethEvents.token}`}
        }
    }

    async getAuctionSummary() {
        const [currentBlockTime, allEvents] = await Promise.all([this.getCurrentBlockTime(), this.getAllEvents()])

        const state = this.getAuctionState(allEvents)

        if (state === 'Not Deployed') {
            return {
                auctionState: state
            }
        }

        const deploymentParams = this.getAuctionDeploymentParameters(allEvents)
        const bids = this.getBids(allEvents)
        const whitelistedAddresses = this.getWhitelistedAddresses(allEvents)
        let auctionStart = this.getAuctionStartInSeconds(allEvents)
        if (!auctionStart) {
            auctionStart = currentBlockTime
        }
        const currentPriceInWEI = state === 'Finished' ? this.getClosingPrice(allEvents).toString() : EthEventsClient.getCurrentPriceAsBigNumber(auctionStart * 1000, currentBlockTime * 1000, deploymentParams.durationInDays, deploymentParams.startPrice).toString()

        return {
            state,
            bids,
            contractAddress: this._contractAddress,
            takenSlotsCount: bids.length,
            freeSlotsCount: deploymentParams.numberOfParticipants - bids.length,
            remainingSeconds: EthEventsClient.calculateRemainingAuctionSeconds(auctionStart, currentBlockTime, deploymentParams.durationInDays),
            whitelistedAddresses: whitelistedAddresses,
            currentBlocktimeInMs: currentBlockTime * 1000,
            priceFunction: EthEventsClient.calculateAllSlotPrices(auctionStart, deploymentParams.durationInDays, deploymentParams.startPrice),
            currentPriceInWEI
        }
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

    async getAllEvents() {
        const response = await axios.post(`${this._baseUrl}/event/search/`, {
            'size': 10000,
            'query': {
                'term': {
                    'address.raw': this._contractAddress
                }
            }
        }, this._axisConfig)
        return response.data.hits.hits.map(hit => {
            return {
                args: hit._source.args,
                event: hit._source.event,
            }
        })
    }

    getClosingPrice(allEvents) {
        const filtered = allEvents.filter(e => e.event === 'AuctionEnded').map(e =>
            new BN(e.args.find(a => a.name === 'closingPrice')['value.hex'].substr(2), 16)
        )
        return filtered.length > 0 ? filtered[0] : Number.NaN
    }

    getAuctionState(allEvents) {
        const auctionStarted = allEvents.filter(e => e.event === 'AuctionStarted').length > 0
        const auctionEnded = allEvents.filter(e => e.event === 'AuctionEnded').length > 0
        const auctionFailed = allEvents.filter(e => e.event === 'AuctionFailed').length > 0
        const auctionDeployed = allEvents.filter(e => e.event === 'AuctionDeployed').length > 0
        if (auctionEnded) {
            return 'Finished'
        } else if (auctionFailed) {
            return 'Failed'
        } else if (auctionStarted) {
            return 'Started'
        } else if (auctionDeployed) {
            return 'Not Started'
        } else {
            return 'Not Deployed'
        }
    }

    getAuctionStartInSeconds(allEvents) {
        const filtered = allEvents.filter(e => e.event === 'AuctionStarted').map(e => {
            return e.args.find(a => a.name === 'startTime')['value.num']
        })
        return filtered.length > 0 ? filtered[0] : undefined
    }

    getAuctionDeploymentParameters(allEvents) {
        const filtered = allEvents.filter(e => e.event === 'AuctionDeployed').map(e => {
            return {
                startPrice: new BN(e.args.find(a => a.name === 'startPrice')['value.hex'].substr(2), 16),
                durationInDays: e.args.find(a => a.name === 'auctionDurationInDays')['value.num'],
                numberOfParticipants: e.args.find(a => a.name === 'numberOfParticipants')['value.num']
            }
        })
        return filtered.length > 0 ? filtered[0] : undefined
    }

    getBids(allEvents) {
        return allEvents.filter(e => e.event === 'BidSubmitted').map(e => {
            return {
                bidder: e.args.find(a => a.name === 'bidder')['value.hex'],
                bidValue: e.args.find(a => a.name === 'bidValue')['value.hex'],
                slotPrice: e.args.find(a => a.name === 'slotPrice')['value.hex'],
                timestamp: e.args.find(a => a.name === 'timestamp')['value.num']
            }
        }).sort((a, b) => Number.parseInt(a.timestamp) - Number.parseInt(b.timestamp))
    }

    getWhitelistedAddresses(allEvents) {
        return allEvents.filter(e => e.event === 'AddressWhitelisted').map(e => {
            return e.args.find(a => a.name === 'whitelistedAddress')['value.hex']

        })
    }

    static getCurrentPriceAsBigNumber(startInMs, nowInMs, durationInDays, startPriceWEI) {
        // See: https://github.com/trustlines-network/project/issues/394
        // and https://github.com/trustlines-protocol/auction/issues/7
        const t = new BN(nowInMs - startInMs).div(new BN(durationInDays))
        const decay = t.pow(_3).div(DECAY_FACTOR)
        return startPriceWEI.mul(_1.add(t)).div(_1.add(t).add(decay))
    }

    static calculateAllSlotPrices(startInSeconds, durationInDays, startPriceWEI, ticks = 312) {
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
