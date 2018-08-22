#!/usr/bin/env node
'use strict';

const fs = require('fs');
const css = require('css');
const less = require('less');
const util = require('util');
const difference = require('lodash.difference');
const flatten = require('lodash.flatten');
const identity = require('lodash.identity');
const uniq = require('lodash.uniq');
const walkSync = require('walk-sync');
const ts = require('typescript');
const path = require('path');

const WEBAPP_PROJECT_ROOT = path.join(__dirname, '../../webapp/src');
const STYLESHEET_ENTRANCE = 'styles.less';

process.chdir(WEBAPP_PROJECT_ROOT);

const VALID_CLASSNAME = /\.[A-Za-z0-9_\-]+/g;

const handleTsFile = root => {
  const dict = [];
  const handleTsAST = node => {
    if (node.kind === ts.SyntaxKind.StringLiteral) {
      dict.push(node.text);
    }
    ts.forEachChild(node, handleTsAST);
  };
  handleTsAST(root);
  return dict;
};

const tsFiles = walkSync('.', { globs: ['**/*.ts', '**/*.tsx'] });
const allStringTokensWithinAllFiles = uniq(flatten(tsFiles.map(file => {
  const content = fs.readFileSync(file, { encoding: 'utf-8' });
  const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.ES5, true);
  return flatten(handleTsFile(sourceFile).map(str => str.split(/\s+/))).filter(identity);
})));

less.render(fs.readFileSync(STYLESHEET_ENTRANCE, { encoding: 'utf-8' }), function (e, output) {
  if (e) {
    console.warn('LESS -> CSS compilation failed!', e);
    return;
  }
  try {
    const parsed = css.parse(output.css, {});
    const classNames = uniq(flatten(flatten(parsed.stylesheet.rules.map(each => each.selectors)).filter(identity).map(sel => sel.match(VALID_CLASSNAME)).filter(identity)).map(sel => sel.substr(1)));
    const finalResult = difference(classNames, allStringTokensWithinAllFiles);
    console.log('Final result of classNames which are not used (not complete, may have a lot of false negatives):', finalResult);
  } catch (e) {
    console.error('LESS compilcation failed.', e);
  }
});
