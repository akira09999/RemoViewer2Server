const $ = id => document.getElementById(id)

const btnFirewall    = $('btnFirewall')
const firewallStatus = $('firewallStatus')

btnFirewall.addEventListener('click', async () => {
  btnFirewall.disabled = true
  firewallStatus.textContent = '...'
  firewallStatus.style.color = '#888888'
  const result = await window.api.allowFirewall()
  btnFirewall.disabled = false
  if (result.ok) {
    firewallStatus.textContent = '✓ Done'
    firewallStatus.style.color = '#5ab05a'
  } else {
    firewallStatus.textContent = '✗ Cancelled'
    firewallStatus.style.color = '#bf3d3d'
  }
})

const statusDot   = $('statusDot')
const statusText  = $('statusText')
const clientCount = $('clientCount')
const addressEl   = $('address')
const portEl      = $('port')
const pinEl       = $('pin')
const filePathEl  = $('filePath')
const thumbSizeGroup = $('thumbSizeGroup')
const btnApplyThumb  = $('btnApplyThumb')
const btnStartStop = $('btnStartStop')
const btnGenPin    = $('btnGenPin')
const btnBrowse    = $('btnBrowse')
const btnScanFiles = $('btnScanFiles')
const rowScan  = $('rowScan')
const barScan  = $('barScan')
const cntScan  = $('cntScan')
const rowThumb = $('rowThumb')
const barThumb = $('barThumb')
const cntThumb = $('cntThumb')
const chkUpnp      = $('chkUpnp')
const upnpStatus   = $('upnpStatus')
const rowExternalIp = $('rowExternalIp')
const externalIpEl  = $('externalIp')

let isRunning = false
let savedThumbSize = 256
let selectedThumbSize = 256

function setThumbSizeUI(size) {
  selectedThumbSize = size
  thumbSizeGroup.querySelectorAll('.seg-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.size) === size)
  })
  btnApplyThumb.disabled = (selectedThumbSize === savedThumbSize)
}

thumbSizeGroup.addEventListener('click', e => {
  const btn = e.target.closest('.seg-btn')
  if (!btn) return
  setThumbSizeUI(parseInt(btn.dataset.size))
})

btnApplyThumb.addEventListener('click', async () => {
  btnApplyThumb.disabled = true
  savedThumbSize = selectedThumbSize
  await window.api.regenThumbs(selectedThumbSize)
})

function updateStatus(data) {
  isRunning = data.running
  statusDot.className  = 'status-dot' + (isRunning ? ' running' : '')
  statusText.textContent = isRunning ? 'Server Running' : 'Server Stopped'
  clientCount.textContent = isRunning ? `${data.clientCount} client(s)` : ''
  btnStartStop.textContent = isRunning ? 'Stop Server' : 'Start Server'
  btnStartStop.className   = isRunning ? 'stop' : ''
  portEl.disabled = isRunning
}

function updateUpnp({ status, externalIp }) {
  upnpStatus.className = 'upnp-status ' + (status || '')
  if (status === 'ok') {
    upnpStatus.textContent = '✓ OK'
    rowExternalIp.style.display = 'block'
    externalIpEl.value = externalIp || ''
  } else if (status === 'failed') {
    upnpStatus.textContent = '✗ Failed'
    rowExternalIp.style.display = 'none'
    externalIpEl.value = ''
  } else if (status === 'pending') {
    upnpStatus.textContent = '...'
    rowExternalIp.style.display = 'none'
    externalIpEl.value = ''
  } else {
    upnpStatus.textContent = ''
    rowExternalIp.style.display = 'none'
    externalIpEl.value = ''
  }
}

async function saveField(key, value) {
  await window.api.setConfig({ [key]: value })
}

portEl.addEventListener('change', () => {
  if (isRunning) return
  const v = parseInt(portEl.value)
  if (v >= 1024 && v <= 65535) saveField('port', v)
})

chkUpnp.addEventListener('change', () => {
  saveField('upnp', chkUpnp.checked)
  if (!chkUpnp.checked) updateUpnp({ status: 'idle', externalIp: '' })
})

btnGenPin.addEventListener('click', async () => {
  const pin = await window.api.genPin()
  pinEl.value = pin
})

btnBrowse.addEventListener('click', async () => {
  const folder = await window.api.openFolder()
  if (folder) {
    filePathEl.value = folder
    await saveField('filePath', folder)
    btnScanFiles.disabled = true
    await window.api.scanFiles()
    btnScanFiles.disabled = false
  }
})

btnStartStop.addEventListener('click', async () => {
  btnStartStop.disabled = true
  if (isRunning) {
    await window.api.stopServer()
  } else {
    const result = await window.api.startServer()
    if (result && !result.ok) {
      statusText.textContent = 'Failed to start: ' + (result.error || '')
    }
  }
  const s = await window.api.getStatus()
  updateStatus(s)
  btnStartStop.disabled = false
})

btnScanFiles.addEventListener('click', async () => {
  btnScanFiles.disabled = true
  await window.api.scanFiles()
  btnScanFiles.disabled = false
})

window.api.onStatus(data => updateStatus(data))
window.api.onUpnp(data => updateUpnp(data))

function updateProgress(row, bar, cnt, active, done, total) {
  row.style.display = active || done > 0 ? 'flex' : 'none'
  const pct = total > 0 ? Math.round(done / total * 100) : (active ? 0 : 100)
  bar.style.width = pct + '%'
  cnt.textContent = done > 0 ? `${done}` : ''
}

window.api.onScan(({ active, done, total }) => {
  updateProgress(rowScan, barScan, cntScan, active, done, total)
  btnScanFiles.disabled = active
})

window.api.onThumb(({ active, done, total }) => {
  updateProgress(rowThumb, barThumb, cntThumb, active, done, total)
})

const btnViewLog  = $('btnViewLog')
const logOverlay  = $('logOverlay')
const logList     = $('logList')
const btnCloseLog = $('btnCloseLog')
const btnClearLog = $('btnClearLog')

btnViewLog.addEventListener('click',  () => { logOverlay.style.display = 'flex' })
btnCloseLog.addEventListener('click', () => { logOverlay.style.display = 'none' })
logOverlay.addEventListener('click', e => { if (e.target === logOverlay) logOverlay.style.display = 'none' })
btnClearLog.addEventListener('click', () => { logList.innerHTML = '' })

window.api.onLog(({ type, addr, time }) => {
  const d  = new Date(time)
  const ts = d.toTimeString().slice(0, 8)
  const row = document.createElement('div')
  row.className = 'log-row ' + (type === 'connect' ? 'log-connect' : 'log-disconnect')
  row.textContent = `[${ts}] ${type === 'connect' ? '▶ Connected' : '◀ Disconnected'}  ${addr || ''}`
  logList.appendChild(row)
  logList.scrollTop = logList.scrollHeight
})

;(async () => {
  const [cfg, s] = await Promise.all([window.api.getConfig(), window.api.getStatus()])
  addressEl.value  = cfg.address  || ''
  portEl.value     = cfg.port     || 26800
  pinEl.value      = cfg.pin      || ''
  filePathEl.value = cfg.filePath || ''
  savedThumbSize   = cfg.thumbSize || 256
  setThumbSizeUI(savedThumbSize)
  chkUpnp.checked  = cfg.upnp    || false
  updateStatus(s)
})()
