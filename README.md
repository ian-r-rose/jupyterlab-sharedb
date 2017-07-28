# jupyterlab-sharedb

Realtime collaboration for JupyterLab through ShareDB.

## Prerequisites

* JupyterLab 0.26.1

## Installation

To install this extension into JupyterLab (requires node 5 or later), do the following:

## Development

For a development install, do the following in the repository directory:

```bash
npm install
npm run build
jupyter labextension link .
```

To rebuild the package and the JupyterLab app after making changes:

```bash
npm run build
jupyter lab build
```
