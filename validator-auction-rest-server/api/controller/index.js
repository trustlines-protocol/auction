// import getLogger from '../../lib/logger'
import config from '../../lib/config'
import express from 'express'
import { web3Client } from '../index'
// const logger = getLogger('controller')

const router = express.Router()

router.get(`${config.api.server.basePath}/ping/`, (req, res) => res.sendStatus(200))
router.get(`${config.api.server.basePath}/`, (req, res) => res.json({
    name: config.name,
    version: config.version
}))


router.get('/auction-info/', async (req, res, next) => {
    try {
        const bidders = await web3Client.getBidders()
        return res.json({
            bidders
        })
    }
    catch (err) {
        next(err)
    }
})


export default router
