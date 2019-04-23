import bunyan from 'bunyan'
import packageJson from '../package.json'

let logger

export function setLogger(loggerInstance) {
    logger = loggerInstance
}

export default function getLogger(name) {
    if (!logger) {
        logger = bunyan.createLogger({ name: packageJson.name })
        logger.level(process.env.BUNYAN_LOGLEVEL ? parseInt(process.env.BUNYAN_LOGLEVEL) : bunyan.INFO)
    }

    if (name && logger.child) {
        return logger.child({ class: name })
    }

    return logger
}
