ofo-uwsr
====

"UWSR" stands for "unified web static resources". Web app, campaign pages and web resources shared among three platforms will be put here.

Projects, however, should be built independently and deployed independently.

Directories (projects)
----

Directories directly inside the root directory of this repository (except `scripts`) are called projects, and they should each provide a `README.md`, consisting of:

- A `<H1>` title showing the name of the directory
- Description of the use of that directory
- How to build / compile that project (if applicable)
- How to upload / deploy that project (if applicable)

It is also recommended to put real source files inside a `src` subdirectory, and a `deploy.js` deployment script.

Tool scripts
----

An exception is `scripts` directory. `scripts` directory contains tool scripts which are helpful to development process. See `scripts/README.md` for details.

Code style
----

Refer to `code_style.md` for code style recommendations.

在common里webpack
在webapp里webpack
在localstorage里 setItem('tokend', '');
