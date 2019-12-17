const path = require('path')
const kebabCase = require('lodash.kebabcase')
const camelCase = require('lodash.camelcase')
const snakeCase = require('lodash.snakecase')
const pluralize = require('pluralize')
const capitalize = require('lodash.capitalize')

exports.CodeHelper = class CodeHelper {
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

    getImportPath(from, to) {
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
            }
            else {
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

    getSelector(elem) {
        if (!elem._parent) {
            return ''
        }

        return this.getSelector(elem._parent) + '::' + `@${elem.constructor.name}[name=${elem.name}]`
    }
}
