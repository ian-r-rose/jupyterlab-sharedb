// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  Contents, Drive
} from '@jupyterlab/services';

import {
  ModelDB
} from '@jupyterlab/coreutils';

import {
  ShareModelDB
} from './modeldb';

/**
 * A contents manager that passes file operations to the server.
 *
 * This includes checkpointing with the normal file operations.
 */
export
class ShareDrive extends Drive implements Contents.IDrive {

  constructor() {
    super({ name: 'Share' });
  }

  get modelDBFactory(): ModelDB.IFactory {
    return {
      createNew: (path: string) => {
        return new ShareModelDB();
      }
    }
  }
}
