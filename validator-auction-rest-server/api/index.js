import getLogger from '../lib/logger'
import config from '../lib/config'
import express from 'express'
import helmet from 'helmet'
import compression from 'compression'
import bodyParser from 'body-parser'
import pretty from 'express-prettify'
import morgan from '../lib/morgan'
import router from './controller'
import cors from 'cors'
import EthEventsClient from '../lib/EthEventsClient';
import NoEthEventsClient from '../lib/NoEthEventsClient';

const logger = getLogger('api')

if(!config.validatorAuction.network || !config.validatorAuction.contractAddress) {
    logger.error('Environment variables VALIDATOR_NETWORK and VALIDATOR_ADDRESS must be set!')
    process.exit(-1)
}

export let ethEventsClient
if (config.database.ethEvents.host && config.database.ethEvents.host.length > 0) {
    logger.info('Using eth.events connection')
    if(!config.database.ethEvents.token) {
        logger.error('Environment variables ETH_EVENTS_TOKEN must be set!')
        process.exit(-1)
    }
    ethEventsClient = new EthEventsClient()
} else {
    logger.info('Starting in Test-Mode')
    ethEventsClient = new NoEthEventsClient()
}

// Create App
const app = express()

// Trust proxy
app.set('trust proxy', true)

// Debug Error Handler & Response Time
if ('development' === config.env) {
    // Visually handle errors
    const errorhandler = require('errorhandler')
    app.use(errorhandler())

    // Add response time header
    const responseTime = require('response-time')
    app.use(responseTime())
} else {
    // GZip Compression
    app.use(compression())

    // Helmet Hardening
    app.use(helmet())
}

// Accept all CORS requests
if ('development' === config.env) {
    app.use(cors({credentials: true, origin: true, maxAge: 3600}))
}

app.use(bodyParser.text({type: '*/*', limit: '5mb'}))

app.use((req, res, next) => {
    try {
        req.body = JSON.parse(req.body)
    } catch (err) {
        // do nothing
    }
    next()
})

// Morgan Logger
app.use(morgan)

// Pretty Print JSON
app.use(pretty({query: 'pretty'}))

// Routes
app.use(router)

app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err)
    }

    logger.error(err)
    res.sendStatus(500)
})

// Start Server
const server = app.listen(config.api.server.port, config.api.server.host, () => {
    logger.info('Server listening on %s:%d', config.api.server.host, config.api.server.port)
})

function gracefulExit(signal) {
    logger.info('Graceful exit from signal %s', signal)
    server.close()
    process.kill(process.pid, signal)
}

['SIGHUP', 'SIGINT', 'SIGTERM', 'SIGUSR2'].forEach(signal => process.once(signal, () => gracefulExit(signal)))
process.on('unhandledRejection', err => {
    logger.error({err})
    gracefulExit('SIGINT')
})
