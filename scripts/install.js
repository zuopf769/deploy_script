#!/usr/bin/env nodejs

'use strict';

(dependencies => target => { const dep = {
    run: (cmd, args, cwd, next) => {
        console.log('>>>> xxx-uwsr: Running ' + cmd + ' ' + args.map(e => e.replace(/(\s)/g, '\\$1')).join(' ') + ' in ' + cwd);
        const ls = require('child_process').spawn(cmd, args, { cwd });
        ls.stdout.on('data', data => process.stdout.write(data.toString().split('\n').join('\n')) );
        ls.stderr.on('data', data => process.stderr.write(data.toString().split('\n').join('\n')) );
        ls.on('close', code => { if (code !== 0) { throw 'NPM EXITED ' + code; } next(); });
    }
}; dependencies.forEach(d => (dep[d] = require(d))); target(dep); })(['fs', 'path'])(dep => {
    const doWalk = prefix => dep.fs.readdirSync(prefix).filter(e => (e !== 'node_modules') && !e.startsWith('.')).map(e => dep.path.join(prefix, e)).filter(e => dep.fs.statSync(e).isDirectory()).map(entry => (dep.fs.existsSync(dep.path.join(entry, 'package.json')) ? [entry] : []).concat(doWalk(entry))).reduce((a, b) => a.concat(b), []);
    const next = ((res, cont) => (index => {
        if (index >= res.length) { cont(); return; }
        dep.run('npm', ['install'].concat(process.argv.slice(2)), res[index], () => next(index + 1));
    }))(doWalk(__dirname), () => {
        console.log('>>>> ofo-uwsr: All npm installs finished!');
        console.log('>>>> ofo-uwsr: Now running initial builds.');
        dep.run('webpack', ['--config', 'webpack.production.config.js'], dep.path.join(__dirname, 'common'), () =>
            dep.run('webpack', ['--config', 'webpack.production.config.js'], dep.path.join(__dirname, 'webapp'), () =>
                dep.run('gulp', [], dep.path.join(__dirname, 'packet'), () =>
                    console.log('>>>> ofo-uwsr: All builds finished!')
                )
            )
        )
    });
    next(0);
});