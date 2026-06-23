const fs   = require('fs')
const path = require('path')

exports.default = async function(context) {
  const dir = context.appOutDir
  const files = []
  for (const file of files) {
    const p = path.join(dir, file)
    if (fs.existsSync(p)) fs.rmSync(p, { force: true })
  }
}
