'use strict';

const Buffer = require('buffer').Buffer;
const co = require('co');
const exec = require('exec-co');
const fs = require('co-fs-plus');
const colors = require('colors/safe');
const os = require('os');
const OSS = require('ali-oss');
const path = require('path');
const md5File = require('md5-file/promise');
const url = require('url');
const flattenDeep = require('lodash.flattendeep');
const fetch = require('node-fetch');
const CDN = require('refresh-aliyun-cdn').co;

const consoleTitle = str => console.log(colors.green(str));

// helper to get current Git status

const currentGitInfo = function* () {
  const gitInfo = {
    head: yield exec('git rev-parse HEAD'),
    status: yield exec('git status'),
    user: yield exec('git config user.name'),
    email: yield exec('git config user.email'),
    root: yield exec('git rev-parse --show-toplevel')
  };
  Object.keys(gitInfo).forEach(single => {
    if (gitInfo[single].err) {
      console.error(colors.red('Running Git failed'), gitInfo[single].err);
      process.exit(-1);
    }
    gitInfo[single] = gitInfo[single].stdout.trim();
  });
  return gitInfo;
};

// helper to submit reports

const submitReport = report => {
  report.endTime = Date.now();
  const logFile = path.join(__dirname, 'deploy.log.json');
  co(function *() {
    console.log('Writing log to: ' + logFile);
    const jsonStr = JSON.stringify(report);
    yield [fs.writeFile(logFile, jsonStr), co(function *() {
      const res = yield fetch('http://bug.ofo.so/staticDeploymentLogV1',  { method: 'POST', body: jsonStr, headers: { 'Content-Type': 'application/json' } });
      const json = yield res.json();
      if (json.ack_startTime !== report.startTime) {
        throw new Error('Wrong ack: ' + JSON.stringify(json));
      }
    })];
  }).catch(err => {
    console.warn(colors.yellow('Failed to write log.'), err);
  });
};

// normalize process.env.NODE_ENV into currentEnvironment

let currentEnvironment = 'testing';

if (process.env.NODE_ENV) {
  switch (process.env.NODE_ENV.trim().toLowerCase()) {
    case 'dev':
    case 'test':
    case 'testing':
    case 'development':
      currentEnvironment = 'testing';
      break;
    case 'qa':
      currentEnvironment = 'qa';
      break;
    case 'apitest':
    case 'api-test':
      currentEnvironment = 'apitest';
      break;
    case 'qatest':
      currentEnvironment = 'qatest';
      break;
    case 'stage':
    case 'staged':
    case 'staging':
      currentEnvironment = 'staging';
      break;
    case 'prod':
    case 'production':
      currentEnvironment = 'production';
      break;
    default:
      currentEnvironment = null;
  }
}

// select proper configuration, and inform user

const configuration = ({
  'testing': { domain: 'testcommon.xxx.so', region: 'oss-cn-beijing', bucket: 'xx-test-static' },
  'qa': { domain: 'qa-common.xxx.so', region: 'oss-cn-shanghai', bucket: 'qacommon' },
  'apitest': { domain: 'qacommonapi.xxx.so', region: 'oss-cn-beijing', bucket: 'qacommonapi' },
  'qatest': { domain: 'qatestapi.xxx.so', region: 'oss-cn-beijing', bucket: 'qatestapi' },
  'staging': { domain: 'ofo-staging.xxx.so', region: 'oss-cn-beijing', bucket: 'xxx-staging' },
  'production': { domain: 'common.xxx.so', region: 'oss-cn-qingdao', bucket: 'xxx-static' }
})[currentEnvironment];

if (!configuration) {
  console.error(colors.red('FATAL: No valid target environment specified. Specify it via NODE_ENV or leave it empty for testing environment.'));
  process.exit(-1);
}

console.warn(colors.yellow('CAUTION: Pushing to ' + currentEnvironment.toUpperCase() + ' (' + configuration.domain + ') because NODE_ENV is set so.' ));

// initialize Aliyun SDKs

const client = new OSS({
  region: configuration.region,
  accessKeyId: 'xxxx',
  accessKeySecret: 'xxx',
  bucket: configuration.bucket
});

const cdn = new CDN({
  accessKeyId: 'xxx',
  secretAccessKey: 'xxx',
  endpoint: 'https://cdn.aliyuncs.com'
});

// a helper function to select between normal upload and multipart upload

const SIZE_THRESHOLD = 512 * 1024; // size threshold: any file larger than this size will be uploaded using a multi-part strategy

const smartUpload = function* (name, file) {
  const stats = yield fs.stat(file);
  return yield ((stats.size <= SIZE_THRESHOLD) ? (client.put(name, file)) : (client.multipartUpload(name, file, { progress: function* (p) { console.log(Math.round(100 * p) + ' is done for ' + name); } })));
};

