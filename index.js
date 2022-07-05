const assert = require('assert')
const path = require('path')

const inPath = (file, prefix) => file === prefix || file.startsWith(path.join(prefix, './'))

function validate(data, options) {
  // Note: data.userRequest is different and can contain loader prefixes
  assert(data.resource === data.resourceResolveData.path)
  const filePath = path.resolve(data.resource) // resolve just in case, don't remove
  const moduleName = data.resourceResolveData.descriptionFileData.name
  const modilePackage = data.resourceResolveData.descriptionFilePath

  if (options.validModules) {
    const valid = options.validModules.includes(moduleName)
    assert(valid, `[fencing] validModules: ${filePath} (${moduleName})`)
  }
  if (options.invalidModules) {
    const modulePaths = options.invalidModules.map((name) => path.join('/node_modules/', name, '/'))
    const invalid =
      options.invalidModules.includes(moduleName) ||
      modulePaths.some((modulePath) => filePath.includes(modulePath))
    assert(!invalid, `[fencing] invalidModules: ${filePath} (${moduleName})`)
  }

  if (options.validPaths) {
    const valid = options.validPaths.some((prefix) => inPath(filePath, prefix))
    assert(valid, `[fencing] validPaths: ${filePath}`)
  }
  if (options.invalidPaths) {
    const invalid = options.invalidPaths.some((prefix) => inPath(filePath, prefix))
    assert(!invalid, `[fencing] invalidPaths: ${filePath}`)
  }

  if (options.validate) {
    const valid = options.validate({ filePath, moduleName, modilePackage })
    assert(valid, `[fencing] validate: ${filePath}`)
  }
}

function commonPath(one, two) {
  const a = one.split(path.sep)
  const b = two.split(path.sep)
  const common = []
  for (let i = 0; i < a.length && i < b.length && a[i] === b[i]; i++) common.push(a[i])
  return common.join(path.sep)
}

function getTrace(request, history) {
  // Rebuild the trace metadata
  const trace = []
  let root
  const seen = new Set() // require loop prevention
  for (let curr = request; history.has(curr); curr = history.get(curr).source) {
    if (seen.has(curr)) break
    seen.add(curr)
    const entry = history.get(curr)
    trace.push(entry)
    root = root !== undefined ? commonPath(root, curr) : curr // find minimal root
  }

  const relative = (location) => {
    assert(location.startsWith(`${root}${path.sep}`))
    return root ? `.${location.slice(root.length)}` : location
  }

  // Convert to human-readable form
  const lines = []
  const { stringify } = JSON
  for (const { resource, source, query } of trace) {
    const origin = source ? ` (as ${stringify(query)} from ${stringify(relative(source))})` : ''
    lines.push(`  * ${stringify(relative(resource))}${origin}`)
  }
  lines.push(`  * in ${stringify(root)}`)
  return lines.join('\n')
}

// Webpack plugin interface
class WebpackFencePlugin {
  constructor(options = {}) {
    this.options = options
  }
  apply(compiler) {
    const history = new Map()
    compiler.plugin('normal-module-factory', (nmf) => {
      nmf.plugin('after-resolve', (data, callback) => {
        if (!history.get(data.resource)) {
          history.set(data.resource, {
            resource: data.resource,
            source: data.resourceResolveData.context.issuer,
            query: data.rawRequest,
          })
        }
        try {
          validate(data, this.options)
        } catch (err) {
          if (this.options.debug) console.error(data)
          throw new Error(`${err.message}\n${getTrace(data.resource, history)}`)
        }
        return callback(null, data)
      })
    })
  }
}

module.exports = WebpackFencePlugin
