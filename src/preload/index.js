const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  getConfig:    ()      => ipcRenderer.invoke('config:get'),
  setConfig:    patch   => ipcRenderer.invoke('config:set', patch),
  genPin:       ()      => ipcRenderer.invoke('config:genPin'),
  openFolder:   ()      => ipcRenderer.invoke('dialog:openFolder'),
  startServer:  ()      => ipcRenderer.invoke('server:start'),
  stopServer:   ()      => ipcRenderer.invoke('server:stop'),
  getStatus:    ()      => ipcRenderer.invoke('server:status'),
  scanFiles:    ()      => ipcRenderer.invoke('files:scan'),
  regenThumbs:  size   => ipcRenderer.invoke('thumbs:regen', size),
  allowFirewall: ()     => ipcRenderer.invoke('firewall:allow'),
  onStatus:     cb      => ipcRenderer.on('server:status', (_, data) => cb(data)),
  onScan:       cb      => ipcRenderer.on('server:scan',   (_, data) => cb(data)),
  onThumb:      cb      => ipcRenderer.on('server:thumb',  (_, data) => cb(data)),
  onUpnp:       cb      => ipcRenderer.on('server:upnp',   (_, data) => cb(data)),
  onLog:        cb      => ipcRenderer.on('server:log',    (_, data) => cb(data)),
})
