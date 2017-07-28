// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  JSONValue, PromiseDelegate
} from '@phosphor/coreutils';

import {
  DisposableSet
} from '@phosphor/disposable';

import {
  IModelDB, IObservableValue, ObservableValue, IObservableString, 
  IObservable, IObservableUndoableList, IObservableJSON,
  ObservableMap, ObservableJSON
} from '@jupyterlab/coreutils';

import {
  ShareString
} from './string';

import {
  ShareUndoableList
} from './undoablelist';

declare let require: any;
let sharedb = require('sharedb/lib/client');

/**
 * A concrete implementation of an `IModelDB`.
 */
export
class ShareModelDB implements IModelDB {
  /**
   * Constructor for the `ShareModelDB`.
   */
  constructor(options: ShareModelDB.ICreateOptions = {}) {
    this._basePath = options.basePath || '';
    if (options.baseDB) {
      this._db = options.baseDB;
    } else {
      this._db = new ObservableMap<IObservable>();
      this._toDispose = true;
    }
    let socket = new WebSocket('ws://localhost:8080');
    let connection = new sharedb.Connection(socket);
    this._doc = connection.get('examples', 'textarea');
    this._doc.subscribe( () => {
      this._connected.resolve(void 0);
    });
  }

  /**
   * The base path for the `ModelDB`. This is prepended
   * to all the paths that are passed in to the member
   * functions of the object.
   */
  get basePath(): string {
    return this._basePath;
  }

  /**
   * Whether the database is disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Whether the model has been populated with
   * any model values.
   */
  readonly isPrepopulated: boolean = false;

  /**
   * Whether the model is collaborative.
   */
  readonly isCollaborative: boolean = true;

  /**
   * A promise resolved when the model is connected
   * to its backend. For the in-memory ModelDB it
   * is immediately resolved.
   */
  get connected(): Promise<void> {
    return this._connected.promise;
  }

  /**
   * Get a value for a path.
   *
   * @param path: the path for the object.
   *
   * @returns an `IObservable`.
   */
  get(path: string): IObservable | undefined {
    return this._db.get(this._resolvePath(path));
  }

  /**
   * Whether the `IModelDB` has an object at this path.
   *
   * @param path: the path for the object.
   *
   * @returns a boolean for whether an object is at `path`.
   */
  has(path: string): boolean {
    return this._db.has(this._resolvePath(path));
  }

  /**
   * Create a string and insert it in the database.
   *
   * @param path: the path for the string.
   *
   * @returns the string that was created.
   */
  createString(path: string): IObservableString {
    let str = new ShareString(this._doc, this.fullPath(path).split('.'));
    this._disposables.add(str);
    this.set(path, str);
    return str;
  }

  /**
   * Create an undoable list and insert it in the database.
   *
   * @param path: the path for the list.
   *
   * @returns the list that was created.
   *
   * #### Notes
   * The list can only store objects that are simple
   * JSON Objects and primitives.
   */
  createList<T extends JSONValue>(path: string): IObservableUndoableList<T> {
    let vec = new ShareUndoableList<T>(this._doc, this.fullPath(path).split('.'));
    this._disposables.add(vec);
    this.set(path, vec);
    return vec;
  }

  /**
   * Create a map and insert it in the database.
   *
   * @param path: the path for the map.
   *
   * @returns the map that was created.
   *
   * #### Notes
   * The map can only store objects that are simple
   * JSON Objects and primitives.
   */
  createMap(path: string): IObservableJSON {
    let map = new ObservableJSON();
    this._disposables.add(map);
    this.set(path, map);
    return map;
  }

  /**
   * Create an opaque value and insert it in the database.
   *
   * @param path: the path for the value.
   *
   * @returns the value that was created.
   */
  createValue(path: string): IObservableValue {
    let val = new ObservableValue();
    this._disposables.add(val);
    this.set(path, val);
    return val;
  }

  /**
   * Get a value at a path, or `undefined if it has not been set
   * That value must already have been created using `createValue`.
   *
   * @param path: the path for the value.
   */
  getValue(path: string): JSONValue | undefined {
    let val = this.get(path);
    if (!val || val.type !== 'Value') {
      throw Error('Can only call getValue for an ObservableValue');
    }
    return (val as ObservableValue).get();
  }

  /**
   * Set a value at a path. That value must already have
   * been created using `createValue`.
   *
   * @param path: the path for the value.
   *
   * @param value: the new value.
   */
  setValue(path: string, value: JSONValue): void {
    let val = this.get(path);
    if (!val || val.type !== 'Value') {
      throw Error('Can only call setValue on an ObservableValue');
    }
    (val as ObservableValue).set(value);
  }


  /**
   * Create a view onto a subtree of the model database.
   *
   * @param basePath: the path for the root of the subtree.
   *
   * @returns an `IModelDB` with a view onto the original
   *   `IModelDB`, with `basePath` prepended to all paths.
   */
  view(basePath: string): ShareModelDB {
    let view = new ShareModelDB({basePath, baseDB: this});
    this._disposables.add(view);
    return view;
  }

  /**
   * Set a value at a path. Not intended to
   * be called by user code, instead use the
   * `create*` factory methods.
   *
   * @param path: the path to set the value at.
   *
   * @param value: the value to set at the path.
   */
  set(path: string, value: IObservable): void {
    this._db.set(this._resolvePath(path), value);
  }

  /**
   * Dispose of the resources held by the database.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._isDisposed = true;
    if (this._toDispose) {
      this._db.dispose();
    }
    this._disposables.dispose();
  }

  /**
   * Compute the fully resolved path for a path argument.
   *
   * @param path: a path for the current view on the model.
   *
   * @returns a fully resolved path on the base model database.
   */
  fullPath(path: string): string {
    if (! (this._db as any).type) {
      return (this._db as ShareModelDB).fullPath(this._basePath + '.' + path);
    } else {
      return path;
    }
  }

  /**
   * Compute the fully resolved path for a path argument.
   */
  private _resolvePath(path: string): string {
    if (this._basePath) {
      path = this._basePath + '.' + path;
    }
    return path;
  }

  private _basePath: string;
  private _db: ShareModelDB | ObservableMap<IObservable>;
  private _toDispose = false;
  private _isDisposed = false;
  private _disposables = new DisposableSet();
  private _connected = new PromiseDelegate<void>();
  private _doc: any;
}

/**
 * A namespace for the `ModelDB` class statics.
 */
export
namespace ShareModelDB {
  /**
   * Options for creating a `ModelDB` object.
   */
  export
  interface ICreateOptions {
    /**
     * The base path to prepend to all the path arguments.
     */
    basePath?: string;

    /**
     * A ModelDB to use as the store for this
     * ModelDB. If none is given, it uses its own store.
     */
    baseDB?: ShareModelDB;
  }
}
