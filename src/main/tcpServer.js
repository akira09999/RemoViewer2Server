const net    = require('net')
const crypto = require('crypto')
const handler = require('./handler')
const { AES_KEY } = require('./secret')

const HEADER_SIZE = 20

const PType = { Request: 1, Response: 2, Notify: 3 }
const PCode = { Connect: 1, HeartBeat: 3, Request: 4 }

let nextTcpSessionId = 1

function calcCheckSum(buf) {
  let sum = 0
  for (let i = 0; i < buf.length; i++) sum = (sum + buf[i]) & 0xFFFF
  return sum > 32767 ? sum - 65536 : sum
}

function encrypt(data) {
  const iv     = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', AES_KEY, iv)
  return Buffer.concat([iv, cipher.update(data), cipher.final()])
}

function decrypt(data) {
  const decipher = crypto.createDecipheriv('aes-256-cbc', AES_KEY, data.slice(0, 16))
  return Buffer.concat([decipher.update(data.slice(16)), decipher.final()])
}

function readHeader(buf) {
  return {
    pid:           buf.readInt32LE(0),
    type:          buf.readUInt8(4),
    code:          buf.readUInt8(5),
    encryptKey:    buf.readInt16LE(6),
    checkSumHeader: buf.readInt16LE(8),
    checkSumData:  buf.readInt16LE(10),
    value:         buf.readInt32LE(12),
    dataSize:      buf.readInt32LE(16),
  }
}

function buildPacket(pid, type, code, value, rawData) {
  let enc = null, csData = 0, dataSize = 0, encKey = 0
  if (rawData?.length > 0) {
    enc      = encrypt(rawData)
    dataSize = enc.length
    csData   = calcCheckSum(enc)
    encKey   = 1
  }
  const hdr = Buffer.alloc(HEADER_SIZE)
  hdr.writeInt32LE(pid,      0)
  hdr.writeUInt8(type,       4)
  hdr.writeUInt8(code,       5)
  hdr.writeInt16LE(encKey,   6)
  hdr.writeInt16LE(0,        8)  // checkSumHeader placeholder
  hdr.writeInt16LE(csData,   10)
  hdr.writeInt32LE(value,    12)
  hdr.writeInt32LE(dataSize, 16)
  hdr.writeInt16LE(calcCheckSum(hdr), 8)
  return enc ? Buffer.concat([hdr, enc]) : hdr
}

class ClientSession {
  constructor(socket, tcpId) {
    this.socket       = socket
    this.tcpId        = tcpId
    this._recvChunks  = []
    this._recvLen     = 0
    this._recvTimeout = null
    this._startHeartbeat()
  }

  _startHeartbeat() {
    this._hbTimer = setInterval(() => {
      if (!this.socket.writable) return
      clearTimeout(this._hbTimeout)
      this.socket.write(buildPacket(0, PType.Notify, PCode.HeartBeat, 0, null))
      this._hbTimeout = setTimeout(() => this.socket.destroy(), 30000)
    }, 10000)
  }

  destroy() {
    clearInterval(this._hbTimer)
    clearTimeout(this._hbTimeout)
    clearTimeout(this._recvTimeout)
  }

  onData(data) {
    clearTimeout(this._recvTimeout)
    this._recvTimeout = null
    this._recvChunks.push(data)
    this._recvLen += data.length
    this._process()
  }

  _process() {
    while (this._recvLen >= HEADER_SIZE) {
      const recvBuf = Buffer.concat(this._recvChunks, this._recvLen)

      const hdr     = readHeader(recvBuf)
      const hdrCopy = Buffer.from(recvBuf.slice(0, HEADER_SIZE))
      hdrCopy.writeInt16LE(0, 8)
      if (calcCheckSum(hdrCopy) !== hdr.checkSumHeader) {
        this._recvChunks = []
        this._recvLen    = 0
        return
      }

      const total = HEADER_SIZE + hdr.dataSize
      if (this._recvLen < total) {
        this._recvChunks = [recvBuf]
        this._recvTimeout = setTimeout(() => this.socket.destroy(), 30000)
        break
      }

      const enc        = hdr.dataSize > 0 ? recvBuf.slice(HEADER_SIZE, total) : null
      const remaining  = recvBuf.slice(total)
      this._recvChunks = remaining.length > 0 ? [remaining] : []
      this._recvLen    = remaining.length
      this._handle(hdr, enc)
    }
  }

  _handle(hdr, enc) {
    if (hdr.code === PCode.HeartBeat) {
      clearTimeout(this._hbTimeout)
      this._hbTimeout = null
      return
    }

    if (hdr.code === PCode.Connect) {
      this.socket.write(buildPacket(hdr.pid, PType.Response, PCode.Connect, this.tcpId, null))
      return
    }

    if (hdr.code === PCode.Request && enc) {
      this._handleJson(hdr, enc)
    }
  }

  async _handleJson(hdr, enc) {
    try {
      const json   = JSON.parse(decrypt(enc).toString('utf8'))
      const result = await handler.handle(json)
      const res    = buildPacket(hdr.pid, PType.Response, PCode.Request, 0, Buffer.from(JSON.stringify(result), 'utf8'))
      if (this.socket.writable) this.socket.write(res)
    } catch (e) {
      const res = buildPacket(hdr.pid, PType.Response, PCode.Request, 0,
        Buffer.from(JSON.stringify({ ResCode: 2, ResMsg: e.message }), 'utf8'))
      if (this.socket.writable) this.socket.write(res)
    }
  }
}

class TcpServer {
  constructor() {
    this._server  = null
    this._clients = new Set()
    this.onStatus = null
    this.onLog    = null
  }

  start(port) {
    if (this._server?.listening) return Promise.resolve()
    return new Promise((resolve, reject) => {
      this._server = net.createServer(socket => {
        const session = new ClientSession(socket, nextTcpSessionId++)
        this._clients.add(session)
        this.onLog?.('connect', socket.remoteAddress)
        socket.on('data',  d  => session.onData(d))
        socket.on('close', () => {
          const addr = socket.remoteAddress
          session.destroy()
          this._clients.delete(session)
          this.onLog?.('disconnect', addr)
        })
        socket.on('error', () => { session.destroy(); this._clients.delete(session) })
      })
      this._server.on('error', e => { if (!this._server.listening) reject(e) })
      this._server.listen(port, '0.0.0.0', () => {
        if (this.onStatus) this.onStatus(true)
        resolve()
      })
    })
  }

  stop() {
    for (const c of this._clients) { c.destroy(); c.socket.destroy() }
    this._clients.clear()
    return new Promise(resolve => {
      if (this._server) {
        this._server.close(() => {
          this._server = null
          if (this.onStatus) this.onStatus(false)
          resolve()
        })
      } else resolve()
    })
  }

  get isRunning()    { return this._server?.listening ?? false }
  get clientCount()  { return this._clients.size }
}

module.exports = new TcpServer()
