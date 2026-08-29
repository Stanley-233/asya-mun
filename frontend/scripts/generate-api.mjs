import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectDir = resolve(scriptDir, '..')
const tempOutputDir = resolve(projectDir, '.orval')

try {
  const isWin = process.platform === 'win32'
  const binName = isWin ? 'orval.CMD' : 'orval'
  execFileSync(resolve(projectDir, 'node_modules/.bin', binName), ['--config', './orval.config.ts'], {
    cwd: projectDir,
    stdio: 'inherit',
    shell: isWin,
  })
} finally {
  rmSync(tempOutputDir, { recursive: true, force: true })
}
