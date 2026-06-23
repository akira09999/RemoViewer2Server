const $ = id => document.getElementById(id)

const statusDot   = $('statusDot')
const statusText  = $('statusText')
const clientCount = $('clientCount')
const addressEl   = $('address')
const portEl      = $('port')
const pinEl       = $('pin')
const filePathEl  = $('filePath')
const thumbSizeEl = $('thumbSize')
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

function updateStatus(data) {
  isRunning = data.running
  statusDot.className  = 'status-dot' + (isRunning ? ' running' : '')
  statusText.textContent = isRunning ? 'Server Running' : 'Server Stopped'
  clientCount.textContent = isRunning ? `${data.clientCount} client(s)` : ''
  btnStartStop.textContent = isRunning ? 'Stop Server' : 'Start Server'
  btnStartStop.className   = isRunning ? 'stop' : ''
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
  const v = parseInt(portEl.value)
  if (v >= 1024 && v <= 65535) saveField('port', v)
})

thumbSizeEl.addEventListener('change', () => {
  const v = parseInt(thumbSizeEl.value)
  if (v >= 64 && v <= 512) saveField('thumbSize', v)
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

;(async () => {
  const [cfg, s] = await Promise.all([window.api.getConfig(), window.api.getStatus()])
  addressEl.value   = cfg.address   || ''
  portEl.value      = cfg.port      || 26800
  pinEl.value       = cfg.pin       || ''
  filePathEl.value  = cfg.filePath  || ''
  thumbSizeEl.value = cfg.thumbSize || 256
  chkUpnp.checked   = cfg.upnp     || false
  updateStatus(s)
})()
