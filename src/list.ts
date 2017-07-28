// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  JSONExt, JSONValue
} from '@phosphor/coreutils';

import {
  ArrayExt, ArrayIterator, IIterator, IterableOrArrayLike, each
} from '@phosphor/algorithm';

import {
  ISignal, Signal
} from '@phosphor/signaling';

import {
  IObservableList
} from '@jupyterlab/coreutils';

/**
 * A concrete implementation of [[IObservableList]].
 */
export
class ShareList<T extends JSONValue> implements IObservableList<T> {
  /**
   * Construct a new observable map.
   */
  constructor(shareDoc: any, path: Array<string | number>) {
    this._shareDoc = shareDoc;
    this._path = path;
    this._shareDoc.on('op', this._onOp.bind(this));
    this._shareDoc.on('load', () => {
      this._preparePath(this._path);
      let pathExists = true;
      let current = this._shareDoc.data;
      for (let component of this._path) {
        if (!current[component]) {
          pathExists = false;
          break;
        }
        current = current[component];
      }
      if (pathExists) {
      } else {
        this._shareDoc.submitOp({p: this._path, oi: []});
      }
    });
    this._itemCmp = JSONExt.deepEqual;
  }

  /**
   * The type of this object.
   */
  get type(): 'List' {
    return 'List';
  }

  /**
   * A signal emitted when the list has changed.
   */
  get changed(): ISignal<this, IObservableList.IChangedArgs<T>> {
    return this._changed;
  }

  get array(): T[] {
    if (this._shareDoc.data) {
      let current = this._shareDoc.data;
      for (let component of this._path) {
        current = current[component];
      }
      return current;
    } else {
      return [];
    }
  }

  /**
   * The length of the list.
   */
  get length(): number {
    return this.array.length;
  }

