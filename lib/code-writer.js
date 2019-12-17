/*
 * Copyright (c) 2014-2018 MKLab. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 */

/**
 * CodeWriter
 */
exports.CodeWriter = class CodeWriter {
  /**
   * @constructor
   */
  constructor(indentString) {
    /** @member {Array.<string>} lines */
    this.lines = []

    /** @member {string} indentString */
    this.indentString = indentString || '    ' // default 4 spaces

    /** @member {Array.<string>} indentations */
    this.indentations = []

    this.imports = {}
  }

  /**
   * Indent
   */
  indent() {
    this.indentations.push(this.indentString)
  }

  /**
   * Outdent
   */
  outdent() {
    this.indentations.splice(this.indentations.length - 1, 1)
  }

  import(type, pkg) {
    if (!this.imports[pkg]) {
      this.imports[pkg] = [type]
    } else if (!this.imports[pkg].includes(type)) {
      this.imports[pkg].push(type)
    }
  }

  /**
   * Write a line
   * @param {string} line
   */
  writeLine(line) {
    if (line) {
      this.lines.push(this.indentations.join('') + line)
    } else {
      this.lines.push('')
    }
  }

  /**
   * Return as all string data
   * @return {string}
   */
  getData() {
    var impStr = Object
      .keys(this.imports)
      .map(pkg => `import { ${this.imports[pkg].join(', ')} } from '${pkg}';`)
      .join('\n')
    impStr = impStr ? impStr + '\n' : impStr
    return impStr + this.lines.join('\n')
  }

}
