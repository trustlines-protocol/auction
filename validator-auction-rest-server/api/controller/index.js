import getLogger from '../../lib/logger'
import config from '../../lib/config'
import express from 'express'
import { ethEventsClient } from '../index'
const logger = getLogger('controller')

const router = express.Router()

router.get(`${config.api.server.basePath}/ping/`, (req, res) => res.sendStatus(200))
router.get(`${config.api.server.basePath}/`, (req, res) => res.json({
    name: config.name,
    version: config.version
}))


router.get('/auction-summary/', async (req, res, next) => {
    try {
        const summary = await ethEventsClient.getAuctionSummary()
        return res.json(summary)
    }
    catch (err) {
        logger.error('Unexpected error:', err)
        next(err)
    }
})


export default router
