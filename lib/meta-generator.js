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
    }

    /**
     * Generate codes from a given element
     * @param {type.Model} elem
     * @param {string} basePath
     * @param {Object} options
     */
    generate(elem, basePath, options) {
        var meta = {
            id: 'UMLPackage',
            name: 'node_modules',
            children: [
                {
                    id: 'UMLPackage',
                    name: 'nestjs/common',
                    children: [
                        {
                            id: 'UMLClass',
                            name: 'Injectable',
                        },
                        {
                            id: 'UMLClass',
                            name: 'Module',
                        },
                        {
                            id: 'UMLClass',
                            name: 'Controller',
                        },
                    ]
                },
                {
                    id: 'UMLPackage',
                    name: 'nestjs/typeorm',
                    children: [
                        {
                            id: 'UMLClass',
                            name: 'InjectRepository',
                        },
                    ]
                },
                {
                    id: 'UMLPackage',
                    name: 'nestjsx/crud',
                    children: [
                        {
                            id: 'UMLClass',
                            name: 'Crud',
                        },
                        {
                            id: 'UMLClass',
                            name: 'CrudController',
                        }
                    ]
                },
                {
                    id: 'UMLPackage',
                    name: 'nestjsx/crud-typeorm',
                    children: [
                        {
                            id: 'UMLClass',
                            name: 'TypeOrmCrudService',
                        },
                    ]
                },
                {
                    id: 'UMLPackage',
                    name: 'typeorm',
                    children: [
                        {
                            id: 'UMLClass',
                            name: 'Column',
                        },
                        {
                            id: 'UMLClass',
                            name: 'CreateDateColumn',
                        },
                        {
                            id: 'UMLClass',
                            name: 'Entity',
                        },
                        {
                            id: 'UMLClass',
                            name: 'OneToMany',
                        },
                        {
                            id: 'UMLClass',
                            name: 'PrimaryColumn',
                        },
                        {
                            id: 'UMLClass',
                            name: 'VersionColumn',
                        },
                        {
                            id: 'UMLClass',
                            name: 'ManyToOne',
                        },
                        {
                            id: 'UMLClass',
                            name: 'ManyToMany',
                        },
                        {
                            id: 'UMLClass',
                            name: 'OneToOne',
                        },
                        {
                            id: 'UMLClass',
                            name: 'UpdateDateColumn',
                        },
                        {
                            id: 'UMLClass',
                            name: 'JoinColumn',
                        },
                        {
                            id: 'UMLClass',
                            name: 'JoinTable',
                        },
                        {
                            id: 'UMLClass',
                            name: 'Tree',
                        },
                    ]
                },
            ]
        }

        this.createModel(elem, meta)
    }

    createModel(parent, child) {
        var nextParent = app.repository.select(child.name)[0]
        if (!nextParent) {
            nextParent = app.factory.createModel({
                id: child.id,
                parent: parent,
                modelInitializer: function (elem) {
                    elem.name = child.name
                }
            })
        }

        if (child.children) {
            child.children.forEach(nextChild => this.createModel(nextParent, nextChild))
        }
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
