import config from './config'
import path from 'path'
import fs from 'fs'
import morgan from 'morgan'

fs.existsSync(config.path.logs) || fs.mkdirSync(config.path.logs)

const accessLogStream = fs.createWriteStream(path.join(config.path.logs, 'access.log'), { flags: 'a' })

const morganLogger = morgan(
    // Log format combined with response time
    ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" ":response-time ms"',
    { stream: accessLogStream })

export default morganLogger
