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
const path = require('path');

const WEBAPP_PROJECT_ROOT = path.join(__dirname, '../../webapp/src');
const STYLESHEET_ENTRANCE = 'styles.less';

process.chdir(WEBAPP_PROJECT_ROOT);

const imageFiles = walkSync('images', { directories: false });

less.render(fs.readFileSync(STYLESHEET_ENTRANCE, { encoding: 'utf-8' }), function (e, output) {
  if (e) {
    console.warn('LESS -> CSS compilation failed!', e);
    return;
  }
  try {
    const parsed = css.parse(output.css, {});
    // known bug: cannot match multiple images in one declaration
    const images = uniq(
      flatten(
        flatten(
          parsed.stylesheet.rules.map(each => each.declarations)
            .filter(identity)
        )
          .filter(entry => (entry.property === 'background') || (entry.property === 'background-image'))
          .map(entry => entry.value.match(/url\(['"]?images\/([^'"]*)['"]?\)/))
          .filter(identity)
          .map(matched => matched[1])
      )
    );
    const finalResult = difference(imageFiles, images);
    console.log('Final result of images which are not used:', finalResult);
  } catch (e) {
    console.error(e);
  }
});
