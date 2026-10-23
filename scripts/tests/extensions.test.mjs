import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile, lstat, symlink } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { manageExtension } from '../manage-extensions.mjs'
import { validateId, validateManifest, validatePackage } from '../lib/extension-manifest.mjs'

const manifest = {
  schemaVersion: 1, hostApiVersion: 1, id: 'example.tool', name: 'Test tool', author: 'Example', version: '1.0.0',
  frontend: { entry: 'index.html' },
}

test('reject unsafe IDs, incompatible packages and escaping asset entries', () => {
  for (const id of ['../tool', 'a/b', 'a\\b', 'a..b', 'a.', 'CON', 'con.tool', 'a'.repeat(81)]) assert.throws(() => validateId(id))
  for (const entry of ['../index.html', '/index.html', 'a/../../index.html', 'a\\index.html', 'https://example.org/index.html']) {
    assert.throws(() => validateManifest({ ...manifest, frontend: { entry } }))
  }
  assert.throws(() => validateManifest({ ...manifest, hostApiVersion: 2 }))
  assert.throws(() => validateManifest({ ...manifest, backend: { entry: 'plugin.dll' } }))
})

test('install, disable, enable and uninstall a prebuilt external package without touching source or stored data', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'asya-extension-'))
  try {
    const source = path.join(temporary, 'external-repo-release')
    const target = path.join(temporary, 'deployment')
    await mkdir(source)
    await writeFile(path.join(source, 'extension.json'), JSON.stringify(manifest))
    await writeFile(path.join(source, 'index.html'), '<h1>External plugin</h1>')
    await manageExtension('install', source, target)
    assert.equal(await readFile(path.join(target, manifest.id, 'index.html'), 'utf8'), '<h1>External plugin</h1>')
    await assert.rejects(manageExtension('install', source, target), /already installed/)
    await manageExtension('disable', manifest.id, target)
    assert.deepEqual(JSON.parse(await readFile(path.join(target, '.settings.json'), 'utf8')).disabled, [manifest.id])
    await manageExtension('enable', manifest.id, target)
    assert.deepEqual(JSON.parse(await readFile(path.join(target, '.settings.json'), 'utf8')).disabled, [])
    await writeFile(path.join(target, 'persistent-data.json'), 'retained')
    await manageExtension('uninstall', manifest.id, target)
    assert.deepEqual(JSON.parse(await readFile(path.join(target, '.settings.json'), 'utf8')).disabled, [manifest.id])
    await assert.rejects(lstat(path.join(target, manifest.id)), { code: 'ENOENT' })
    assert.equal(await readFile(path.join(target, 'persistent-data.json'), 'utf8'), 'retained')
    assert.equal(await readFile(path.join(source, 'index.html'), 'utf8'), '<h1>External plugin</h1>')
    await assert.rejects(manageExtension('uninstall', '../external-repo-release', target), /Invalid extension ID/)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})

test('do not install packages with missing entry files or directory links', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'asya-extension-invalid-'))
  try {
    const source = path.join(temporary, 'package')
    const outside = path.join(temporary, 'outside')
    await mkdir(source)
    await mkdir(outside)
    await writeFile(path.join(source, 'extension.json'), JSON.stringify(manifest))
    await assert.rejects(validatePackage(source), { code: 'ENOENT' })
    await writeFile(path.join(source, 'index.html'), '<main></main>')
    await symlink(outside, path.join(source, 'linked'), process.platform === 'win32' ? 'junction' : 'dir')
    await assert.rejects(validatePackage(source), /symbolic links|Unsupported package path/)
  } finally { await rm(temporary, { recursive: true, force: true }) }
})
