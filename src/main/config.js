const path = require('path')
const fs   = require('fs')
const os   = require('os')
const { app } = require('electron')

const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json')

const DEFAULTS = {
  port:        26800,
  pin:         '',
  filePath:    '',
  thumbSize:   256,
  upnp:        false,
  windowWidth:  460,
  windowHeight: 680,
}

let _config = null

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) }
  } catch {
    return { ...DEFAULTS }
  }
}

function save(cfg) {
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8') } catch {}
}

function generatePin() {
  return String(Math.floor(1000 + Math.random() * 9000))
}

function get() {
  if (!_config) {
    _config = load()
    if (!_config.pin) {
      _config.pin = generatePin()
      save(_config)
    }
  }
  return _config
}

function set(patch) {
  _config = { ...get(), ...patch }
  save(_config)
  return _config
}

function getMyAddress() {
  const ifaces = os.networkInterfaces()
  for (const list of Object.values(ifaces)) {
    for (const iface of list) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address
    }
  }
  return '127.0.0.1'
}

module.exports = { get, set, generatePin, getMyAddress }
