/*
 * Copyright (c) 2014-2019 MKLab. All rights reserved.
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

const fs = require('fs')
const path = require('path')
const codegen = require('./codegen-utils')
const kebabCase = require('lodash.kebabcase');
const camelCase = require('lodash.camelcase');
const snakeCase = require('lodash.snakecase');
const pluralize = require('pluralize')

/**
 * Java Code Generator
 */
class JavaCodeGenerator {

    /**
     * @constructor
     *
     * @param {type.UMLPackage} baseModel
     * @param {string} basePath generated files and directories to be placed
     */
    constructor(baseModel, basePath) {
        /** @member {type.Model} */
        this.baseModel = baseModel

        /** @member {string} */
        this.basePath = basePath
    }

    /**
     * Return Indent String based on options
     * @param {Object} options
     * @return {string}
     */
    getIndentString(options) {
        if (options.useTab) {
            return '\t'
        } else {
            var i
            var len
            var indent = []
            for (i = 0, len = options.indentSpaces; i < len; i++) {
                indent.push(' ')
            }
            return indent.join('')
        }
    }

    /**
     * Generate codes from a given element
     * @param {type.Model} elem
     * @param {string} basePath
     * @param {Object} options
     */
    generate(elem, basePath, options) {
        var fullPath
        var codeWriter

        // Package
        if (elem instanceof type.UMLPackage) {
            fullPath = path.join(basePath, elem.name)
            fs.mkdirSync(fullPath)
            if (Array.isArray(elem.ownedElements)) {
                elem.ownedElements.forEach(child => {
                    return this.generate(child, fullPath, options)
                })
            }
            // if (elem.stereotype instanceof type.UMLClass && elem.stereotype.name === 'Module') {
            //     codeWriter = new codegen.CodeWriter(this.getIndentString(options))
            //     this.writeModule(codeWriter, elem, options)
            //     fs.writeFileSync(fullPath, codeWriter.getData())
            // }
        } else if (elem instanceof type.UMLClass) {
            // Decorator
            if (elem.stereotype === 'annotationType') {
                fullPath = path.join(basePath, elem.name + '.java')
                codeWriter = new codegen.CodeWriter(this.getIndentString(options))
                codeWriter.writeLine()
                codeWriter.writeLine('import java.util.*;')
                codeWriter.writeLine()
                this.writeAnnotationType(codeWriter, elem, options)
                fs.writeFileSync(fullPath, codeWriter.getData())
                // Entity
            } else if ((elem.stereotype instanceof type.UMLClass
                && elem.stereotype.name === 'Entity')
                || elem.stereotype === 'fields') {

                fullPath = basePath + '/' + this.getFileName(elem) + '.ts'
                codeWriter = new codegen.CodeWriter(this.getIndentString(options))
                this.writeEntity(codeWriter, elem, options)
                fs.writeFileSync(fullPath, codeWriter.getData())
                // Class
            }
            // Interface
        } else if (elem instanceof type.UMLInterface) {
            fullPath = basePath + '/' + elem.name + '.java'
            codeWriter = new codegen.CodeWriter(this.getIndentString(options))
            codeWriter.writeLine()
            codeWriter.writeLine('import java.util.*;')
            codeWriter.writeLine()
            this.writeInterface(codeWriter, elem, options)
            fs.writeFileSync(fullPath, codeWriter.getData())

            // Enum
        } else if (elem instanceof type.UMLEnumeration) {
            fullPath = basePath + '/' + elem.name + '.java'
            codeWriter = new codegen.CodeWriter(this.getIndentString(options))
            codeWriter.writeLine()
            this.writeEnum(codeWriter, elem, options)
            fs.writeFileSync(fullPath, codeWriter.getData())
        }
    }

    /**
     * Return visibility
     * @param {type.Model} elem
     * @return {string}
     */
    getVisibility(elem) {
        switch (elem.visibility) {
            case type.UMLModelElement.VK_PUBLIC:
                return 'public'
            case type.UMLModelElement.VK_PROTECTED:
                return 'protected'
            case type.UMLModelElement.VK_PRIVATE:
                return 'private'
        }
        return null
    }

