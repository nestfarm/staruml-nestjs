const codeGenerator = require('./code-generator')
const crudGenerator = require('./crud-generator')
const metaGenerator = require('./meta-generator')

function handleGenerate(base, path, options) {
  options = options || getGenOptions()
  getBase(base).then(base => {
    if (base) {
      path = getPath(path)
      codeGenerator.generate(base, path, options)
    }
  });
}

function handleGenerateCrud(base, path, options) {
  options = options || getGenOptions()
  getBase(base).then(base => {
    if (base) {
      crudGenerator.generate(base, path, options)
    }
  });
}

function handleGenerateMeta(base, path, options) {
  options = options || getGenOptions()
  getModel(base).then(base => {
    if (base) {
      metaGenerator.generate(base, path, options)
    }
  });
}

function getGenOptions() {
  return {
    javaDoc: app.preferences.get('nest.gen.javaDoc'),
    useTab: app.preferences.get('nest.gen.useTab'),
    indentSpaces: app.preferences.get('nest.gen.indentSpaces'),
    tablePrefix: app.preferences.get('nest.gen.tablePrefix')
  }
}

function getBase(base) {
  if (!base) {
    return app.elementPickerDialog
      .showDialog('Select a base model to generate codes', null, type.UMLPackage)
      .then(function ({ buttonId, returnValue }) {
        if (buttonId === 'ok') {
          return returnValue
        }
      })
  }
  return Promise.resolve(base)
}

function getModel(base) {
  if (!base) {
    return app.elementPickerDialog
      .showDialog('Select a base model to generate node_modules metadata', null, type.UMLModel)
      .then(function ({ buttonId, returnValue }) {
        if (buttonId === 'ok') {
          return returnValue
        }
      })
  }
  return Promise.resolve(base)
}

function getPath(path) {
  if (!path) {
    var files = app.dialogs.showOpenDialog('Select a folder where generated codes to be located', null, null, { properties: ['openDirectory'] })
    if (files && files.length > 0) {
      path = files[0]
    }
  }
  return path
}

function _handleConfigure() {
  app.commands.execute('application:preferences', 'nest')
}

function init() {
  app.commands.register('nest:generate:code', handleGenerate)
  app.commands.register('nest:generate:crud', handleGenerateCrud)
  app.commands.register('nest:generate:meta', handleGenerateMeta)
  app.commands.register('nest:configure', _handleConfigure)
}

exports.init = init