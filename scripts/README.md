Scripts for development use
====

This directory contains scripts which is useful for development use.

`css-checker`
----

**`index.js`**: Check `webapp` directory to see if any classes appeared in LESS stylesheets are never actually used. There might be some false negatives, and very few false positives.

**`check_image.js`**: Check `webapp` directory to see if any images appeared in `images` s are never actually referred from LESS. Notice: Lot of false positives now.

`deploy`
----

The `deploy/index.js` is a module used to upload compiled static resources to our Aliyun server. It provide a single function accepting remote and local paths as parameters (firstly `npm install` in repository root directory). 

Each directory under the project root is, however, encouraged to include a standalone `deploy.js`, even if it only includes one line.

WARNING: Deployment scripts are not tested under Windows. It is likely that it will work WRONGLY under windows.
