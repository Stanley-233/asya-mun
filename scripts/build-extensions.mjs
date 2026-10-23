import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { readManifest } from './lib/extension-manifest.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const frontend = path.join(root, 'frontend')
const sdk = path.join(root, 'packages/extension-sdk')
const require = createRequire(path.join(frontend, 'package.json'))
const { build } = require('esbuild')
const postcss = require('postcss')
const tailwind = require('@tailwindcss/postcss')
const output = path.join(frontend, 'public/extension')
const selected = process.env.ASYA_EXTENSIONS === undefined ? null
  : new Set(process.env.ASYA_EXTENSIONS.split(',').map(id => id.trim()).filter(Boolean))

const html = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

// Only this generated asset directory is replaced; source and deployment installations are separate.
await rm(output, { recursive: true, force: true })
await mkdir(output, { recursive: true })
const seen = new Set()
for (const entry of await readdir(path.join(root, 'extension'), { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name.startsWith('.')) continue
  const directory = path.join(root, 'extension', entry.name)
  const manifest = await readManifest(directory)
  if (manifest.id !== entry.name || seen.has(manifest.id)) throw new Error(`Duplicate or mismatched extension ID: ${manifest.id}`)
  seen.add(manifest.id)
  if (selected && !selected.has(manifest.id)) continue
  const destination = path.join(output, manifest.id)
  await mkdir(destination)
  await build({
    entryPoints: [path.join(directory, 'frontend/index.tsx')],
    outfile: path.join(destination, 'app.js'),
    bundle: true, minify: true, format: 'esm', target: 'es2020', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    nodePaths: [path.join(frontend, 'node_modules')],
    plugins: [{ name: 'asya-extension-sdk', setup(builder) {
      builder.onResolve({ filter: /^@asya-mun\/extension-sdk(?:\/ui)?$/ }, args => ({
        path: path.join(sdk, args.path.endsWith('/ui') ? 'src/ui/index.ts' : 'src/index.tsx'),
      }))
      builder.onResolve({ filter: /^@\// }, () => ({ errors: [{ text: 'Extensions must use the public SDK instead of host-private @/ imports' }] }))
    } }],
  })
  let css = await readFile(path.join(sdk, 'styles.css'), 'utf8')
  css += `\n@source "${path.join(directory, 'frontend').replaceAll('\\', '/')}";\n@source "${path.join(sdk, 'src').replaceAll('\\', '/')}";\n`
  const result = await postcss([tailwind({ base: frontend, optimize: true })]).process(css, { from: path.join(frontend, 'app/globals.css') })
  await writeFile(path.join(destination, 'app.css'), result.css)
  const assets = path.join(directory, 'frontend/public')
  try { await cp(assets, destination, { recursive: true }) } catch (error) { if (error.code !== 'ENOENT') throw error }
  const entryPath = path.join(destination, manifest.frontend.entry)
  const assetPrefix = path.posix.relative(path.posix.dirname(manifest.frontend.entry), '.') || '.'
  await mkdir(path.dirname(entryPath), { recursive: true })
  await writeFile(entryPath, `<!doctype html><html lang="zh-CN" data-extension-id="${html(manifest.id)}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${html(manifest.name)}</title><link rel="stylesheet" href="${assetPrefix}/app.css"></head><body><main id="root" class="p-4"></main><script type="module" src="${assetPrefix}/app.js"></script></body></html>`)
  await writeFile(path.join(destination, 'extension.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(`Built extension ${manifest.id}@${manifest.version}`)
}
for (const id of selected ?? []) {
  if (!seen.has(id)) throw new Error(`Unknown selected extension: ${id}`)
}
