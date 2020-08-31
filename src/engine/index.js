'use strict'
import config from '../config'
import puppeteer from '../services/puppeteer'
import CloudServices from '../services/cloudService'
import fs from 'fs-extra'
import { v4 as uuidv4 } from 'uuid'
import logger from '../logger/system'

const outputFolder = config.folder.outputFolder

export default {
  startRender: async (renderParam) => {
    const cloudServices = new CloudServices()
    const fileName = uuidv4()
    const isConsoleOutput = renderParam.tocConsoleOutput
    try {
      const options = {
        isConsoleOutput,
        paperSize: renderParam.paperSize
      }
      await puppeteer.startRenderPdf(renderParam.url, fileName, options)
    } catch (err) {
      const error = new Error(err.message)
      error.code = 'RenderError'
      throw error
    }

    const uploadFile = []
    uploadFile.push(`${outputFolder}/${fileName}.pdf`)

    if (isConsoleOutput) {
      if (fs.existsSync(`${outputFolder}/${fileName}.json`)) {
        uploadFile.push(`${outputFolder}/${fileName}.json`)
      } else {
        const error = new Error('Cannot find tocConsoleOutput output, file is not exist!')
        error.code = 'RenderError'
        throw error
      }
    }

    let uploadedFilesId
    try {
      uploadedFilesId = await cloudServices.upload(uploadFile)
    } catch (err) {
      const error = new Error(`Upload Fail: ${err.message}`)
      error.code = 'UploadError'
      throw error
    } finally {
      for (const fileName of uploadFile) {
        try {
          fs.unlinkSync(fileName)
        } catch {
          logger.warn(`Fail to remove ${outputFolder}/${fileName}`)
        }
      }
    }

    const result = {
      resultMainFile: uploadedFilesId[0],
      resultSubFiles: isConsoleOutput ? uploadedFilesId[1] : undefined
    }

    return result
  }
}
