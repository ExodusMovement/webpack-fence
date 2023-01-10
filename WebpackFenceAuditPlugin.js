const WebpackFencePlugin = require('./index.js')

const assert = require('assert')
const fs = require('fs')
const path = require('path')

class WebpackFenceAuditPlugin extends WebpackFencePlugin {
  #rootPath = null
  #outPath = null
  #wrapPath = null
  #seen = new Set()
  #dirs = new Set()

  constructor({ rootPath, outPath, wrapPath, ...rest }) {
    assert(Object.keys(rest).length === 0 && rootPath && outPath)
    assert(path.resolve(rootPath) === rootPath)
    const validate = ({ filePath }) => this.addFile(filePath)
    super({ rootPath, validate })
    this.#rootPath = rootPath
    this.#outPath = path.resolve(rootPath, outPath)
    this.#wrapPath = wrapPath
  }

  addFile(filePath) {
    if (this.#seen.has(filePath)) return true

    // TODO: do we want to also include `modulePackage`?
    const prefix = `${this.#rootPath}${path.sep}`
    assert(path.resolve(filePath) === filePath)
    assert(filePath.startsWith(prefix))
    
    const file = filePath.slice(prefix.length)
    let out = path.resolve(this.#outPath, file)
    if (this.#wrapPath) out = this.#wrapPath(out)

    if (out) {
      assert(path.resolve(out) === out)
      assert(out.startsWith(`${this.#outPath}${path.sep}`))
      // console.log(`[fencing audit]: Copying ${file} to ${out}`)
      const dir = path.dirname(filePath)
      if (!this.#dirs.has(dir)) {
        fs.mkdirSync(dir, { recursive: true })
        this.#dirs.add(dir)
      }
      fs.cpSync(filePath, out)
    }

    this.#seen.add(filePath)
    return true
  }
}

module.exports = WebpackFenceAuditPlugin