    /**
     * Collect modifiers of a given element.
     * @param {type.Model} elem
     * @return {Array.<string>}
     */
    getModifiers(elem, withVisibility = true) {
        var modifiers = []

        if (withVisibility) {
            var visibility = this.getVisibility(elem)
            if (visibility) {
                modifiers.push(visibility)
            }
        }

        if (elem.isStatic === true) {
            modifiers.push('static')
        }
        if (elem.isAbstract === true) {
            modifiers.push('abstract')
        }
        if (elem.isFinalSpecialization === true || elem.isLeaf === true) {
            modifiers.push('final')
        }
        if (elem.concurrency === type.UMLBehavioralFeature.CCK_CONCURRENT) {
            modifiers.push('synchronized')
        }
        // transient
        // strictfp
        // const
        // native
        return modifiers
    }

    /**
     * Collect super classes of a given element
     * @param {type.Model} elem
     * @return {Array.<type.Model>}
     */
    getSuperClasses(elem) {
        var generalizations = app.repository.getRelationshipsOf(elem, function (rel) {
            return (rel instanceof type.UMLGeneralization && rel.source === elem)
        })
        return generalizations.map(function (gen) { return gen.target })
    }

    /**
     * Collect super interfaces of a given element
     * @param {type.Model} elem
     * @return {Array.<type.Model>}
     */
    getSuperInterfaces(elem) {
        var realizations = app.repository.getRelationshipsOf(elem, function (rel) {
            return (rel instanceof type.UMLInterfaceRealization && rel.source === elem)
        })
        return realizations.map(function (gen) { return gen.target })
    }

    getName(elem) {
        var _name = ''
        // type name
        if (elem instanceof type.UMLAssociationEnd) {
            if (elem.name.length > 0) {
                _name = elem.name
            } else if (elem.reference instanceof type.UMLModelElement
                && elem.reference.name.length > 0) {
                _name = elem.reference.name
            }
        } else {
            _name = elem.name
        }

        let isOptional = _name.endsWith('?')
        if (this.hasMultiple(elem)) {
            return camelCase(pluralize(_name)) + (isOptional ? '?' : '')
        } else {
            return camelCase(_name) + (isOptional ? '?' : '')
        }
    }

    /**
     * Return type expression
     * @param {type.Model} elem
     * @return {string}
     */
    getType(elem) {
        var _type = 'void'
        // type name
        if (elem instanceof type.UMLAssociationEnd) {
            if (elem.reference instanceof type.UMLModelElement && elem.reference.name.length > 0) {
                _type = elem.reference.name
            }
        } else {
            if (elem.type instanceof type.UMLModelElement && elem.type.name.length > 0) {
                _type = elem.type.name
            } else if ((typeof elem.type === 'string') && elem.type.length > 0) {
                _type = elem.type
            }
        }

        if (this.hasMultiple(elem)) {
            _type += '[]'
        }
        return _type
    }

    hasMultiple(elem) {
        if (elem.multiplicity) {
            if (['0..*', '1..*', '*'].includes(elem.multiplicity.trim())) {
                return true;
            } else if (elem.multiplicity !== '1' && elem.multiplicity.match(/^\d+$/)) { // number
                return true;
            }
        }
    }

    getEntityColumnOptions(elem) {
        let options = []
        if (elem.name.endsWith('?')) {
            options.push({
                key: "nullable",
                val: true
            })
        }

        if (elem.defaultValue && elem.defaultValue.length > 0) {
            let defaultValue = elem.defaultValue
            if (elem.defaultValue.toLowerCase() === 'true' || elem.defaultValue.toUpperCase() === 'false') {
                defaultValue = elem.defaultValue.toLowerCase() === 'true';
            } else if (!Number.isNaN(Number(elem.defaultValue))) {
                defaultValue = Number(elem.defaultValue);
            }
            options.push({
                key: "default",
                val: defaultValue
            })
        }
        return options;
    }

    getPackagePath(elem) {
        if (!elem || elem instanceof type.UMLModel) {
            return '.'
        }

        if (elem instanceof type.UMLPackage) {
            return this.getPackagePath(elem._parent) + '/' + elem.name
        } else {
            return this.getPackagePath(elem._parent)
        }
    }

    getFileName(elem) {
        let fileName = ''
        if (elem.stereotype instanceof type.UMLClass && elem.stereotype.name === 'Entity') {
            fileName = kebabCase(elem.name) + '.entity'
        } else if (elem.stereotype === 'fields') {
            fileName = kebabCase(elem.name.slice(0, -6)) + '.fields'
        }
        return fileName
    }