  /**
   * Test whether the list has been disposed.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Dispose of the resources held by the list.
   */
  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    Signal.clearData(this);
  }


  /**
   * Create an iterator over the values in the list.
   *
   * @returns A new iterator starting at the front of the list.
   *
   * #### Complexity
   * Constant.
   *
   * #### Iterator Validity
   * No changes.
   */
  iter(): IIterator<T> {
    return new ArrayIterator(this.array);
  }

  /**
   * Get the value at the specified index.
   *
   * @param index - The positive integer index of interest.
   *
   * @returns The value at the specified index.
   *
   * #### Undefined Behavior
   * An `index` which is non-integral or out of range.
   */
  get(index: number): T | undefined {
    return this.array[index];
  }

  /**
   * Set the value at the specified index.
   *
   * @param index - The positive integer index of interest.
   *
   * @param value - The value to set at the specified index.
   *
   * #### Complexity
   * Constant.
   *
   * #### Iterator Validity
   * No changes.
   *
   * #### Undefined Behavior
   * An `index` which is non-integral or out of range.
   */
  set(index: number, value: T): void {
    if (this._shareDoc.connection.state === 'connecting') {
      return;
    }
    let oldValue = this.array[index];
    if (value === undefined) {
      throw new Error('Cannot set an undefined item');
    }
    // Bail if the value does not change.
    let itemCmp = this._itemCmp;
    if (itemCmp(oldValue, value)) {
      return;
    }
    this._shareDoc.submitOp({
      p: [...this._path, index],
      ld: oldValue,
      li: value
    });
  }

  /**
   * Add a value to the end of the list.
   *
   * @param value - The value to add to the end of the list.
   *
   * @returns The new length of the list.
   *
   * #### Complexity
   * Constant.
   *
   * #### Iterator Validity
   * No changes.
   */
  push(value: T): number {
    if (this._shareDoc.connection.state === 'connecting') {
      return;
    }
    let len = this.length;
    this._shareDoc.submitOp({
      p: [...this._path, len],
      li: value
    });
    return len+1;
  }

  /**
   * Insert a value into the list at a specific index.
   *
   * @param index - The index at which to insert the value.
   *
   * @param value - The value to set at the specified index.
   *
   * #### Complexity
   * Linear.
   *
   * #### Iterator Validity
   * No changes.
   *
   * #### Notes
   * The `index` will be clamped to the bounds of the list.
   *
   * #### Undefined Behavior
   * An `index` which is non-integral.
   */
  insert(index: number, value: T): void {
    if (this._shareDoc.connection.state === 'connecting') {
      return;
    }
    this._shareDoc.submitOp({
      p: [...this._path, index],
      li: value
    });
  }

  /**
   * Remove the first occurrence of a value from the list.
   *
   * @param value - The value of interest.
   *
   * @returns The index of the removed value, or `-1` if the value
   *   is not contained in the list.
   *
   * #### Complexity
   * Linear.
   *
   * #### Iterator Validity
   * Iterators pointing at the removed value and beyond are invalidated.
   */
  removeValue(value: T): number {
    if (this._shareDoc.connection.state === 'connecting') {
      return -1;
    }
    let itemCmp = this._itemCmp;
    let index = ArrayExt.findFirstIndex(this.array, item => {
      return itemCmp(item, value);
    });
    this.remove(index);
    return index;
  }

  /**
   * Remove and return the value at a specific index.
   *
   * @param index - The index of the value of interest.
   *
   * @returns The value at the specified index, or `undefined` if the
   *   index is out of range.
   *
   * #### Complexity
   * Constant.
   *
   * #### Iterator Validity
   * Iterators pointing at the removed value and beyond are invalidated.
   *
   * #### Undefined Behavior
   * An `index` which is non-integral.
   */
  remove(index: number): T | undefined {
    if (this._shareDoc.connection.state === 'connecting') {
      return;
    }
    if (index < 0 || index >= this.length) {
      return undefined;
    }
    let oldValue = this.array[index];
    this._shareDoc.submitOp({
      p: [...this._path, index],
      ld: oldValue
    });
    return oldValue;
  }

  /**
   * Remove all values from the list.
   *
   * #### Complexity
   * Linear.
   *
   * #### Iterator Validity
   * All current iterators are invalidated.
   */
  clear(): void {
    if (this._shareDoc.connection.state === 'connecting') {
      return;
    }
    while (this.length) {
      this.remove(0);
    }
  }

  /**
   * Move a value from one index to another.
   *
   * @parm fromIndex - The index of the element to move.
   *
   * @param toIndex - The index to move the element to.
   *
   * #### Complexity
   * Constant.
   *
   * #### Iterator Validity
   * Iterators pointing at the lesser of the `fromIndex` and the `toIndex`
   * and beyond are invalidated.
   *
   * #### Undefined Behavior
   * A `fromIndex` or a `toIndex` which is non-integral.
   */
  move(fromIndex: number, toIndex: number): void {
    if (this._shareDoc.connection.state === 'connecting') {
      return;
    }
    if (this.length <= 1 || fromIndex === toIndex) {
      return;
    }
  }

  /**
   * Push a set of values to the back of the list.
   *
   * @param values - An iterable or array-like set of values to add.
   *
   * @returns The new length of the list.
   *
   * #### Complexity
   * Linear.
   *
   * #### Iterator Validity
   * No changes.
   */
  pushAll(values: IterableOrArrayLike<T>): number {
    if (this._shareDoc.connection.state === 'connecting') {
      return 0;
    }
    let idx = this.length;
    each(values, value => {
      this._shareDoc.submitOp({
        p: [...this._path, idx++],
        li: value
      });
    });
    return this.length;
  }

  /**
   * Insert a set of items into the list at the specified index.
   *
   * @param index - The index at which to insert the values.
   *
   * @param values - The values to insert at the specified index.
   *
   * #### Complexity.
   * Linear.
   *
   * #### Iterator Validity
   * No changes.
   *
   * #### Notes
   * The `index` will be clamped to the bounds of the list.
   *
   * #### Undefined Behavior.
   * An `index` which is non-integral.
   */
  insertAll(index: number, values: IterableOrArrayLike<T>): void {
    if (this._shareDoc.connection.state === 'connecting') {
      return;
    }
    let idx = index;
    each(values, value => {
      this._shareDoc.submitOp({
        p: [...this._path, idx++],
        li: value
      });
    });
  }

  /**
   * Remove a range of items from the list.
   *
   * @param startIndex - The start index of the range to remove (inclusive).
   *
   * @param endIndex - The end index of the range to remove (exclusive).
   *
   * @returns The new length of the list.
   *
   * #### Complexity
   * Linear.
   *
   * #### Iterator Validity
   * Iterators pointing to the first removed value and beyond are invalid.
   *
   * #### Undefined Behavior
   * A `startIndex` or `endIndex` which is non-integral.
   */
  removeRange(startIndex: number, endIndex: number): number {
    if (this._shareDoc.connection.state === 'connecting') {
      return 0;
    }
    for (let i = startIndex; i < endIndex; i++) {
      this.remove(startIndex);
    }
    return this.length;
  }

  private _preparePath(path: Array<number | string>): void {
    let current = this._shareDoc.data;
    let currentPath = [];
    for (let i = 0; i < this._path.length - 1; ++i) {
      let component = this._path[i];
      currentPath.push(component);
      if (!current[component]) {
        this._shareDoc.submitOp({p: currentPath, oi: {}});
      }
      current = current[component];
    }
  }

  private _onOp(ops: any, isLocal: boolean) {
    if (ops.length === 0) {
      return;
    } else if (ops.length > 1) {
      throw Error('Unexpected number of ops');
    }
    let op = ops[0];
    if (!isSubpath(this._path, op.p)) {
      return;
    }

    let idx = op.p.pop();
    if (op.li !== undefined && op.ld !== undefined) { // Set case.
      this._changed.emit({
        type: 'set',
        oldIndex: idx,
        newIndex: idx,
        oldValues: [op.ld],
        newValues: [op.li]
      });
    } else if (op.li !== undefined) { // Insert case.
      this._changed.emit({
        type: 'add',
        oldIndex: -1,
        newIndex: idx,
        oldValues: [],
        newValues: [op.li]
      });
    } else if (op.ld !== undefined) { // Delete case.
      this._changed.emit({
        type: 'remove',
        oldIndex: idx,
        newIndex: -1,
        oldValues: [op.ld],
        newValues: []
      });
    } else if (op.lm !== undefined) { // Move case.
      this._changed.emit({
        type: 'move',
        oldIndex: idx,
        newIndex: op.lm,
        oldValues: [this.array[op.lm]],
        newValues: [this.array[op.lm]]
      });
    }
  }

  private _isDisposed = false;
  private _itemCmp: (first: T, second: T) => boolean;
  private _changed = new Signal<this, IObservableList.IChangedArgs<T>>(this);
  private _shareDoc: any;
  private _path: any[];
}


function isSubpath(subpath: Array<number | string>, path: Array<number | string>): boolean {
  if (subpath.length > path.length) {
    return false;
  }
  for (let i = 0; i < subpath.length; ++i) {
    if (subpath[i] !== path[i]) {
      return false;
    }
  }
  return true;
}
