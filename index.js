const assert = require('assert')
const path = require('path')

const inPath = (file, prefix) => file === prefix || file.startsWith(path.join(prefix, './'))

function validate(data, options) {
  assert(data.resource === data.userRequest)
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

// Webpack plugin interface
class WebpackFencePlugin {
  constructor(options = {}) {
    this.options = options
  }
  apply(compiler) {
    compiler.plugin('normal-module-factory', (nmf) => {
      nmf.plugin('after-resolve', (data, callback) => {
        try {
          validate(data, this.options)
        } catch (err) {
          if (this.options.debug) console.error(data)
          throw err
        }
        return callback(null, data)
      })
    })
  }
}

module.exports = WebpackFencePlugin
