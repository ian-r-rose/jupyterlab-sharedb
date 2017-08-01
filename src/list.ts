// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  JSONExt, JSONValue
} from '@phosphor/coreutils';

import {
  ArrayExt, ArrayIterator, IIterator, IterableOrArrayLike, each, toArray
} from '@phosphor/algorithm';

import {
  ISignal, Signal
} from '@phosphor/signaling';

import {
  IObservableList, ObservableList
} from '@jupyterlab/coreutils';

import {
  SharePrimitive, isSubpath
} from './share';

/**
 * A concrete implementation of [[IObservableList]].
 */
export
class ShareList<T extends JSONValue> extends SharePrimitive implements IObservableList<T> {
  /**
   * Construct a new observable list.
   */
  constructor(shareDoc: any, path: Array<string | number>) {
    super(shareDoc, path);
    this._list.changed.connect(this._onChange, this);
    this.connected.then(() => {
      this._list.changed.disconnect(this._onChange, this);
      this._list.dispose();
      this._list = null;
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

  /**
   * The length of the list.
   */
  get length(): number {
    if (this._list) {
      return this._list.length;
    }
    return this.value.length;
  }

  /**
   * Dispose of the resources held by the list.
   */
  dispose(): void {
    Signal.clearData(this);
    super.dispose();
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
    if (this._list) {
      return this._list.iter();
    }
    return new ArrayIterator(this.value);
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
    if (this._list) {
      return this._list.get(index);
    }
    return this.value[index];
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
    if (this._list) {
      this._list.set(index, value);
      return;
    }

    let oldValue = this.value[index];
    if (value === undefined) {
      throw new Error('Cannot set an undefined item');
    }
    // Bail if the value does not change.
    let itemCmp = this._itemCmp;
    if (itemCmp(oldValue, value)) {
      return;
    }
    this.doc.submitOp({
      p: [...this.path, index],
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
    if (this._list) {
      return this._list.push(value);
    }
    let len = this.length;
    this.doc.submitOp({
      p: [...this.path, len],
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
    if (this._list) {
      this._list.insert(index, value);
      return;
    }
    this.doc.submitOp({
      p: [...this.path, index],
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
    if (this._list) {
      return this._list.removeValue(value);
    }
    let itemCmp = this._itemCmp;
    let index = ArrayExt.findFirstIndex(this.value, (item: T) => {
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
    if (this._list) {
      return this._list.remove(index);
    }
    if (index < 0 || index >= this.length) {
      return undefined;
    }
    let oldValue = this.value[index];
    this.doc.submitOp({
      p: [...this.path, index],
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
    if (this._list) {
      this._list.clear();
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
    if (this._list) {
      this._list.move(fromIndex, toIndex);
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
    if (this._list) {
      return this._list.pushAll(values);
    }
    let idx = this.length;
    each(values, value => {
      this.doc.submitOp({
        p: [...this.path, idx++],
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
    if (this._list) {
      return this._list.insertAll(index, values);
    }
    let idx = index;
    each(values, value => {
      this.doc.submitOp({
        p: [...this.path, idx++],
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
    if (this._list) {
      return this._list.removeRange(startIndex, endIndex);
    }
    for (let i = startIndex; i < endIndex; i++) {
      this.remove(startIndex);
    }
    return this.length;
  }

  protected onOp(ops: any, isLocal: boolean) {
    if (ops.length === 0) {
      return;
    } else if (ops.length > 1) {
      throw Error('Unexpected number of ops');
    }
    let op = ops[0];
    if (!isSubpath(this.path, op.p)) {
      return;
    }

    let idx = op.p.slice(-1)[0];
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
        oldValues: [this.value[op.lm]],
        newValues: [this.value[op.lm]]
      });
    }
  }

  protected copyFromDoc(): void {
    let value: any[] = this.value;
    this.clear();
    this._changed.emit({
      type: 'add',
      oldIndex: -1,
      newIndex: 0,
      oldValues: [],
      newValues: value
    });
  }

  protected copyToDoc(): void {
    this.doc.submitOp({
      p: this.path,
      oi: toArray(this._list)
    });
  }

  private _onChange(source: ObservableList<T>, args: IObservableList.IChangedArgs<T>): void {
    this._changed.emit(args);
  }

  private _itemCmp: (first: T, second: T) => boolean;
  private _changed = new Signal<this, IObservableList.IChangedArgs<T>>(this);
  private _list: ObservableList<T> | null = new ObservableList<T>();
}
