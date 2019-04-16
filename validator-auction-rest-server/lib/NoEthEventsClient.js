import EthEventsClient from './EthEventsClient'

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
            const ts = auctionStart + (i * NoEthEventsClient.randomInt(100, 1200))
            result.push({
                bidder: randomHex(20),
                bidValue: EthEventsClient.getCurrentPrice(auctionStart * 1000, ts * 1000),
                timestamp: ts
            })
        }
        return result.sort((a, b) => Number.parseInt(a.timestamp) - Number.parseInt(b.timestamp))
    }

    getWhitelistedAddresses() {
        // TODO
        return []
    }

    static randomInt(low, high) {
        return Math.floor(Math.random() * (high - low) + low)
    }
}
