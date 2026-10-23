import { lstat, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

export function validateId(id) {
  if (typeof id !== 'string' || id.length > 80 || !/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(id)
      || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(id)) {
    throw new Error(`Invalid extension ID: ${id}`)
  }
  return id
}

export function validateManifest(manifest) {
  validateId(manifest.id)
  if (manifest.schemaVersion !== 1 || manifest.hostApiVersion !== 1) {
    throw new Error('Unsupported extension schema or host API version')
  }
  if (typeof manifest.name !== 'string' || !manifest.name.trim()
      || typeof manifest.author !== 'string' || !manifest.author.trim()
      || typeof manifest.version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version)) {
    throw new Error('Extension name, author and semantic version are required')
  }
  const entry = manifest.frontend?.entry
  if (typeof entry !== 'string' || !entry.endsWith('.html') || !/^[a-zA-Z0-9_./-]+$/.test(entry)
      || entry.split('/').some(segment => !segment || segment === '.' || segment === '..')) {
    throw new Error('Frontend entry must be a relative HTML asset path')
  }
  if (manifest.backend != null) throw new Error('Backend extensions are not supported by host API v1')
  return manifest
}

export async function readManifest(directory) {
  return validateManifest(JSON.parse(await readFile(path.join(directory, 'extension.json'), 'utf8')))
}

// Packages are prebuilt directories. Links and hidden paths are never installed.
export async function validatePackage(directory) {
  const manifest = await readManifest(directory)
  async function walk(current) {
    if ((await lstat(current)).isSymbolicLink()) throw new Error('Extension packages cannot contain symbolic links')
    for (const item of await readdir(current, { withFileTypes: true })) {
      if (item.name.startsWith('.')) throw new Error(`Hidden package path: ${item.name}`)
      const fullPath = path.join(current, item.name)
      if (item.isSymbolicLink() || (!item.isDirectory() && !item.isFile())) throw new Error(`Unsupported package path: ${item.name}`)
      if (item.isDirectory()) await walk(fullPath)
    }
  }
  await walk(directory)
  if (!(await lstat(path.join(directory, manifest.frontend.entry))).isFile()) throw new Error('Missing frontend entry')
  return manifest
}
