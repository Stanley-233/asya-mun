import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectDir = resolve(scriptDir, '..')
const tempOutputDir = resolve(projectDir, '.orval')

try {
  execFileSync(resolve(projectDir, 'node_modules/.bin/orval'), ['--config', './orval.config.ts'], {
    cwd: projectDir,
    stdio: 'inherit',
  })
} finally {
  rmSync(tempOutputDir, { recursive: true, force: true })
}
