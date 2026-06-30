const path   = require('path')
const crypto = require('crypto')
const config      = require('./config')
const { scan, readZipPage, readZipPages, loadMeta, saveMeta, getCachedFiles } = require('./fileManager')
const { getThumb, regenThumb } = require('./thumbManager')

const VERSION        = '101'
const THUMB_PARALLEL = 8
const PAGE_PARALLEL  = 8

function validateFile(base, name) {
  if (!name || typeof name !== 'string') throw new Error('Invalid file')
  const resolved = path.resolve(base, name)
  const safeBase = path.resolve(base) + path.sep
  if (!resolved.startsWith(safeBase)) throw new Error('Invalid file path')
  return resolved
}

const sessions = new Map()

function genSessionId() { return crypto.randomBytes(16).toString('hex') }
function checkSession(id) { return sessions.has(id) }

let _sharp = null
function getSharp() {
  if (!_sharp) _sharp = require('sharp')
  return _sharp
}

async function processImage(data, fileName, reqW, reqH, quality) {
  const ext    = path.extname(fileName).toLowerCase()
  const isJpeg = ext === '.jpg' || ext === '.jpeg'

  const sharp = getSharp()
  if (reqW > 0 && reqH > 0) {
    const meta = await sharp(data).metadata()
    if ((meta.width || 0) <= reqW && (meta.height || 0) <= reqH) {
      return isJpeg ? data : sharp(data).jpeg({ quality }).toBuffer()
    }
    return sharp(data).resize(reqW, reqH, { fit: 'inside' }).jpeg({ quality }).toBuffer()
  }
  return isJpeg ? data : sharp(data).jpeg({ quality }).toBuffer()
}

async function concurrencyPool(items, limit, fn) {
  const results = new Array(items.length)
  let   nextIdx = 0

  async function worker() {
    while (true) {
      const idx = nextIdx++
      if (idx >= items.length) break
      results[idx] = await fn(items[idx], idx)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

async function handle(json) {
  const cfg = config.get()

  switch (json.PID) {

    case 'Login': {
      if (json.Version !== VERSION) return { ResCode: 8, ResMsg: 'InvalidVersion' }
      if (String(json.Pin) !== String(cfg.pin)) return { ResCode: 2, ResMsg: 'InvalidPin' }
      const sessionId = genSessionId()
      sessions.set(sessionId, { createdAt: Date.now() })
      return { ResCode: 0, ResMsg: 'Success', SessionID: sessionId }
    }

    case 'GetFiles': {
      if (!checkSession(json.SessionID)) return { ResCode: 2, ResMsg: 'Error' }
      const files = getCachedFiles() ?? await scan(cfg.filePath)
      return { ResCode: 0, Files: files }
    }

    case 'GetThumbs': {
      if (!checkSession(json.SessionID)) return { ResCode: 2, ResMsg: 'Error' }
      const files   = json.Files || []
      const meta    = await loadMeta(cfg.filePath)
      const metaMap = Object.fromEntries((meta.Files || []).map(f => [f.Name, f]))

      const thumbs = await concurrencyPool(files, THUMB_PARALLEL, async (fileName) => {
        const pageNum = metaMap[fileName]?.ThumbPageNum ?? 0
        const data    = await getThumb(cfg.filePath, fileName, pageNum, cfg.thumbSize)
        return { File: fileName, Image: data.toString('base64') }
      })

      return { ResCode: 0, Thumbs: thumbs }
    }

    case 'GetPage': {
      if (!checkSession(json.SessionID)) return { ResCode: 2, ResMsg: 'Error' }
      if (!Number.isInteger(json.Page) || json.Page < 0) return { ResCode: 3, ResMsg: 'InvalidPage' }
      const zipPath = validateFile(cfg.filePath, json.File)
      const { data, fileName } = await readZipPage(zipPath, json.Page)
      const outData = await processImage(data, fileName, json.Width || 0, json.Height || 0, 85)
      return { ResCode: 0, Name: path.basename(fileName), Size: outData.length, Image: outData.toString('base64') }
    }

    case 'GetPages': {
      if (!checkSession(json.SessionID)) return { ResCode: 2, ResMsg: 'Error' }
      const pages = (json.Pages || []).filter(p => Number.isInteger(p.Page) && p.Page >= 0)
      const reqW  = json.Width  || 0
      const reqH  = json.Height || 0

      const byFile = new Map()
      for (const p of pages) {
        if (!byFile.has(p.File)) byFile.set(p.File, [])
        byFile.get(p.File).push(p.Page)
      }

      const allRead = await concurrencyPool([...byFile.entries()], PAGE_PARALLEL, async ([file, indices]) => {
        const zipPath = validateFile(cfg.filePath, file)
        return await readZipPages(zipPath, indices).then(results =>
          results.map(r => ({ file, ...r }))
        )
      })

      const flat = allRead.flat()
      const processed = await concurrencyPool(flat, PAGE_PARALLEL, async ({ file, pageIndex, data, fileName }) => {
        const outData = await processImage(data, fileName, reqW, reqH, 85)
        return { File: file, Page: pageIndex, Image: outData.toString('base64') }
      })

      return { ResCode: 0, Pages: processed }
    }

    case 'RegenThumb': {
      if (!checkSession(json.SessionID)) return { ResCode: 2, ResMsg: 'Error' }
      validateFile(cfg.filePath, json.File)
      const pageNum = json.Page ?? 0
      const meta    = await loadMeta(cfg.filePath)
      const fileInfo = (meta.Files || []).find(f => f.Name === json.File)
      if (fileInfo) { fileInfo.ThumbPageNum = pageNum; await saveMeta(cfg.filePath, meta) }
      await regenThumb(cfg.filePath, json.File, pageNum, cfg.thumbSize)
      return { ResCode: 0 }
    }

    default:
      return { ResCode: 3, ResMsg: 'NotProc' }
  }
}

setInterval(() => {
  const expiry = 24 * 60 * 60 * 1000
  const now    = Date.now()
  for (const [id, s] of sessions) {
    if (now - s.createdAt > expiry) sessions.delete(id)
  }
}, 60 * 60 * 1000)

module.exports = { handle }
