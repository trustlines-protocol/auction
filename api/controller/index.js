// import getLogger from '../../lib/logger'
import config from '../../lib/config'
import express from 'express'
import { web3Client } from '../index'
// const logger = getLogger('controller')

const router = express.Router()

router.get(`${config.api.server.basePath}/ping/`, (req, res) => res.sendStatus(200))
router.get(`${config.api.server.basePath}/`, (req, res) => res.json({
    name: config.name,
    version: config.version,
    tagline: config.tagline
}))


router.get('/auction-info/', async (req, res, next) => {
    try {
        const ownerResult = await web3Client.getOwner()
        return res.json(ownerResult)
    }
    catch (err) {
        next(err)
    }
})


export default router