    getModulePath(from, to) {
        const fromPath = this.getPackagePath(from)
        const toPath = this.getPackagePath(to)

        if (toPath.startsWith('./node_modules')) {
            return path.relative('./node_modules', toPath)
        } else {
            let basePath = path.relative(fromPath, toPath)
            if (basePath && !basePath.startsWith('..')) {
                basePath = './' + basePath
            }

            if (!basePath) {
                basePath = '.'
            }
            return basePath + '/' + this.getFileName(to)
        }
    }

    /**
     * Write Doc
     * @param {StringWriter} codeWriter
     * @param {string} text
     * @param {Object} options
     */
    writeDoc(codeWriter, text, options) {
        var i, len, lines
        if (options.javaDoc && (typeof text === 'string')) {
            lines = text.trim().split('\n')
            codeWriter.writeLine('/**')
            for (i = 0, len = lines.length; i < len; i++) {
                codeWriter.writeLine(' * ' + lines[i])
            }
            codeWriter.writeLine(' */')
        }
    }

    /**
     * Write Package Declaration
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    writePackageDeclaration(codeWriter, elem, options) {
        var packagePath = null
        if (elem._parent) {
            packagePath = elem._parent.getPath(this.baseModel).map(function (e) { return e.name }).join('.')
        }
        if (packagePath) {
            codeWriter.writeLine('package ' + packagePath + ';')
        }
    }

    /**
     * Write Constructor
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    writeConstructor(codeWriter, elem, options) {
        if (elem.name.length > 0) {
            var terms = []
            // Doc
            this.writeDoc(codeWriter, 'Default constructor', options)
            // Visibility
            var visibility = this.getVisibility(elem)
            if (visibility) {
                terms.push(visibility)
            }
            terms.push(elem.name + '()')
            codeWriter.writeLine(terms.join(' ') + ' {')
            codeWriter.writeLine('}')
        }
    }

    /**
     * Write Member Variable
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    writeMemberVariable(codeWriter, elem, options) {
        var name = this.getName(elem)
        if (name.length > 0) {
            var terms = []
            // doc
            // this.writeDoc(codeWriter, elem.documentation, options)
            // modifiers
            var _modifiers = this.getModifiers(elem)
            if (_modifiers.length > 0) {
                terms.push(_modifiers.join(' '))
            }
            // name
            terms.push(name + ':')
            // type
            terms.push(this.getType(elem))
            // initial value
            if (elem.defaultValue && elem.defaultValue.length > 0) {
                terms.push('= ' + elem.defaultValue)
            }
            codeWriter.writeLine(terms.join(' ') + ';')
        }
    }

    /**
     * Write Member Variable
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    writeEntityColumn(codeWriter, elem, options) {
        var column
        var pkg = 'typeorm'

        if (elem.isID) {
            if (elem.isDerived) {
                column = 'PrimaryGeneratedColumn'
            } else {
                column = 'PrimaryColumn'
            }
        } else {
            if (elem.stereotype instanceof type.UMLClass && elem.stereotype.name.length > 0) {
                column = elem.stereotype.name
                pkg = this.getModulePath(elem, elem.stereotype)
            } else {
                column = 'Column'
            }
        }

        codeWriter.import(column, pkg)
        this.writeEntityColumnDecorator(codeWriter, elem, column);
        this.writeMemberVariable(codeWriter, elem, options)
    }

    writeEntityColumnDecorator(codeWriter, elem, column) {
        let options = this.getEntityColumnOptions(elem)
        if (Object.keys(options).length > 0) {
            codeWriter.writeLine(`@${column}({ ${options.map(o => o.key + ': ' + o.val).join(', ')} })`)
        } else if (elem.type instanceof type.UMLModelElement && elem.type.name.length > 0) {
            codeWriter.import(elem.type.name, this.getModulePath(elem, elem.type))
            codeWriter.writeLine(`@${column}(type => ${elem.type.name})`)
        } else {
            codeWriter.writeLine(`@${column}()`)
        }
    }

    /**
     * Write Member Variable
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    writeEntityRelation(codeWriter, from, to, options) {
        var column

        if (to) {
            if (this.hasMultiple(from)) {
                if (this.hasMultiple(to)) {
                    column = 'ManyToMany'
                } else {
                    column = 'ManyToOne'
                }
            } else {
                if (this.hasMultiple(to)) {
                    column = 'OneToMany'
                } else {
                    column = 'OneToOne'
                }
            }
            codeWriter.import(column, 'typeorm')
            let fromEntity = this.getName(from)
            let toField = this.getName(to.reference)
            toField = codegen.keywords[toField] ? '_' + toField : toField


            if (from.navigable) {
                codeWriter.writeLine(`@${column}(type => ${to.reference.name}, ${toField} => ${toField}.${fromEntity})`)
            } else {
                codeWriter.writeLine(`@${column}(type => ${to.reference.name})`)
            }


            if (from.reference !== to.reference) {
                codeWriter.import(to.reference.name,
                    this.getModulePath(from.reference, to.reference))
            }

            this.writeMemberVariable(codeWriter, to, options)
            codeWriter.writeLine()
        }
    }

    /**
     * Write Method
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     * @param {boolean} skipBody
     * @param {boolean} skipParams
     */
    writeMethod(codeWriter, elem, options, skipBody, skipParams) {
        if (elem.name.length > 0) {
            var terms = []
            var params = elem.getNonReturnParameters()
            var returnParam = elem.getReturnParameter()

            // doc
            var doc = elem.documentation.trim()

            // Erase Javadoc @param and @return
            var i
            var lines = doc.split('\n')
            doc = ''
            for (i = 0, len = lines.length; i < len; i++) {
                if (lines[i].lastIndexOf('@param', 0) !== 0 && lines[i].lastIndexOf('@return', 0) !== 0) {
                    doc += '\n' + lines[i]
                }
            }

            params.forEach(function (param) {
                doc += '\n@param ' + param.name + ' ' + param.documentation
            })
            if (returnParam) {
                doc += '\n@return ' + returnParam.documentation
            }
            this.writeDoc(codeWriter, doc, options)

            // modifiers
            var _modifiers = this.getModifiers(elem)
            if (_modifiers.length > 0) {
                terms.push(_modifiers.join(' '))
            }

            // type
            if (returnParam) {
                terms.push(this.getType(returnParam))
            } else {
                terms.push('void')
            }

            // name + parameters
            var paramTerms = []
            if (!skipParams) {
                var len
                for (i = 0, len = params.length; i < len; i++) {
                    var p = params[i]
                    var s = this.getType(p) + ' ' + p.name
                    if (p.isReadOnly === true) {
                        s = 'final ' + s
                    }
                    paramTerms.push(s)
                }
            }
            terms.push(elem.name + '(' + paramTerms.join(', ') + ')')

            // body
            if (skipBody === true || _modifiers.includes('abstract')) {
                codeWriter.writeLine(terms.join(' ') + ';')
            } else {
                codeWriter.writeLine(terms.join(' ') + ' {')
                codeWriter.indent()
                codeWriter.writeLine('// TODO implement here')

                // return statement
                if (returnParam) {
                    var returnType = this.getType(returnParam)
                    if (returnType === 'boolean') {
                        codeWriter.writeLine('return false;')
                    } else if (returnType === 'int' || returnType === 'long' || returnType === 'short' || returnType === 'byte') {
                        codeWriter.writeLine('return 0;')
                    } else if (returnType === 'float') {
                        codeWriter.writeLine('return 0.0f;')
                    } else if (returnType === 'double') {
                        codeWriter.writeLine('return 0.0d;')
                    } else if (returnType === 'char') {
                        codeWriter.writeLine('return "0";')
                    } else if (returnType === 'String') {
                        codeWriter.writeLine('return "";')
                    } else {
                        codeWriter.writeLine('return null;')
                    }
                }

                codeWriter.outdent()
                codeWriter.writeLine('}')
            }
        }
    }

