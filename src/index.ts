// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ILayoutRestorer, JupyterLab, JupyterLabPlugin
} from '@jupyterlab/application';

import {
  IDocumentManager
} from '@jupyterlab/docmanager';

import {
  IFileBrowserFactory
} from '@jupyterlab/filebrowser';

import {
  ShareDrive
} from './drive';

/**
 * ShareDrive filebrowser plugin state namespace.
 */
export
const NAMESPACE = 'sharedb-filebrowser';

/**
 * The JupyterLab plugin for the Google Drive Filebrowser.
 */
const fileBrowserPlugin: JupyterLabPlugin<void> = {
  id: 'jupyter.extensions.sharedb',
  requires: [IDocumentManager, IFileBrowserFactory, ILayoutRestorer],
  activate: activateFileBrowser,
  autoStart: true
};

/**
 * Activate the file browser.
 */
function activateFileBrowser(app: JupyterLab, manager: IDocumentManager, factory: IFileBrowserFactory, restorer: ILayoutRestorer): void {

  let { commands } = app;
  // Add the Google Drive backend to the contents manager.
  let drive = new ShareDrive();
  manager.services.contents.addDrive(drive);

  // Create the file browser.
  let browser = this._factory.createFileBrowser(NAMESPACE, {
    commands: commands,
    driveName: this._driveName
  });

    // Create the logout button.

  // Add the file browser widget to the application restorer.
  restorer.add(browser, NAMESPACE);
  app.shell.addToLeftArea(browser, { rank: 102 });

  return;
}

/**
 * Export the plugin as default.
 */
export default fileBrowserPlugin;
