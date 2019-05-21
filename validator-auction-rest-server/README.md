# Validator Auction Backend

Backend server to retrieve all needed information about the running auction. 
The information is currently retrieved from the elastic cluster from [eth.events]() by filtering the `events` emitted that have the address of the validator contract.

## Configuration

There are some env variables to configure the retrieval of the events:

```
VALIDATOR_ADDRESS=0x06012c8cf97BEaD5deAe237070F9587f8E7A266d
```
Set here the address of the deployed validator auction contract. The server will then look for events that have the configured address set.

*Note: The contract address is set to the CryptoKitty set as an example.*

```
VALIDATOR_NETWORK=ethereum/ethereum/mainnet
```
The configured string will be used as an URL-part in the rest calls against the eth.events cluster.
The format of the string is `$technology/$blockchain/$network`. Examples of other possible network combinations are listed here: [https://account.eth.events/status]().

```
ETH_EVENTS_URL=https://api.eth.events
```
If the variable is not set, random example data is returned.

```
ETH_EVENTS_TOKEN=1d59aa2e-2036-46fd-b54e-f568db07dea1
```
The eth.events access token used to send the requests.

```
VALIDATOR_AUCTION_START_TIMESTAMP=1561107511
```
The planned auction start in epoch seconds, if not set - the current block-time is used. This start date is
only used in case the auction hasn't started yet.

*Note: The token listed above is just an example and won't work.* 

## Usage without docker
Preconditions:
* node >= v8.15.0

```
# production mode:
npm run start
# development mode (more verbose logging):
npm run dev
```

## Usage with docker
Preconditions:
* docker

### Build image
```
docker build -t validator-backend .
```

### Run testmode
``` 
docker run -p 8090:8090 \
           -v $(pwd)/logs/:/logs \
           -e VALIDATOR_NETWORK="ethereum/ethereum/mainnet" \
           -e VALIDATOR_ADDRESS=0x06012c8cf97BEaD5deAe237070F9587f8E7A266d \
           validator-backend
```

### Run production mode
```
docker run -p 8090:8090 \
           -v $(pwd)/logs/:/logs \
           -e VALIDATOR_NETWORK="ethereum/ethereum/mainnet" \
           -e VALIDATOR_ADDRESS=0x06012c8cf97BEaD5deAe237070F9587f8E7A266d \
           -e ETH_EVENTS_URL="https://api.eth.events" \
           -e ETH_EVENTS_TOKEN="717b928b-94bc-4e2b-bdbf-96bf2f8981c7" \
           validator-backend
```

## Logging

Access-Logs will be put in `./logs`
