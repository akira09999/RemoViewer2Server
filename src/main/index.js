const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog } = require('electron')
const path = require('path')
const config      = require('./config')
const tcpServer   = require('./tcpServer')
const upnpManager = require('./upnpManager')

let mainWindow = null
let tray       = null

function createWindow() {
  const cfg = config.get()
  mainWindow = new BrowserWindow({
    width:     cfg.windowWidth,
    height:    cfg.windowHeight,
    minWidth:  400,
    minHeight: 600,
    resizable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'RemoViewer2 Server',
  })
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  Menu.setApplicationMenu(null)

  let resizeTimer = null
  mainWindow.on('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return
      const [w, h] = mainWindow.getSize()
      config.set({ windowWidth: w, windowHeight: h })
    }, 500)
  })

  mainWindow.on('close', e => { e.preventDefault(); mainWindow.hide() })
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: '설정 열기', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: '종료', click: () => {
      mainWindow?.removeAllListeners('close')
      tcpServer.stop().then(() => app.quit())
    }},
  ])
}

function createTray() {
  let icon
  try { icon = nativeImage.createFromPath(path.join(__dirname, '../../assets/icon.ico')) }
  catch { icon = nativeImage.createEmpty() }

  tray = new Tray(icon)
  tray.setToolTip('RemoViewer2 Server')
  tray.setContextMenu(buildTrayMenu())
  tray.on('double-click', () => mainWindow?.show())
}

function notifyStatus() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('server:status', {
      running:     tcpServer.isRunning,
      clientCount: tcpServer.clientCount,
    })
  }
}

tcpServer.onStatus = () => notifyStatus()

async function pregenerateThumbsInBackground(cfg) {
  const { loadMeta }               = require('./fileManager')
  const { generateThumb, thumbExists } = require('./thumbManager')
  const meta  = await loadMeta(cfg.filePath)
  const files = meta.Files || []
  const total = files.length
  const CONCURRENCY = 4
  let done = 0

  notify('server:thumb', { active: true, done: 0, total })

  for (let i = 0; i < files.length; i += CONCURRENCY) {
    if (!tcpServer.isRunning) break
    await Promise.all(
      files.slice(i, i + CONCURRENCY).map(async f => {
        try {
          if (!await thumbExists(cfg.filePath, f.Name))
            await generateThumb(cfg.filePath, f.Name, f.ThumbPageNum ?? 0, cfg.thumbSize)
        } catch {}
        done++
        notify('server:thumb', { active: true, done, total })
      })
    )
  }

  notify('server:thumb', { active: false, done, total })
}

function notify(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, data)
}

async function startUpnp(cfg) {
  if (!cfg.upnp) return
  notify('server:upnp', { status: 'pending', externalIp: '' })
  try {
    await upnpManager.mapPort(cfg.port)
    const externalIp = await upnpManager.getExternalIp()
    notify('server:upnp', { status: 'ok', externalIp })
  } catch {
    notify('server:upnp', { status: 'failed', externalIp: '' })
  }
}

async function stopUpnp() {
  await upnpManager.unmapPort().catch(() => {})
  upnpManager.close()
}

async function startServerWithScan(cfg) {
  const { scan } = require('./fileManager')
  if (tcpServer.isRunning) await tcpServer.stop()
  notify('server:scan', { active: true, done: 0, total: 0 })
  const files = await scan(cfg.filePath, (done, total) => {
    notify('server:scan', { active: true, done, total })
  }).catch(() => [])
  notify('server:scan', { active: false, done: files.length, total: files.length })
  await tcpServer.start(cfg.port)
  pregenerateThumbsInBackground(cfg)
  startUpnp(cfg)
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
}

app.on('second-instance', () => {
  mainWindow?.show()
})

app.whenReady().then(() => {
  createWindow()
  createTray()
  setTimeout(() => {
    const cfg = config.get()
    if (cfg.filePath) {
      startServerWithScan(cfg).catch(e => console.error('서버 시작 실패:', e.message))
    }
  }, 1000)
})

app.on('window-all-closed', () => {})

ipcMain.handle('config:get', () => ({ ...config.get(), address: config.getMyAddress() }))

ipcMain.handle('config:set', (_, patch) => config.set(patch))

ipcMain.handle('config:genPin', () => {
  const pin = config.generatePin()
  config.set({ pin })
  return pin
})

ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '파일 경로 선택',
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('server:start', async () => {
  try {
    const cfg = config.get()
    if (tcpServer.isRunning) await tcpServer.stop()
    await startServerWithScan(cfg)
    return { ok: true }
  } catch (e) { return { ok: false, error: e.message } }
})

ipcMain.handle('server:stop', async () => {
  await tcpServer.stop()
  await stopUpnp()
  notify('server:upnp', { status: 'idle', externalIp: '' })
  return { ok: true }
})

ipcMain.handle('server:status', () => ({
  running:     tcpServer.isRunning,
  clientCount: tcpServer.clientCount,
}))

ipcMain.handle('files:scan', async () => {
  try {
    const { scan, waitForScan, isScanning, loadMeta } = require('./fileManager')
    const cfg = config.get()
    if (isScanning()) {
      await waitForScan()
      const meta = await loadMeta(cfg.filePath)
      return { ok: true, count: (meta.Files || []).length }
    }
    const wasRunning = tcpServer.isRunning
    if (wasRunning) await tcpServer.stop()
    notify('server:scan', { active: true, done: 0, total: 0 })
    const files = await scan(cfg.filePath, (done, total) => {
      notify('server:scan', { active: true, done, total })
    })
    notify('server:scan', { active: false, done: files.length, total: files.length })
    if (wasRunning) { await tcpServer.start(cfg.port); pregenerateThumbsInBackground(cfg) }
    return { ok: true, count: files.length }
  } catch (e) { return { ok: false, error: e.message } }
})
