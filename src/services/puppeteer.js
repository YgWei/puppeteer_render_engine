'use strict'
import config from '../config'
import puppeteer from 'puppeteer'
import logger from '../logger/system'
import fs from 'fs-extra'

export default {
  startRenderPdf: async (url, outputFileName, options) => {
    let browser
    try {
      browser = await puppeteer.launch({ executablePath: `${config.chrome.path}`, pipe: true, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] })
      const page = await browser.newPage()
      page.setDefaultNavigationTimeout(0)

      // whether need writing console message to file
      if (options.isConsoleOutput) {
        page.on('console', async message => {
          switch (message.type()) {
            // case 'error':
            //   for (let i = 0; i < message.args().length; ++i) {
            //     try {
            //       const json = await message.args()[i].jsonValue()
            //       if (json.response) {
            //         logger.error(`Request url: ${json.response.config.url} get error response code: ${json.response.status}. Error body: ${json.response.data}`)
            //       }
            //     } catch (err) {
            //       logger.error(err.message)
            //     }
            //   }
            //   break
            case 'log':
              for (let i = 0; i < message.args().length; ++i) {
                try {
                  const json = await message.args()[i].jsonValue()
                  if (Array.isArray(json)) {
                    fs.writeFileSync(`${config.folder.outputFolder}/${outputFileName}.json`, JSON.stringify(json))
                  }
                } catch (err) {
                  logger.error(err.message)
                }
              }
              break
          }
        })
      }

      const res = await page.goto(`${url}`, { waitUntil: 'networkidle0' })
      if (res.status() === 200) {
        const paperSize = options.paperSize ? options.paperSize : 'A4'
        await page.pdf({ path: `${config.folder.outputFolder}/${outputFileName}.pdf`, format: paperSize, printBackground: true })
        return
      } else {
        throw new Error('get html error, res._status = ', res._status)
      }
    } catch (err) {
      throw new Error(`[ Render ]: Render Fail: ${err.message}`)
    } finally {
      await browser.close()
    }
  }
}
