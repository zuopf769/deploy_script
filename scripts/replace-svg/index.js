"use strict";

const walk = require('fs-walk');
const path = require('path');
const fs = require('fs');

const filter = /\.(less|js|tx|tsx|jsx|css|html|txt|json|html)$/;

// https://codepen.io/tigt/post/optimizing-svgs-in-data-uris

let fc = 0;

walk.files(path.join(__dirname, '..', '..'), (basedir, filename, stat, next) => {
    fc++;
    if (fc % 200 === 0) { console.log(fc + ' files scanned'); }
    if (basedir.split('/').indexOf('bin') >= 0) { return next(); }
    if (!filter.test(filename)) { return next(); }
    const filePath = path.join(basedir, filename);
    fs.readFile(filePath, { encoding: 'utf8' }, (err, data) => {
        if (err) { throw err; }
        fs.writeFile(filePath,  data.replace(/'data:image\/svg\+xml,<svg([^\n]+)<\/svg>'/g, single => {
            console.log('Found one in ' + basedir + '/' + filename);
            const proper = single.substring(single.indexOf(',') + 1, single.length - 1);
            if (proper.indexOf("'") >= 0) { throw 'Single quote found'; }
            const newVal = encodeURIComponent(proper.replace(/"/g, '\'')).replace(/%20/g, ' ');
            return '"data:image/svg+xml,' + newVal + '"';
        }));
        next();
    });
}, err => {
    if (err) { throw err; }
});