    /**
     * Write Class
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    writeClass(codeWriter, elem, options) {
        var i, len
        var terms = []

        // Doc
        var doc = elem.documentation.trim()
        if (app.project.getProject().author && app.project.getProject().author.length > 0) {
            doc += '\n@author ' + app.project.getProject().author
        }
        this.writeDoc(codeWriter, doc, options)

        // Modifiers
        var _modifiers = this.getModifiers(elem)
        if (_modifiers.includes('abstract') !== true && elem.operations.some(function (op) { return op.isAbstract === true })) {
            _modifiers.push('abstract')
        }
        if (_modifiers.length > 0) {
            terms.push(_modifiers.join(' '))
        }

        // Class
        terms.push('class')
        terms.push(elem.name)

        // Extends
        var _extends = this.getSuperClasses(elem)
        if (_extends.length > 0) {
            terms.push('extends ' + _extends[0].name)
        }

        // Implements
        var _implements = this.getSuperInterfaces(elem)
        if (_implements.length > 0) {
            terms.push('implements ' + _implements.map(function (e) { return e.name }).join(', '))
        }
        codeWriter.writeLine(terms.join(' ') + ' {')
        codeWriter.writeLine()
        codeWriter.indent()

        // Constructor
        this.writeConstructor(codeWriter, elem, options)
        codeWriter.writeLine()

        // Member Variables
        // (from attributes)
        for (i = 0, len = elem.attributes.length; i < len; i++) {
            this.writeMemberVariable(codeWriter, elem.attributes[i], options)
            codeWriter.writeLine()
        }
        // (from associations)
        var associations = app.repository.getRelationshipsOf(elem, function (rel) {
            return (rel instanceof type.UMLAssociation)
        })
        for (i = 0, len = associations.length; i < len; i++) {
            var asso = associations[i]
            if (asso.end1.reference === elem && asso.end2.navigable === true) {
                this.writeMemberVariable(codeWriter, asso.end2, options)
                codeWriter.writeLine()
            }
            if (asso.end2.reference === elem && asso.end1.navigable === true) {
                this.writeMemberVariable(codeWriter, asso.end1, options)
                codeWriter.writeLine()
            }
        }

        // Methods
        for (i = 0, len = elem.operations.length; i < len; i++) {
            this.writeMethod(codeWriter, elem.operations[i], options, false, false)
            codeWriter.writeLine()
        }

        // Extends methods
        if (_extends.length > 0) {
            for (i = 0, len = _extends[0].operations.length; i < len; i++) {
                _modifiers = this.getModifiers(_extends[0].operations[i])
                if (_modifiers.includes('abstract') === true) {
                    this.writeMethod(codeWriter, _extends[0].operations[i], options, false, false)
                    codeWriter.writeLine()
                }
            }
        }

        // Interface methods
        for (var j = 0; j < _implements.length; j++) {
            for (i = 0, len = _implements[j].operations.length; i < len; i++) {
                this.writeMethod(codeWriter, _implements[j].operations[i], options, false, false)
                codeWriter.writeLine()
            }
        }

        // Inner Definitions
        for (i = 0, len = elem.ownedElements.length; i < len; i++) {
            var def = elem.ownedElements[i]
            if (def instanceof type.UMLClass) {
                if (def.stereotype === 'annotationType') {
                    this.writeAnnotationType(codeWriter, def, options)
                } else {
                    this.writeClass(codeWriter, def, options)
                }
                codeWriter.writeLine()
            } else if (def instanceof type.UMLInterface) {
                this.writeInterface(codeWriter, def, options)
                codeWriter.writeLine()
            } else if (def instanceof type.UMLEnumeration) {
                this.writeEnum(codeWriter, def, options)
                codeWriter.writeLine()
            }
        }

        codeWriter.outdent()
        codeWriter.writeLine('}')
    }

    /**
     * Write Class
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    writeEntity(codeWriter, elem, options) {
        var i, len
        var terms = []

        // Doc
        var doc = elem.documentation.trim()
        if (app.project.getProject().author && app.project.getProject().author.length > 0) {
            doc += '\n@author ' + app.project.getProject().author
        }
        this.writeDoc(codeWriter, doc, options)

        if (elem.stereotype instanceof type.UMLClass && elem.stereotype.name === 'Entity') {
            codeWriter.import(elem.stereotype.name, this.getModulePath(elem, elem.stereotype));
            if (options.tablePrefix) {
                codeWriter.writeLine(`@Entity("${options.tablePrefix}_${snakeCase(elem.name)}")`)
            } else {
                codeWriter.writeLine('@Entity()')
            }
        }
        terms.push('export')
        // Modifiers
        var _modifiers = this.getModifiers(elem, false)
        if (_modifiers.includes('abstract') !== true && elem.operations.some(function (op) { return op.isAbstract === true })) {
            _modifiers.push('abstract')
        }
        if (_modifiers.length > 0) {
            terms.push(_modifiers.join(' '))
        }

        // Class
        terms.push('class')
        terms.push(elem.name)

        // Extends
        var _extends = this.getSuperClasses(elem)
        if (_extends.length > 0) {
            terms.push('extends ' + _extends[0].name)
        }

        // Implements
        var _implements = this.getSuperInterfaces(elem)
        if (_implements.length > 0) {
            terms.push('implements ' + _implements.map(function (e) { return e.name }).join(', '))
        }
        codeWriter.writeLine(terms.join(' ') + ' {')
        codeWriter.writeLine()
        codeWriter.indent()

        // Constructor
        // this.writeConstructor(codeWriter, elem, options)
        // codeWriter.writeLine()

        // Member Variables
        // (from attributes)
        for (i = 0, len = elem.attributes.length; i < len; i++) {
            this.writeEntityColumn(codeWriter, elem.attributes[i], options)
            codeWriter.writeLine()
        }

        // (from associations)
        var associations = app.repository.getRelationshipsOf(elem, function (rel) {
            return (rel instanceof type.UMLAssociation)
        })
        for (i = 0, len = associations.length; i < len; i++) {
            var asso = associations[i]
            if (asso.end1.reference === elem && asso.end2.navigable === true) {
                this.writeEntityRelation(codeWriter, asso.end1, asso.end2, options)
            }
            if (asso.end2.reference === elem && asso.end1.navigable === true) {
                this.writeEntityRelation(codeWriter, asso.end2, asso.end1, options)
            }

        }

        // Methods
        for (i = 0, len = elem.operations.length; i < len; i++) {
            this.writeMethod(codeWriter, elem.operations[i], options, false, false)
            codeWriter.writeLine()
        }

        // Extends methods
        if (_extends.length > 0) {
            for (i = 0, len = _extends[0].operations.length; i < len; i++) {
                _modifiers = this.getModifiers(_extends[0].operations[i])
                if (_modifiers.includes('abstract') === true) {
                    this.writeMethod(codeWriter, _extends[0].operations[i], options, false, false)
                    codeWriter.writeLine()
                }
            }
        }

        // Interface methods
        for (var j = 0; j < _implements.length; j++) {
            for (i = 0, len = _implements[j].operations.length; i < len; i++) {
                this.writeMethod(codeWriter, _implements[j].operations[i], options, false, false)
                codeWriter.writeLine()
            }
        }

        // Inner Definitions
        for (i = 0, len = elem.ownedElements.length; i < len; i++) {
            var def = elem.ownedElements[i]
            if (def instanceof type.UMLClass) {
                if (def.stereotype === 'annotationType') {
                    this.writeAnnotationType(codeWriter, def, options)
                } else {
                    this.writeClass(codeWriter, def, options)
                }
                codeWriter.writeLine()
            } else if (def instanceof type.UMLInterface) {
                this.writeInterface(codeWriter, def, options)
                codeWriter.writeLine()
            } else if (def instanceof type.UMLEnumeration) {
                this.writeEnum(codeWriter, def, options)
                codeWriter.writeLine()
            }
        }

        codeWriter.outdent()
        codeWriter.writeLine('}')
    }

    /**
     * Write Class
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    writeModule(codeWriter, elem, options) {
        var i, len
        var terms = []

        // Doc
        var doc = elem.documentation.trim()
        if (app.project.getProject().author && app.project.getProject().author.length > 0) {
            doc += '\n@author ' + app.project.getProject().author
        }
        this.writeDoc(codeWriter, doc, options)

        codeWriter.import(elem.stereotype.name, this.getModulePath(elem, elem.stereotype));
        // codeWriter.writeLine(`@${}()`)


        terms.push('export')
        // Modifiers
        var _modifiers = this.getModifiers(elem, false)
        if (_modifiers.includes('abstract') !== true && elem.operations.some(function (op) { return op.isAbstract === true })) {
            _modifiers.push('abstract')
        }
        if (_modifiers.length > 0) {
            terms.push(_modifiers.join(' '))
        }

        // Class
        terms.push('class')
        terms.push(elem.name)

        // Extends
        var _extends = this.getSuperClasses(elem)
        if (_extends.length > 0) {
            terms.push('extends ' + _extends[0].name)
        }

        // Implements
        var _implements = this.getSuperInterfaces(elem)
        if (_implements.length > 0) {
            terms.push('implements ' + _implements.map(function (e) { return e.name }).join(', '))
        }
        codeWriter.writeLine(terms.join(' ') + ' {')
        codeWriter.writeLine()
        codeWriter.indent()

        // Constructor
        // this.writeConstructor(codeWriter, elem, options)
        // codeWriter.writeLine()

        // Member Variables
        // (from attributes)
        for (i = 0, len = elem.attributes.length; i < len; i++) {
            this.writeEntityColumn(codeWriter, elem.attributes[i], options)
            codeWriter.writeLine()
        }

        // (from associations)
        var associations = app.repository.getRelationshipsOf(elem, function (rel) {
            return (rel instanceof type.UMLAssociation)
        })
        for (i = 0, len = associations.length; i < len; i++) {
            var asso = associations[i]
            if (asso.end1.reference === elem && asso.end2.navigable === true) {
                this.writeEntityRelation(codeWriter, asso.end1, asso.end2, options)
            }
            if (asso.end2.reference === elem && asso.end1.navigable === true) {
                this.writeEntityRelation(codeWriter, asso.end2, asso.end1, options)
            }

        }

        // Methods
        for (i = 0, len = elem.operations.length; i < len; i++) {
            this.writeMethod(codeWriter, elem.operations[i], options, false, false)
            codeWriter.writeLine()
        }

        // Extends methods
        if (_extends.length > 0) {
            for (i = 0, len = _extends[0].operations.length; i < len; i++) {
                _modifiers = this.getModifiers(_extends[0].operations[i])
                if (_modifiers.includes('abstract') === true) {
                    this.writeMethod(codeWriter, _extends[0].operations[i], options, false, false)
                    codeWriter.writeLine()
                }
            }
        }

        // Interface methods
        for (var j = 0; j < _implements.length; j++) {
            for (i = 0, len = _implements[j].operations.length; i < len; i++) {
                this.writeMethod(codeWriter, _implements[j].operations[i], options, false, false)
                codeWriter.writeLine()
            }
        }

        // Inner Definitions
        for (i = 0, len = elem.ownedElements.length; i < len; i++) {
            var def = elem.ownedElements[i]
            if (def instanceof type.UMLClass) {
                if (def.stereotype === 'annotationType') {
                    this.writeAnnotationType(codeWriter, def, options)
                } else {
                    this.writeClass(codeWriter, def, options)
                }
                codeWriter.writeLine()
            } else if (def instanceof type.UMLInterface) {
                this.writeInterface(codeWriter, def, options)
                codeWriter.writeLine()
            } else if (def instanceof type.UMLEnumeration) {
                this.writeEnum(codeWriter, def, options)
                codeWriter.writeLine()
            }
        }

        codeWriter.outdent()
        codeWriter.writeLine('}')
    }

    /**
     * Write Interface
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    writeInterface(codeWriter, elem, options) {
        var i, len
        var terms = []

        // Doc
        this.writeDoc(codeWriter, elem.documentation, options)

        // Modifiers
        var visibility = this.getVisibility(elem)
        if (visibility) {
            terms.push(visibility)
        }

        // Interface
        terms.push('interface')
        terms.push(elem.name)

        // Extends
        var _extends = this.getSuperClasses(elem)
        if (_extends.length > 0) {
            terms.push('extends ' + _extends.map(function (e) { return e.name }).join(', '))
        }
        codeWriter.writeLine(terms.join(' ') + ' {')
        codeWriter.writeLine()
        codeWriter.indent()

        // Member Variables
        // (from attributes)
        for (i = 0, len = elem.attributes.length; i < len; i++) {
            this.writeMemberVariable(codeWriter, elem.attributes[i], options)
            codeWriter.writeLine()
        }
        // (from associations)
        var associations = app.repository.getRelationshipsOf(elem, function (rel) {
            return (rel instanceof type.UMLAssociation)
        })
        for (i = 0, len = associations.length; i < len; i++) {
            var asso = associations[i]
            if (asso.end1.reference === elem && asso.end2.navigable === true) {
                this.writeMemberVariable(codeWriter, asso.end2, options)
                codeWriter.writeLine()
            }
            if (asso.end2.reference === elem && asso.end1.navigable === true) {
                this.writeMemberVariable(codeWriter, asso.end1, options)
                codeWriter.writeLine()
            }
        }

        // Methods
        for (i = 0, len = elem.operations.length; i < len; i++) {
            this.writeMethod(codeWriter, elem.operations[i], options, true, false)
            codeWriter.writeLine()
        }

        // Inner Definitions
        for (i = 0, len = elem.ownedElements.length; i < len; i++) {
            var def = elem.ownedElements[i]
            if (def instanceof type.UMLClass) {
                if (def.stereotype === 'annotationType') {
                    this.writeAnnotationType(codeWriter, def, options)
                } else {
                    this.writeClass(codeWriter, def, options)
                }
                codeWriter.writeLine()
            } else if (def instanceof type.UMLInterface) {
                this.writeInterface(codeWriter, def, options)
                codeWriter.writeLine()
            } else if (def instanceof type.UMLEnumeration) {
                this.writeEnum(codeWriter, def, options)
                codeWriter.writeLine()
            }
        }

        codeWriter.outdent()
        codeWriter.writeLine('}')
    }

    /**
     * Write Enum
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    writeEnum(codeWriter, elem, options) {
        var i, len
        var terms = []
        // Doc
        this.writeDoc(codeWriter, elem.documentation, options)

        // Modifiers
        var visibility = this.getVisibility(elem)
        if (visibility) {
            terms.push(visibility)
        }
        // Enum
        terms.push('enum')
        terms.push(elem.name)

        codeWriter.writeLine(terms.join(' ') + ' {')
        codeWriter.indent()

        // Literals
        for (i = 0, len = elem.literals.length; i < len; i++) {
            codeWriter.writeLine(elem.literals[i].name + (i < elem.literals.length - 1 ? ',' : ''))
        }

        codeWriter.outdent()
        codeWriter.writeLine('}')
    }

    /**
     * Write AnnotationType
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    writeAnnotationType(codeWriter, elem, options) {
        var i, len
        var terms = []

        // Doc
        var doc = elem.documentation.trim()
        if (app.project.getProject().author && app.project.getProject().author.length > 0) {
            doc += '\n@author ' + app.project.getProject().author
        }
        this.writeDoc(codeWriter, doc, options)

        // Modifiers
        var _modifiers = this.getModifiers(elem)
        if (_modifiers.includes('abstract') !== true && elem.operations.some(function (op) { return op.isAbstract === true })) {
            _modifiers.push('abstract')
        }
        if (_modifiers.length > 0) {
            terms.push(_modifiers.join(' '))
        }

        // AnnotationType
        terms.push('@interface')
        terms.push(elem.name)

        codeWriter.writeLine(terms.join(' ') + ' {')
        codeWriter.writeLine()
        codeWriter.indent()

        // Member Variables
        for (i = 0, len = elem.attributes.length; i < len; i++) {
            this.writeMemberVariable(codeWriter, elem.attributes[i], options)
            codeWriter.writeLine()
        }

        // Methods
        for (i = 0, len = elem.operations.length; i < len; i++) {
            this.writeMethod(codeWriter, elem.operations[i], options, true, true)
            codeWriter.writeLine()
        }

        // Extends methods
        var _extends = this.getSuperClasses(elem)
        if (_extends.length > 0) {
            for (i = 0, len = _extends[0].operations.length; i < len; i++) {
                _modifiers = this.getModifiers(_extends[0].operations[i])
                if (_modifiers.includes('abstract') === true) {
                    this.writeMethod(codeWriter, _extends[0].operations[i], options, false, false)
                    codeWriter.writeLine()
                }
            }
        }

        // Inner Definitions
        for (i = 0, len = elem.ownedElements.length; i < len; i++) {
            var def = elem.ownedElements[i]
            if (def instanceof type.UMLClass) {
                if (def.stereotype === 'annotationType') {
                    this.writeAnnotationType(codeWriter, def, options)
                } else {
                    this.writeClass(codeWriter, def, options)
                }
                codeWriter.writeLine()
            } else if (def instanceof type.UMLInterface) {
                this.writeInterface(codeWriter, def, options)
                codeWriter.writeLine()
            } else if (def instanceof type.UMLEnumeration) {
                this.writeEnum(codeWriter, def, options)
                codeWriter.writeLine()
            }
        }

        codeWriter.outdent()
        codeWriter.writeLine('}')
    }
}

/**
 * Generate
 * @param {type.Model} baseModel
 * @param {string} basePath
 * @param {Object} options
 */
function generate(baseModel, basePath, options) {
    var javaCodeGenerator = new JavaCodeGenerator(baseModel, basePath)
    javaCodeGenerator.generate(baseModel, basePath, options)
}

exports.generate = generate
