const fs   = require('fs')
const fsp  = require('fs').promises
const path = require('path')

const IMAGE_EXTS  = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'])
const META_FILE   = 'FilePageInfos.dat'
const SCAN_CONCURRENCY    = 16
const ZIP_ENTRY_CACHE_MAX = 30

function isImageEntry(fileName) {
  if (fileName.endsWith('/')) return false
  return IMAGE_EXTS.has(path.extname(fileName).toLowerCase())
}

function openZip(zipPath) {
  return new Promise((resolve, reject) => {
    require('yauzl').open(zipPath, { lazyEntries: true, autoClose: false }, (err, zf) => {
      if (err) reject(err); else resolve(zf)
    })
  })
}

function collectImageEntries(zf) {
  return new Promise((resolve, reject) => {
    const entries = []
    zf.readEntry()
    zf.on('entry', e => { if (isImageEntry(e.fileName)) entries.push(e); zf.readEntry() })
    zf.on('end',   () => { entries.sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { numeric: true, sensitivity: 'base' })); resolve(entries) })
    zf.on('error', reject)
  })
}

function readEntry(zf, entry) {
  return new Promise((resolve, reject) => {
    zf.openReadStream(entry, (err, stream) => {
      if (err) { reject(err); return }
      const chunks = []
      stream.on('data', c => chunks.push(c))
      stream.on('end',  () => resolve(Buffer.concat(chunks)))
      stream.on('error', reject)
    })
  })
}

const _zipEntryCache = new Map()

async function getCachedEntries(zipPath) {
  if (_zipEntryCache.has(zipPath)) {
    const cached = _zipEntryCache.get(zipPath)
    _zipEntryCache.delete(zipPath)
    _zipEntryCache.set(zipPath, cached)
    return cached
  }
  const zf      = await openZip(zipPath)
  const entries = await collectImageEntries(zf)
  zf.close()
  if (_zipEntryCache.size >= ZIP_ENTRY_CACHE_MAX) {
    _zipEntryCache.delete(_zipEntryCache.keys().next().value)
  }
  _zipEntryCache.set(zipPath, entries)
  return entries
}

let _metaCache = null
let _metaPath  = null

async function loadMeta(filePath) {
  if (_metaCache && _metaPath === filePath) return _metaCache
  try {
    const raw = await fsp.readFile(path.join(filePath, META_FILE), 'utf8')
    _metaCache = JSON.parse(raw)
    _metaPath  = filePath
    return _metaCache
  } catch {
    _metaCache = { Files: [] }
    _metaPath  = filePath
    return _metaCache
  }
}

async function saveMeta(filePath, meta) {
  await fsp.writeFile(path.join(filePath, META_FILE), JSON.stringify(meta), 'utf8')
  _metaCache = meta
  _metaPath  = filePath
}

async function countZipPages(zipPath) {
  const entries = await getCachedEntries(zipPath)
  return entries.length
}

let _scanning = false
let _scanResolvers = []
let _cachedFiles = null

function isScanning()   { return _scanning }
function getCachedFiles() { return _cachedFiles }

function waitForScan() {
  if (!_scanning) return Promise.resolve()
  return new Promise(r => _scanResolvers.push(r))
}

function _notifyScanDone() {
  const rs = _scanResolvers.splice(0)
  for (const r of rs) r()
}

async function scan(filePath, onProgress) {
  if (_scanning) throw new Error('ScanAlreadyRunning')
  if (!filePath) throw new Error('FilePathNotConfigured')
  await fsp.access(filePath)

  _scanning = true
  try {
    const meta    = await loadMeta(filePath)
    const metaMap = Object.fromEntries((meta.Files || []).map(f => [f.Name, f]))

    const entries = await fsp.readdir(filePath)
    const names = entries.filter(n => n.toLowerCase().endsWith('.zip'))

    const total      = names.length
    const result     = new Array(names.length)
    const metaUpdate = []
    let done = 0
    let nextIdx = 0

    async function worker() {
      while (true) {
        const idx = nextIdx++
        if (idx >= names.length) break
        const name     = names[idx]
        const fullPath = path.join(filePath, name)
        const stat = await fsp.stat(fullPath)

        const cached     = metaMap[name]
        let pageCount    = 0
        let thumbPageNum = cached?.ThumbPageNum ?? 0

        if (cached && cached.MtimeMs === stat.mtimeMs && cached.Size === stat.size) {
          pageCount = cached.PageCount
        } else {
          pageCount = await countZipPages(fullPath)
        }

        metaUpdate.push({ Name: name, PageCount: pageCount, ThumbPageNum: thumbPageNum, MtimeMs: stat.mtimeMs, Size: stat.size })
        result[idx] = { Name: name, Date: stat.mtimeMs, Size: stat.size, PageCount: pageCount }
        done++
        if (onProgress) onProgress(done, total)
      }
    }

    await Promise.all(Array.from({ length: Math.min(SCAN_CONCURRENCY, names.length) }, worker))

    await saveMeta(filePath, { Files: metaUpdate })
    _cachedFiles = result.filter(Boolean)
    return _cachedFiles
  } finally {
    _scanning = false
    _notifyScanDone()
  }
}

async function readZipPage(zipPath, pageIndex) {
  const entries = await getCachedEntries(zipPath)
  const entry   = entries[pageIndex]
  if (!entry) throw new Error('PageNotFound')
  const zf   = await openZip(zipPath)
  const data = await readEntry(zf, entry)
  zf.close()
  return { data, fileName: entry.fileName }
}

async function readZipPages(zipPath, pageIndices) {
  const entries = await getCachedEntries(zipPath)
  const zf      = await openZip(zipPath)
  try {
    const results = await Promise.all(pageIndices.map(async pageIndex => {
      const entry = entries[pageIndex]
      if (!entry) return null
      const data = await readEntry(zf, entry)
      return { pageIndex, data, fileName: entry.fileName }
    }))
    return results.filter(Boolean)
  } finally {
    zf.close()
  }
}

module.exports = { scan, readZipPage, readZipPages, loadMeta, saveMeta, isScanning, waitForScan, getCachedFiles }
