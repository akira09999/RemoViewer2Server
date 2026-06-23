import { spawn } from 'child_process'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import path from 'path'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const electronPath = require('electron')
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const proc = spawn(electronPath, ['.'], { stdio: 'inherit', env, cwd: __dirname })
proc.on('close', code => process.exit(code ?? 0))
