'use strict'
import logger from '../logger/system'
import md5 from 'md5-promised'
import config from '../config'
import _ from 'lodash'
import fs from 'fs-extra'
import request from 'request-promise'
import delay from 'delay'

const MAX_RETRY_TIMES = config.cloudStorage.retryTimes
const RETRY_DELAY = config.cloudStorage.retryDelay
const uploadUrl = config.cloudStorageApi.upload
const expireUrl = config.cloudStorageApi.expireUrl
const expireTime = config.cloudStorageApi.expireTime

export default class cloudService {
  /**
   * 上傳檔案,具有重試功能
   * @param  {Array} filesPath 上傳檔案路徑
   * @return {Promise}
   */
  async upload(filesPath = []) {
    let currentRetryTime = 1
    const service = this
    try {
      for (currentRetryTime; currentRetryTime <= MAX_RETRY_TIMES; currentRetryTime++) {
        const result = await service.uploadFiles(filesPath)
        if (result.isSuccess) {
          const filesId = result.response.map(res => {
            return res._id
          })
          await this.setFileExpireHR(filesId)
          return filesId
        } else {
          await delay(RETRY_DELAY)
          logger.info(`uploadFiles retry ${currentRetryTime} times, reason: ${result.reason}`)
          if (currentRetryTime === parseInt(MAX_RETRY_TIMES)) {
            throw new Error(result.reason)
          }
        }
      }
    } catch (err) {
      throw new Error(`Upload File To Cloud Storage Fail: ${err.message}`)
    }
  }

  /**
   * 設定雲端儲存檔案的過期日期
   * @param {Array} fileuuid [說明] 雲端儲存檔案的uuid
   * @return [說明] {result:true(200 成功回應)/false(失敗回應) , body: if true, response: if false}
   */
  async setFileExpireHR(fileuuid = []) {
    const options = {
      method: 'POST',
      url: expireUrl,
      body: {
        filesID: fileuuid,
        expireAfterHR: expireTime
      },
      json: true,
      resolveWithFullResponse: true
    }
    try {
      const response = await request(options)
      return { result: true, body: response.body }
    } catch (error) {
      logger.error(`Fail to set expire time on uploaded files: ${error.message}`)
    }
  }

  /**
   * [uploadFiles 上傳檔案]
   * @param  {Array} filesPath 上傳檔案路徑
   * @return {Promise}
   */
  async uploadFiles(filesPath = []) {
    let files = []
    try {
      files = await Promise.all(filesPath.map(async function (pathParse) {
        return fs.createReadStream(pathParse)
      }))
    } catch (err) {
      return { result: false, reason: 'files stream fail' }
    }
    const options = {
      method: 'POST',
      uri: uploadUrl,
      formData: {
        file: files
      },
      json: true
    }

    let uploadResponse
    try {
      uploadResponse = await request(options)
    } catch (err) {
      return { result: false, reason: `upload fail: ${err.message}` }
    }
    // --- check md5 ---

    const filePathMd5 = []
    for (const filePath of filesPath) {
      const fileMd5 = await md5(filePath)
      filePathMd5.push(fileMd5)
    }
    const uploadResponseMd5 = uploadResponse.map(res => res.md5)
    const equalMd5 = _.isEqual(filePathMd5.sort(), uploadResponseMd5.sort())
    if (!equalMd5) {
      return { isSuccess: false, reason: 'md5 check fail' }
    }

    return { isSuccess: true, response: uploadResponse }
  }
}
