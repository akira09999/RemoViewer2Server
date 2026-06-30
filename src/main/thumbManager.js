const fsp  = require('fs').promises
const path = require('path')

const THUMB_DIR = 'RemoViewerThumb'

function thumbDir(filePath)        { return path.join(filePath, THUMB_DIR) }
function thumbPath(filePath, name) { return path.join(thumbDir(filePath), name + '.thumb') }

async function ensureThumbDir(filePath) {
  await fsp.mkdir(thumbDir(filePath), { recursive: true })
}

async function thumbExists(filePath, name) {
  try {
    await fsp.access(thumbPath(filePath, name))
    return true
  } catch (e) {
    if (e.code === 'ENOENT') return false
    throw e
  }
}

async function generateThumb(filePath, fileName, pageNum, thumbSize) {
  const sharp           = require('sharp')
  const { readZipPage } = require('./fileManager')
  const zipPath = path.join(filePath, fileName)

  const { data } = await readZipPage(zipPath, pageNum)
  const thumbData = await sharp(data)
    .resize(thumbSize, thumbSize, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 75 })
    .toBuffer()

  await ensureThumbDir(filePath)
  await fsp.writeFile(thumbPath(filePath, fileName), thumbData)
  return thumbData
}

async function getThumb(filePath, fileName, pageNum, thumbSize) {
  const tp = thumbPath(filePath, fileName)
  try {
    return await fsp.readFile(tp)
  } catch {
    return generateThumb(filePath, fileName, pageNum, thumbSize)
  }
}

async function regenThumb(filePath, fileName, pageNum, thumbSize) {
  return generateThumb(filePath, fileName, pageNum, thumbSize)
}

module.exports = { getThumb, regenThumb, generateThumb, thumbExists }
