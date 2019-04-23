import config from '../../lib/config'
import path from 'path'
import fs from 'fs'
import bunyan from 'bunyan'

fs.existsSync(config.path.logs) || fs.mkdirSync(config.path.logs)

const queryLogStream = fs.createWriteStream(path.join(config.path.logs, 'query.log'), { flags: 'a' })

const logger = bunyan.createLogger({
    name: 'query',
    stream: queryLogStream,
    level: bunyan.TRACE
})
logger.level(bunyan.TRACE)

export default logger
