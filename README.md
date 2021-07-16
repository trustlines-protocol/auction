# Validator Auction Backend

Backend server to retrieve all needed information about the running auction. The
information is currently retrieved from the elastic cluster of
[eth.events](https://eth.events/) by filtering the `events` emitted that have
the address of the validator auction contract.

## Configuration

There are some environment variables to configure the retrieval of the events:

```sh
VALIDATOR_ADDRESS=0x06012c8cf97BEaD5deAe237070F9587f8E7A266d
```

Set here the address of the deployed validator auction contract. The server will
then look for events that have the configured address set.

**Note:** The contract address is set to the _CryptoKitty_ as an example.

```sh
VALIDATOR_NETWORK=ethereum/ethereum/mainnet
```

The configured string will be used as an URL-part in the REST calls against the
`eth.events` cluster. The format of the string is
`$technology/$blockchain/$network`. Examples of other possible network
combinations are listed here: https://account.eth.events/status.

```sh
ETH_EVENTS_URL=https://api.eth.events
```

If the variable is not set, random example data is returned.

```sh
ETH_EVENTS_TOKEN=1d59aa2e-2036-46fd-b54e-f568db07dea1
```

The `eth.events` access token used to send the requests.

**Note:** The token listed above is just an example and won't work.

```sh
VALIDATOR_AUCTION_START_TIMESTAMP=1561107511
```

The planned auction start in epoch seconds. If it is not set the current
block-time will be used. This start date is only used in case the auction hasn't
started yet.

It is possible to define a `.env` file in the root directory of the project. It
gets automatically loaded on start and read in the configured values. An example
file with the values of the above sections would look like that:

```sh
VALIDATOR_NETWORK="ethereum/ethereum/mainnet"
VALIDATOR_ADDRESS="0x06012c8cf97bead5deae237070f9587f8e7a266d"
ETH_EVENTS_URL="Https://api.eth.events"  # only for production mode
ETH_EVENTS_TOKEN="717b928b-94bc-4e2b-bdbf-96bf2f8981c7"  # only for production mode
```

## Usage Without Docker

The application can run in a NodeJS environment. At least version `v8.15.0` is
required. The script targets to start it will automatically load an environment
file as suggested above.

```sh
$ npm install
# production mode:
$ npm run start
# development mode (more verbose logging):
$ npm run dev
```

## Usage With Docker

First build the Docker image from the sources:

```sh
$ docker build --tag validator-backend .
```

Start a Docker container with the built image. Map the inner port `8090` to any
external port depending on your needs. The container will also read the
application its configuration from the environment file as suggested above.

```sh
$ docker run \
    --publish 8090:8090 \
    --volume $(pwd)/logs/:/logs \
    --env-file .env \
    validator-backend
```

## Logging

Access-Logs will be put into the `./logs` directory. This gets created
automatically if it does not already exist.

## Frontend

The implementation for the visual representation can be found in the [Trustlines Foundation Website](https://github.com/trustlines-protocol/www.trustlines.foundation/tree/master/src/js/auction).

## Stopping the backend

Once the auction is over, the backend for the auction website should be stopped. 
Before that, a static auction summary should be fetched and included in the frontend in replacement of the backend call.
An example commit of this is [baa5cf5](https://github.com/trustlines-protocol/www.trustlines.foundation/commit/baa5cf598d56adb00c9d71a7e18d3decabb0ae62).
