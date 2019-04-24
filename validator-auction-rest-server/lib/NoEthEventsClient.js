import EthEventsClient from './EthEventsClient'
import BN from 'bn.js'

const randomHex = require('randomhex')

export default class NoEthEventsClient extends EthEventsClient {

    constructor() {
        super()
    }

    getAuctionStartInSeconds() {
        return Math.round(+new Date() / 1000) - 1000000
    }

    getCurrentBlockTime() {
        return new Date() / 1000
    }

    getBidEvents() {
        const auctionStart = this.getAuctionStartInSeconds()
        const result = []
        for (let i = 1; i < 100; ++i) {
            const ts = auctionStart + (i * NoEthEventsClient.randomInt(500, 5200))
            const v = EthEventsClient.getCurrentPriceAsBigNumber(auctionStart * 1000, ts * 1000).mul(new BN(NoEthEventsClient.randomFloat(1,3,2)))
            const s = EthEventsClient.getCurrentPriceAsBigNumber(auctionStart * 1000, ts * 1000).toString(16)
            result.push({
                bidder: randomHex(20),
                bidValue: v.toString(16),
                slotPrice: s,
                timestamp: ts
            })
        }
        return result.sort((a, b) => Number.parseInt(a.timestamp) - Number.parseInt(b.timestamp))
    }

    getWhitelistedAddresses() {
        return ['0xAA']
    }

    static randomInt(low, high) {
        return Math.floor(Math.random() * (high - low) + low)
    }

    static randomFloat(min, max, decimalPlaces) {
        const rand = Math.random() * (max - min) + min
        const power = Math.pow(10, decimalPlaces)
        return Math.floor(rand * power) / power
    }

}
