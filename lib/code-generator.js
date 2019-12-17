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
const { CodeWriter } = require('./code-writer')
const kebabCase = require('lodash.kebabcase');
const camelCase = require('lodash.camelcase');
const snakeCase = require('lodash.snakecase');
const pluralize = require('pluralize')
const capitalize = require('lodash.capitalize')
const keywords = {
    break: true,
    case: true,
    catch: true,
    continue: true,
    debugger: true,
    default: true,
    delete: true,
    do: true,
    else: true,
    finally: true,
    for: true,
    function: true,
    if: true,
    in: true,
    instanceof: true,
    new: true,
    return: true,
    switch: true,
    this: true,
    throw: true,
    try: true,
    typeof: true,
    var: true,
    void: true,
    while: true,
    with: true,
}

/**
 * Java Code Generator
 */
class NestCodeGenerator {

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
        this.entities = []
        this.services = []
        this.controllers = []
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
            if (elem.stereotype instanceof type.UMLClass && elem.stereotype.name === 'Module') {
                codeWriter = new CodeWriter(this.getIndentString(options))
                this.writeModule(codeWriter, elem, options)
                let modPath = fullPath + '/' + this.getFileName(elem) + '.ts'
                fs.writeFileSync(modPath, codeWriter.getData())
                this.entities = []
                this.services = []
                this.controllers = []
            }
        } else if (elem instanceof type.UMLClass) {
            // Decorator
            if (elem.stereotype === 'annotationType') {
                fullPath = path.join(basePath, elem.name + '.java')
                codeWriter = new CodeWriter(this.getIndentString(options))
                codeWriter.writeLine()
                codeWriter.writeLine('import java.util.*;')
                codeWriter.writeLine()
                this.writeAnnotationType(codeWriter, elem, options)
                fs.writeFileSync(fullPath, codeWriter.getData())
                // Entity
            } else if ((elem.stereotype instanceof type.UMLClass
                && elem.stereotype.name === 'Entity')
                || elem.stereotype === 'fields') {

                if (elem.stereotype.name === 'Entity') {
                    this.entities.push(elem)
                }
                fullPath = basePath + '/' + this.getFileName(elem) + '.ts'
                codeWriter = new CodeWriter(this.getIndentString(options))
                this.writeEntity(codeWriter, elem, options)
                fs.writeFileSync(fullPath, codeWriter.getData())

                // Model
                basePath = path.join(basePath, '../models')
                if (!fs.existsSync(basePath)) {
                    fs.mkdirSync(basePath)
                }
                elem.isModel = true; // begin use entity as model
                fullPath = path.join(basePath, this.getFileName(elem) + '.ts')
                codeWriter = new CodeWriter(this.getIndentString(options))
                this.writeModel(codeWriter, elem, options)
                fs.writeFileSync(fullPath, codeWriter.getData())
                delete elem.isModel // finish use entity as model
                // Class
            } else if (elem.stereotype instanceof type.UMLClass
                && elem.stereotype.name === 'Injectable') {
                this.services.push(elem)

                fullPath = basePath + '/' + this.getFileName(elem) + '.ts'
                codeWriter = new CodeWriter(this.getIndentString(options))
                this.writeCrudService(codeWriter, elem, options)
                fs.writeFileSync(fullPath, codeWriter.getData())
            } else if (elem.stereotype instanceof type.UMLClass
                && elem.stereotype.name === 'Controller') {
                this.controllers.push(elem)

                fullPath = basePath + '/' + this.getFileName(elem) + '.ts'
                codeWriter = new CodeWriter(this.getIndentString(options))
                this.writeCrudController(codeWriter, elem, options)
                fs.writeFileSync(fullPath, codeWriter.getData())
            }
            // Interface
        } else if (elem instanceof type.UMLInterface) {
            fullPath = basePath + '/' + elem.name + '.java'
            codeWriter = new CodeWriter(this.getIndentString(options))
            codeWriter.writeLine()
            codeWriter.writeLine('import java.util.*;')
            codeWriter.writeLine()
            this.writeInterface(codeWriter, elem, options)
            fs.writeFileSync(fullPath, codeWriter.getData())

            // Enum
        } else if (elem instanceof type.UMLEnumeration) {
            fullPath = basePath + '/' + elem.name + '.java'
            codeWriter = new CodeWriter(this.getIndentString(options))
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
                _type = elem.reference.name + (elem.reference.isModel ? 'Model' : '')
            }
        } else {
            if (elem.type instanceof type.UMLModelElement && elem.type.name.length > 0) {
                _type = elem.type.name + (elem.type.isModel ? 'Model' : '')
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

    getFileName(elem) {
        let fileName = ''
        if (elem.stereotype instanceof type.UMLClass) {
            if (elem.isModel) {
                fileName = kebabCase(elem.name) + '.model'
            } else if (elem.stereotype.name === 'Entity') {
                fileName = kebabCase(elem.name) + '.entity'
            } else if (elem.stereotype.name === 'Module') {
                fileName = kebabCase(elem.name) + '.module'
            } else if (elem.stereotype.name === 'Injectable') {
                fileName = kebabCase(elem.name.replace('Service', '')) + '.service'
            } else if (elem.stereotype.name === 'Controller') {
                fileName = kebabCase(elem.name.replace('Controller', '')) + '.controller'
            }
        } else if (elem.stereotype === 'fields') {
            fileName = kebabCase(elem.name.slice(0, -6)) + '.fields'
        }
        return fileName
    }

    getModuleName(elem) {
        if (!elem || elem instanceof type.UMLModel) {
            return ''
        }

        if (elem instanceof type.UMLPackage
            && elem.stereotype instanceof type.UMLClass
            && elem.stereotype.name === 'Module') {
            return elem.name
        } else {
            return this.getModuleName(elem._parent)
        }
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

    getPackagePath(elem, child) {
        if (!elem || elem instanceof type.UMLModel) {
            return '.'
        }

        var parentPath = this.getPackagePath(elem._parent, elem)
        if (elem instanceof type.UMLPackage) {
            if (parentPath === './node_modules' && {
                'nestjs/common': true,
                'nestjs/typeorm': true,
                'nestjsx/crud': true,
                'nestjsx/crud-typeorm': true,
            }[elem.name]) {
                return parentPath + '/@' + elem.name
            } else {
                if (child && child.isModel) {
                    return parentPath + '/models'
                } else {
                    return parentPath + '/' + elem.name
                }
            }
        } else {
            return parentPath
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

    useTree(asso) {
        return asso instanceof type.UMLAssociation
            && asso.end1.reference === asso.end2.reference
            && asso.stereotype instanceof type.UMLClass
            && asso.stereotype.name === 'Tree'
    }

    /**
     * Write Member Variable
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    writeMemberVariable(codeWriter, elem, options) {
        var name = this.getName(elem)
        var useTree = this.useTree(elem._parent)
        if (useTree && !elem.name) {
            if (this.hasMultiple(elem)) {
                name = 'children'
            } else {
                name = 'parent'
            }
        }
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
        let colOptions = this.getEntityColumnOptions(elem)
        if (Object.keys(colOptions).length > 0) {
            codeWriter.writeLine(`@${column}({ ${colOptions.map(o => o.key + ': ' + o.val).join(', ')} })`)
        } else if (elem.type instanceof type.UMLModelElement && elem.type.name.length > 0) {
            codeWriter.import(elem.type.name, this.getModulePath(elem, elem.type))
            codeWriter.writeLine(`@${column}(type => ${elem.type.name})`)
        } else {
            codeWriter.writeLine(`@${column}()`)
        }

        this.writeMemberVariable(codeWriter, elem, options)
    }

    writeModelRelation(codeWriter, { from, to }, options) {
        from.reference.isModel = true
        to.reference.isModel = true
        if (from.reference !== to.reference) {
            codeWriter.import(to.reference.name + 'Model',
                this.getModulePath(from.reference, to.reference))
        }

        if (to.reference.name.endsWith('?')) {
            codeWriter.writeLine('@ApiModelPropertyOptional()')
        } else {
            codeWriter.writeLine('@ApiModelProperty()')
        }
        this.writeMemberVariable(codeWriter, to, options)
        codeWriter.writeLine()
        delete from.reference.isModel
        delete to.reference.isModel
    }

    /**
     * Write Member Variable
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    writeEntityRelation(codeWriter, asso, options, { from, to, element: elem }) {
        var column
        var useTree = this.useTree(asso)

        if (to) {
            if (useTree) {
                if (this.hasMultiple(from)) {
                    column = 'TreeParent'
                } else {
                    column = 'TreeChildren'
                }
            } else {
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
            }

            codeWriter.import(column, 'typeorm')
            if (useTree) {
                codeWriter.writeLine(`@${column}()`)
            } else {
                let fromEntity = this.getName(from)
                let toField = this.getName(to.reference)
                toField = keywords[toField] ? '_' + toField : toField

                if (from.navigable) {
                    codeWriter.writeLine(`@${column}(type => ${to.reference.name}, ${toField} => ${toField}.${fromEntity})`)
                } else {
                    codeWriter.writeLine(`@${column}(type => ${to.reference.name})`)
                }

                var joinColumn = (column === 'ManyToMany')
                    ? ((asso.end1.reference === elem) ? 'JoinTable' : '')
                    : ((asso.end1.reference === elem) ? 'JoinColumn' : '')
                if (joinColumn) {
                    codeWriter.import(joinColumn, 'typeorm')
                    codeWriter.writeLine(`@${joinColumn}()`)
                }
                if (from.reference !== to.reference) {
                    codeWriter.import(to.reference.name,
                        this.getModulePath(from.reference, to.reference))
                }
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
                codeWriter.writeLine(`@Entity('${options.tablePrefix}_${snakeCase(elem.name)}')`)
            } else {
                codeWriter.writeLine('@Entity()')
            }
        }

        var associations = app.repository.getRelationshipsOf(elem, (rel) =>
            rel instanceof type.UMLAssociation && this.useTree(rel)
        )
        if (associations.length > 0) {
            var asso = associations[0]
            var treeType = asso.name ? asso.name : 'materialized-path'
            codeWriter.import(asso.stereotype.name, this.getModulePath(elem, asso.stereotype))
            codeWriter.writeLine(`@${asso.stereotype.name}('${treeType}')`)
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
                this.writeEntityRelation(codeWriter, asso, options, {
                    element: elem,
                    from: asso.end1,
                    to: asso.end2,
                })
            }
            if (asso.end2.reference === elem && asso.end1.navigable === true) {
                this.writeEntityRelation(codeWriter, asso, options, {
                    element: elem,
                    from: asso.end2,
                    to: asso.end1
                })
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
    writeModel(codeWriter, elem, options) {
        var i, len
        var terms = []

        // Doc
        var doc = elem.documentation.trim()
        if (app.project.getProject().author && app.project.getProject().author.length > 0) {
            doc += '\n@author ' + app.project.getProject().author
        }
        this.writeDoc(codeWriter, doc, options)

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
        if (elem.stereotype === 'fields') {
            terms.push(elem.name)
        } else {
            terms.push(elem.name + 'Model')
        }

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
            let attr = elem.attributes[i]
            if (attr.type instanceof type.UMLModelElement && attr.type.name.length > 0) {
                if (attr.type.stereotype === 'fields') {
                    attr.type.isModel = true
                }
                codeWriter.import(attr.type.name, this.getModulePath(attr, attr.type))
                if (attr.type.isModel) {
                    delete attr.type.isModel
                }

            }

            if (attr.name.endsWith('?')) {
                codeWriter.import('ApiModelPropertyOptional', '@nestjs/swagger')
                codeWriter.writeLine('@ApiModelPropertyOptional()')
            } else {
                codeWriter.import('ApiModelProperty', '@nestjs/swagger')
                codeWriter.writeLine('@ApiModelProperty()')
            }

            this.writeMemberVariable(codeWriter, attr, options)
            codeWriter.writeLine()
        }

        // (from associations)
        var associations = app.repository.getRelationshipsOf(elem, function (rel) {
            return (rel instanceof type.UMLAssociation)
        })
        for (i = 0, len = associations.length; i < len; i++) {
            var asso = associations[i]
            if (asso.end1.reference === elem && asso.end2.navigable === true) {
                this.writeModelRelation(codeWriter, {
                    from: asso.end1,
                    to: asso.end2
                }, options)
            }
            if (asso.end2.reference === elem && asso.end1.navigable === true) {
                this.writeModelRelation(codeWriter, {
                    from: asso.end2,
                    to: asso.end1
                }, options)
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

        codeWriter.import('TypeOrmModule', '@nestjs/typeorm')
        this.entities.forEach(e => codeWriter.import(e.name, this.getModulePath(elem, e)))
        this.services.forEach(e => codeWriter.import(e.name, this.getModulePath(elem, e)))
        this.controllers.forEach(e => codeWriter.import(e.name, this.getModulePath(elem, e)))

        codeWriter.writeLine('@Module({')
        codeWriter.indent()
        if (this.entities.length > 0) {
            codeWriter.writeLine('imports: [')
            codeWriter.indent()
            codeWriter.writeLine('TypeOrmModule.forFeature([')
            codeWriter.indent()
            this.entities.forEach(e => codeWriter.writeLine(e.name + ','))
            codeWriter.outdent()
            codeWriter.writeLine(']),')
            codeWriter.outdent()
            codeWriter.writeLine('],')
        }
        if (this.services.length > 0) {
            codeWriter.writeLine('providers: [')
            codeWriter.indent()
            this.services.forEach(e => codeWriter.writeLine(e.name + ','))
            codeWriter.outdent()
            codeWriter.writeLine('],')
        }
        if (this.controllers.length > 0) {
            codeWriter.writeLine('controllers: [')
            codeWriter.indent()
            this.controllers.forEach(e => codeWriter.writeLine(e.name + ','))
            codeWriter.outdent()
            codeWriter.writeLine('],')
        }
        codeWriter.outdent()
        codeWriter.writeLine('})')

        terms.push('export')

        // Class
        terms.push('class')
        terms.push(capitalize(camelCase(elem.name)) + 'Module')

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
        codeWriter.writeLine('}')
    }

    /**
     * Write Class
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    writeCrudController(codeWriter, elem, options) {
        var i, len
        var terms = []

        // Doc
        var doc = elem.documentation.trim()
        if (app.project.getProject().author && app.project.getProject().author.length > 0) {
            doc += '\n@author ' + app.project.getProject().author
        }
        this.writeDoc(codeWriter, doc, options)

        codeWriter.import(elem.stereotype.name, this.getModulePath(elem, elem.stereotype));
        codeWriter.import('Crud', '@nestjsx/crud')
        codeWriter.import('ApiUseTags', '@nestjs/swagger')

        var associations = app.repository.getRelationshipsOf(elem, function (rel) {
            return (rel instanceof type.UMLAssociation)
        })

        let crudSvc
        let crudEntity
        let svcs = associations
            .map(asso => asso.end2.reference)
            .map(svc => {
                codeWriter.import(svc.name, this.getModulePath(elem, svc));
                return svc
            })
            .map(svc => {
                var generalizations = app.repository.getRelationshipsOf(svc, function (rel) {
                    return (rel instanceof type.UMLGeneralization
                        && rel.source === svc
                        && rel.target.name === 'TypeOrmCrudService')
                })
                if (generalizations.length > 0) {
                    crudSvc = crudSvc ? crudSvc : svc
                    crudEntity = crudEntity ? crudEntity : generalizations[0].stereotype
                }
                return svc
            })

        let modelName = crudEntity.name + 'Model'
        codeWriter.writeLine('@Crud({')
        if (crudEntity) {
            crudEntity.isModel = true
            codeWriter.import(modelName, this.getModulePath(elem, crudEntity));
            delete crudEntity.isModel
            codeWriter.indent()
            codeWriter.writeLine('model: {')
            codeWriter.indent()
            codeWriter.writeLine(`type: ${modelName},`)
            codeWriter.outdent()
            codeWriter.writeLine('},')
            codeWriter.outdent()
        }
        codeWriter.writeLine('})')

        codeWriter.writeLine(`@ApiUseTags('${this.getModuleName(elem)}')`)
        codeWriter.writeLine(`@Controller('${kebabCase(pluralize(crudEntity.name))}')`)

        terms.push('export')
        terms.push('class')
        terms.push(elem.name)

        if (crudEntity) {
            codeWriter.import('CrudController', '@nestjsx/crud')
            terms.push('implements')
            terms.push(`CrudController<${modelName}> `)
        }

        codeWriter.writeLine(terms.join(' ') + ' {')
        codeWriter.indent()
        if (svcs.length > 0) {
            codeWriter.writeLine('constructor(')
            codeWriter.indent()
            svcs.map(svc => `${svc === crudSvc ? 'public' : 'private'} readonly ${svc === crudSvc ? 'service' : camelCase(svc.name)}: ${svc.name},`)
                .join(',@')
                .split('@')
                .forEach(param => codeWriter.writeLine(param))
            codeWriter.outdent()
            codeWriter.writeLine(') {}')
        } else {
            codeWriter.writeLine('constructor() {}')
        }
        if (crudEntity) {
            codeWriter.writeLine(`get base(): CrudController<${modelName}> {`)
            codeWriter.indent()
            codeWriter.writeLine('return this;')
            codeWriter.outdent()
            codeWriter.writeLine('}')
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
    writeCrudService(codeWriter, elem, options) {
        var i, len
        var terms = []

        // Doc
        var doc = elem.documentation.trim()
        if (app.project.getProject().author && app.project.getProject().author.length > 0) {
            doc += '\n@author ' + app.project.getProject().author
        }
        this.writeDoc(codeWriter, doc, options)

        var generalizations = app.repository.getRelationshipsOf(elem, function (rel) {
            return (rel instanceof type.UMLGeneralization && rel.source === elem)
        })
        var entity = generalizations[0].stereotype
        codeWriter.import(entity.name, this.getModulePath(elem, entity));
        codeWriter.import(elem.stereotype.name, this.getModulePath(elem, elem.stereotype));
        codeWriter.import('InjectRepository', '@nestjs/typeorm')
        codeWriter.import('TypeOrmCrudService', '@nestjsx/crud-typeorm')

        codeWriter.writeLine('@Injectable()')

        terms.push('export')

        // Class
        terms.push('class')
        terms.push(elem.name)

        // Extends
        if (generalizations.length > 0) {
            terms.push(`extends ${generalizations[0].target.name}<${entity.name}>`)
        }

        codeWriter.writeLine(terms.join(' ') + ' {')
        codeWriter.indent()
        codeWriter.writeLine(`constructor(@InjectRepository(${entity.name}) repo) {`)
        codeWriter.indent()
        codeWriter.writeLine('super(repo);')
        codeWriter.outdent()
        codeWriter.writeLine('}')
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
    var nestCodeGenerator = new NestCodeGenerator(baseModel, basePath)
    nestCodeGenerator.generate(baseModel, basePath, options)
}

exports.generate = generate
