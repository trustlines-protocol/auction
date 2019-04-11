import net from 'net'
import Web3 from 'web3'
import AUCTIONABI from './auction-abi.json'
import getLogger from './logger'
import mainConfig from './config'

export default class Web3Client {

    constructor(config = {}) {
        this._logger = getLogger('Web3Client')

        this._config = Object.assign(
            {
                url: mainConfig.web3.url
            },
            config
        )

        if (this._config.errorHandler && typeof this._config.errorHandler === 'function') {
            this._errorHandler = this._config.errorHandler
        } else {
            this._errorHandler = err => this._logger.error(err)
        }
    }

    init() {
        if (this._client) {
            return
        }

        this._logger.debug('Initializing Web3 Client %s', this._config.url)
        this._client = new Web3(this._config.url, net)

        this._client.currentProvider.on('error', this._errorHandler)
        this._client.currentProvider.on('close', this._errorHandler)

        const connectListener = () => {
            this._client.currentProvider.removeListener('connect', connectListener)
            this._logger.trace('Web3 initialization complete')
        }
        this._client.currentProvider.on('connect', connectListener)
    }

    async shutdownAsync() {
        this._logger.debug('Shutdown Web3 Client')

        if (!this._client) {
            return Promise.resolve()
        }

        this._client.currentProvider.removeListener('error', this._errorHandler)
        this._client.currentProvider.removeListener('close', this._errorHandler)

        await new Promise(resolve => {
            try {
                this._client.eth.clearSubscriptions()
            } catch (err) {
                // ignore
            }

            // IPC
            if (this._client.currentProvider.connection.end) {
                this._client.currentProvider.once('close', () => {
                    this._client = undefined
                    this._logger.trace('Web3 shutdown complete')
                    resolve()
                })
                this._client.currentProvider.connection.end()
            }
            // WS
            else {
                this._client.currentProvider.connection.close()
                this._client = undefined
                this._logger.trace('Web3 shutdown complete')
                resolve()
            }
        })
    }

    async getOwner() {
        const contract = new this._client.eth.Contract(AUCTIONABI, '0x06012c8cf97BEaD5deAe237070F9587f8E7A266d')

        const owner = await contract.methods.name.call()

        return {owner: owner}
    }
}
