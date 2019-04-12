import EthEventsClient from './EthEventsClient'
const randomHex = require('randomhex')

export default class NoEthEventsClient extends EthEventsClient {

    constructor() {
        super()
    }

    getAuctionStart() {
        return Math.round(+new Date() / 1000)
    }

    getBidEvents() {
        const now = this.getAuctionStart()
        const result = []
        for (let i = 0; i < 100; ++i) {
            result.push({
                bidder: randomHex(20),
                bidValue: this.randomInt(50000, 2000000),
                timestamp: now - (i * this.randomInt(60, 300))
            })
        }
        return result
    }

    randomInt(low, high) {
        return Math.floor(Math.random() * (high - low) + low)
    }
}
