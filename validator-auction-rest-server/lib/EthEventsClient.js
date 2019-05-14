import axios from 'axios'
import mainConfig from './config'
import BN from 'bn.js'

const _3 = new BN(3)
const _1 = new BN(1)
const DECAY_FACTOR = new BN(746571428571)

const STATE_FAILED = 'Failed'
const STATE_FINISHED = 'Finished'
const STATE_NOT_DEPLOYED = 'Not Deployed'
const STATE_NOT_STARTED = 'Not Started'
const STATE_STARTED = 'Started'
const STATE_DEPOSIT_PENDING = 'Deposit Pending'

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

        if (state === STATE_NOT_DEPLOYED) {
            return {
                auctionState: state
            }
        }

        const deploymentParams = this.getAuctionDeploymentParameters(allEvents)
        const bids = this.getBids(allEvents)
        const whitelistedAddresses = this.getWhitelistedAddresses(allEvents)
        const auctionStart = this.getAuctionStartInSeconds(allEvents)

        const result = {
            state,
            bids,
            contractAddress: this._contractAddress,
            takenSlotsCount: bids.length,
            freeSlotsCount: deploymentParams.maximalNumberOfParticipants - bids.length,
            maxSlotsCount: deploymentParams.maximalNumberOfParticipants,
            minSlotsCount: deploymentParams.minimalNumberOfParticipants,
            whitelistedAddresses: whitelistedAddresses,
            currentBlocktimeInMs: currentBlockTime * 1000,
        }

        let priceFunctionCalculationStart = auctionStart
        if (state === STATE_STARTED) {
            result.currentPriceInWEI = EthEventsClient.getCurrentPriceAsBigNumber(auctionStart * 1000, currentBlockTime * 1000, deploymentParams.durationInDays, deploymentParams.startPrice).toString()
            const remainingSeconds = EthEventsClient.calculateRemainingAuctionSeconds(auctionStart, currentBlockTime, deploymentParams.durationInDays)
            // workaround for intermediate state between started and finished event
            if (remainingSeconds === 0) {
                result.state = STATE_FINISHED
                result.lowestSlotPriceInWEI = bids.length > 0 ? new BN(bids[bids.length - 1].slotPrice.substr(2), 16).toString() : undefined
            } else {
                result.remainingSeconds = remainingSeconds
            }
        } else if (state === STATE_FINISHED || state === STATE_DEPOSIT_PENDING) {
            result.lowestSlotPriceInWEI = this.getLowestSlotPrice(allEvents).toString()
        } else if (state === STATE_NOT_STARTED) {
            result.initialPriceInWEI = EthEventsClient.getCurrentPriceAsBigNumber(currentBlockTime * 1000, currentBlockTime * 1000, deploymentParams.durationInDays, deploymentParams.startPrice).toString()
            priceFunctionCalculationStart = currentBlockTime
        }
        result.priceFunction = EthEventsClient.calculateAllSlotPrices(priceFunctionCalculationStart, deploymentParams.durationInDays, deploymentParams.startPrice)

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

    getLowestSlotPrice(allEvents) {
        const filtered = allEvents.filter(e => e.event === 'AuctionEnded' || e.event === 'AuctionDepositPending').map(e =>
            new BN(e.args.find(a => a.name === 'lowestSlotPrice')['value.hex'].substr(2), 16)
        )
        return filtered.length > 0 ? filtered[0] : undefined
    }

    getAuctionState(allEvents) {
        const started = allEvents.filter(e => e.event === 'AuctionStarted').length > 0
        const ended = allEvents.filter(e => e.event === 'AuctionEnded').length > 0
        const failed = allEvents.filter(e => e.event === 'AuctionFailed').length > 0
        const deployed = allEvents.filter(e => e.event === 'AuctionDeployed').length > 0
        const depositPending = allEvents.filter(e => e.event === 'AuctionDepositPending').length > 0
        if (ended) {
            return STATE_FINISHED
        } else if (failed) {
            return STATE_FAILED
        } else if (started) {
            return STATE_STARTED
        } else if (deployed) {
            return STATE_NOT_STARTED
        } else if (depositPending) {
            return STATE_DEPOSIT_PENDING
        } else {
            return STATE_NOT_DEPLOYED
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
                maximalNumberOfParticipants: e.args.find(a => a.name === 'maximalNumberOfParticipants')['value.num'],
                minimalNumberOfParticipants: e.args.find(a => a.name === 'minimalNumberOfParticipants')['value.num']
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
