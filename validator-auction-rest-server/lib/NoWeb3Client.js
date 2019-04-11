import Web3Client from './Web3Client';

export default class NoWeb3Client extends Web3Client {

    constructor(props) {
        super(props);

    }

    init() {
        /* noop */
    }

    async shutdownAsync() {
        return super.shutdownAsync()
    }

    async getBidders() {
        return ['0x32Be343B94f860124dC4fEe278FDCBD38C102D88', '0xA37e6B46fa8E1A6F1Ddbf035c4E0230b8414Ff04']
    }
}
