import { resolve } from 'path'
import packageJson from '../package.json'

require('dotenv')

const config = {
    env: process.env.NODE_ENV || 'production',

    name: process.env.APPLICATION_NAME || packageJson.name,
    version: packageJson.version,
    description: packageJson.description,

    path: {
        logs: process.env.PATH_LOGS || resolve(__dirname, '../logs')
    },

    api: {
        server: {
            host: process.env.API_SERVER_HOST || '127.0.0.1',
            port: process.env.API_SERVER_PORT || 8090,
            basePath: process.env.API_SERVER_BASEPATH || ''
        }
    },
    validatorAuction: {
        network: process.env.VALIDATOR_NETWORK,
        contractAddress: process.env.VALIDATOR_ADDRESS,
        startTimestamp: process.env.VALIDATOR_AUCTION_START_TIMESTAMP ? parseInt(process.env.VALIDATOR_AUCTION_START_TIMESTAMP) : undefined
    },
    database: {
        ethEvents: {
            host: process.env.ETH_EVENTS_URL,
            token: process.env.ETH_EVENTS_TOKEN,

            defaultSize: 10,
            maxSize: 5000
        }
    }
}

export default config