module.exports = (remotePrefix, localPrefix, deleteOldFiles) => {

  // normalize input

  if (require('fs').statSync(localPrefix).isDirectory() && !remotePrefix.endsWith('/')) {
    remotePrefix += '/';
  }

  // prepare the report

  const report = {
    osInfo: {
      home: os.homedir(),
      type: os.type(),
      release: os.release()
    },
    startTime: Date.now(),
    remotePrefix,
    localPrefix,
    configuration
  };

  co(function *() {

    report.gitInfo = yield currentGitInfo();

    // get information of existing files on OSS

    const lsResult = yield client.list({
      prefix: remotePrefix // won't remove the root file without slash, but it's a small bug, won't fix it
    });
    const oldList = {};
    if (lsResult.objects) {
      lsResult.objects.forEach(entry => {
        const matched = entry.etag.match(/^"([A-F0-9]{32})"$/);
        if (matched) {
          oldList[entry.name] = matched[1];
        } else {
          console.warn("Unexpected ETag of " + entry.name + ": " + entry.etag);
        }
      });
    }
    consoleTitle('List of existing remote files:');
    console.log(oldList);
    const files = yield fs.walk(localPrefix);

    // list local files and upload them

    consoleTitle('Uploading starting...');
    const results = flattenDeep(yield (files.map(file => co(function *() {
      const relPath = path.relative(localPrefix, file);
      const remotePath = remotePrefix + relPath;
      const basename = path.basename(file);
      const isIndex = ['index.html', 'index.htm'].some(index => basename === index);
      const targetExtraBare = isIndex ? path.dirname(remotePath) : null;
      const targetExtra = isIndex ? targetExtraBare + '/' : null;
      if (remotePath in oldList) {
        const localMd5 = yield md5File(file);
        const remoteMd5 = oldList[remotePath];
        delete oldList[remotePath];
        if (isIndex) {
          delete oldList[targetExtra];
          delete oldList[targetExtraBare];
        }
        if (remoteMd5.toLowerCase() === localMd5.toLowerCase()) {
          console.log(file);
          console.log('  Skipped as MD5 coincides: ' + localMd5);
          return [];
        }
      }
      console.log(file);
      console.log('  -> ' + remotePath);
      if (isIndex) { // special handling: direct foo and foo/ to foo/index.html if there is one
        console.log('  -> ' + targetExtra);
        console.log('  Set up redirection: ' + targetExtraBare + ' -> ' + targetExtra);
        const redirectionStr = '<html><head><meta http-equiv="refresh" content="1;url=/' + targetExtra + '" /><script type="text/javascript">window.location.replace("/' + targetExtra + '" + window.location.search + window.location.hash);</script></head><body>Please wait for <a href="/' + targetExtra + '">redirection</a>.</body></html>';
        return yield [
          smartUpload(targetExtra, file),
          client.put(remotePath, new Buffer(redirectionStr), {'headers': { 'Content-Type': 'text/html'}, 'mime': 'text/html'}),
          client.put(targetExtraBare, new Buffer(redirectionStr), {'headers': { 'Content-Type': 'text/html'}, 'mime': 'text/html'})
        ];
      } else {
        return yield smartUpload(remotePath, file);
      }
    }))));
    consoleTitle('Uploaded successfully.');
    consoleTitle('Listed below are original results.');
    console.log(results);
    report.uploadedFiles = results.map(_ => _.name);
    consoleTitle('Listed above are original results.');
    consoleTitle('Uploaded successfully.');

    // handle remote files that no longer exists locally

    const filesToDelete = Object.keys(oldList);
    if (filesToDelete.length) {
      consoleTitle('Some remote files no longer exists locally:');
      console.log(filesToDelete);
      if (deleteOldFiles) {
        const result = yield client.deleteMulti(filesToDelete);
        consoleTitle('As requested, those files are removed.');
        console.log(result);
        report.deletedFiles = filesToDelete;
      }
    }
    consoleTitle('Now we are going to refresh CDN.');
    return yield cdn.refreshDir(configuration.domain + (remotePrefix.startsWith('/') ? '': '/') + remotePrefix);

  }).then(result => {
    consoleTitle('CDN refreshed successfully.');
    consoleTitle('Listed below are original result.');
    console.log(result.data);
    report.cdnRefreshTask = result.data.RefreshTaskId;
    consoleTitle('Listed above are original result.');
    consoleTitle('CDN refreshed successfully.');
    submitReport(report);
  }).catch(err => {
    console.error(colors.red('ERROR: ' + err.stack));
    report.errorMessage = err.message || err.toString();
    report.errorStack = err.stack;
    submitReport(report);
  });

};

