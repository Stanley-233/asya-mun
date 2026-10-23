import { cp, lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { validateId, validatePackage } from './lib/extension-manifest.mjs'

async function exists(file) {
  try { await lstat(file); return true } catch (error) { if (error.code === 'ENOENT') return false; throw error }
}

export async function manageExtension(command, argument, target) {
  if (!['install', 'uninstall', 'enable', 'disable'].includes(command) || !argument || !target) {
    throw new Error('Usage: node scripts/manage-extensions.mjs <install directory|uninstall id|enable id|disable id> --target <deployment-extension-directory>')
  }
  const root = path.resolve(target)
  await mkdir(root, { recursive: true })
  if ((await lstat(root)).isSymbolicLink()) throw new Error('Extension target cannot be a symbolic link')
  const settingsPath = path.join(root, '.settings.json')
  let settings = { disabled: [] }
  if (await exists(settingsPath)) {
    settings = JSON.parse(await readFile(settingsPath, 'utf8'))
    if (!Array.isArray(settings.disabled) || settings.disabled.some(id => typeof id !== 'string')) throw new Error('Invalid extension settings')
  }
  const id = command === 'install' ? (await validatePackage(path.resolve(argument))).id : validateId(argument)
  const destination = path.join(root, id)
  if (path.dirname(destination) !== root) throw new Error('Extension path escapes target')
  if (await exists(destination) && (await lstat(destination)).isSymbolicLink()) throw new Error('Installed extension cannot be a symbolic link')
  if (command === 'install') {
    if (await exists(destination)) throw new Error(`${id} is already installed; uninstall it before installing another version`)
    const source = path.resolve(argument)
    if (source === root || root.startsWith(source + path.sep)) throw new Error('Installation target cannot be inside the package')
    const staging = path.join(root, `.install-${randomUUID()}`)
    try {
      await cp(source, staging, { recursive: true, errorOnExist: true, force: false })
      await validatePackage(staging)
      await rename(staging, destination)
    } finally {
      await rm(staging, { recursive: true, force: true })
    }
    // Reinstallation preserves an explicit disabled state and all browser-owned data.
    return id
  }
  if (!await exists(destination)) throw new Error(`${id} is not installed`)
  if (command === 'uninstall') await rm(destination, { recursive: true })
  const disabled = new Set(settings.disabled)
  if (command === 'disable' || command === 'uninstall') disabled.add(id)
  else disabled.delete(id)
  settings.disabled = [...disabled].sort()
  const temporary = path.join(root, `.settings-${randomUUID()}.json`)
  await writeFile(temporary, JSON.stringify(settings, null, 2) + '\n')
  await rename(temporary, settingsPath)
  return id
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [command, argument, flag, target] = process.argv.slice(2)
  try {
    if (flag !== '--target') throw new Error('An explicit --target deployment directory is required')
    console.log(`${command}: ${await manageExtension(command, argument, target)}`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
