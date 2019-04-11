FROM node:10 as builder

ENV NODE_ENV=development

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install
ENV NODE_ENV=production
COPY ./frontend ./frontend
RUN npm run build

FROM node:10

# Add Tini
ENV TINI_VERSION v0.18.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod +x /tini
ENTRYPOINT ["/tini", "--"]

ENV NODE_ENV=production
ENV BUNYAN_LOGLEVEL=30
ENV PATH_LOGS=/logs
ENV APPLICATION_NAME=api.eth.events
ENV API_SERVER_HOST=0.0.0.0
ENV FRONTEND_SERVER_HOST=0.0.0.0

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --only=production

COPY ./api ./api
COPY ./frontend ./frontend
COPY --from=builder /usr/src/app/frontend/public ./frontend/public
COPY ./lib ./lib
COPY ./model ./model
COPY ./config ./config
COPY ./migrations ./migrations
COPY ./initDatabase.js ./initDatabase.js

USER node

CMD ["node", "-r", "esm", "./api/index.js"]
