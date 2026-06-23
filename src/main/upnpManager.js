const natUpnp = require('nat-upnp')

let _client   = null
let _mapped   = false
let _port     = 0

function getClient() {
  if (!_client) _client = natUpnp.createClient()
  return _client
}

function mapPort(port) {
  return new Promise((resolve, reject) => {
    _port = port
    getClient().portMapping({
      public:      port,
      private:     port,
      ttl:         0,
      description: 'RemoViewer2',
    }, err => {
      if (err) { reject(err); return }
      _mapped = true
      resolve()
    })
  })
}

function unmapPort() {
  return new Promise(resolve => {
    if (!_mapped || !_port) { resolve(); return }
    getClient().portUnmapping({ public: _port }, () => {
      _mapped = false
      resolve()
    })
  })
}

function getExternalIp() {
  return new Promise((resolve, reject) => {
    getClient().externalIp((err, ip) => {
      if (err) reject(err)
      else resolve(ip)
    })
  })
}

function close() {
  if (_client) { _client.close(); _client = null }
  _mapped = false
}

module.exports = { mapPort, unmapPort, getExternalIp, close }
