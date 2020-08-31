FROM harbor.belstardoc.com/base/puppeteer:5.2.1-ubuntu-build-essential AS builder
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
WORKDIR /home/node/app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build

###############################################################################
FROM harbor.belstardoc.com/base/puppeteer:5.2.1-ubuntu-build-essential
ENV NODE_ENV production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
WORKDIR /home/node/app

COPY package.json package-lock.json ./
RUN npm install \
    && npm cache clean --force

COPY --from=builder /home/node/app/dist ./dist
COPY .env ./
RUN mkdir -p src/controllers
COPY src/controllers/ src/controllers/

RUN mkdir -p logs storage output

# Need use node as root. npm does not send signal to child process!
CMD ["node", "dist/index.bundle.js"]
