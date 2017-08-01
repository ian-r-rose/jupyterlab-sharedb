// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  ISignal, Signal
} from '@phosphor/signaling';

import {
  IObservableString, ObservableString
} from '@jupyterlab/coreutils';

import {
  SharePrimitive, isSubpath
} from './share';


/**
 * A concrete implementation of an [[IObservableString]]
 * that supports collaborative editing through ShareDB.
 */
export
class ShareString extends SharePrimitive implements IObservableString {
  constructor(shareDoc: any, path: Array<string | number>) {
    super(shareDoc, path);
    this._str.changed.connect(this._onChange, this);
    this.connected.then(() => {
      this._str.changed.disconnect(this._onChange, this);
      this._str.dispose();
      this._str = null;
    });
  }

  /**
   * The type of the Observable.
   */
  get type(): 'String' {
    return 'String';
  }

  /**
   * A signal emitted when the string has changed.
   */
  get changed(): ISignal<this, IObservableString.IChangedArgs> {
    return this._changed;
  }

  /**
   * Set the value of the string.
   */
  set text(value: string) {
    if (value.length === this.text.length && value === this.text) {
      return;
    }
    if (this._str) {
      this._str.text = value;
      return;
    }
    this.doc.submitOp({p: this.path, oi: value});
  }

  /**
   * Get the value of the string.
   */
  get text(): string {
    if (this._str) {
      return this._str.text;
    }
    return this.value;
  }

  /**
   * Insert a substring.
   *
   * @param index - The starting index.
   *
   * @param text - The substring to insert.
   */
  insert(index: number, text: string): void {
    if (this._str) {
      this._str.insert(index, text);
      return;
    }
    this.doc.submitOp({
      p: [...this.path, index],
      si: text
    });
  }

  /**
   * Remove a substring.
   *
   * @param start - The starting index.
   *
   * @param end - The ending index.
   */
  remove(start: number, end: number): void {
    if (this._str) {
      this._str.remove(start, end);
      return;
    }
    this.doc.submitOp({
      p: [...this.path, start],
      sd: this.text.slice(start,end)
    });
  }

  /**
   * Set the ShareString to an empty string.
   */
  clear(): void {
    this.text = '';
  }

  /**
   * Test whether the string has been disposed.
   */
  get isDisposed(): boolean {
    return false;
  }

  /**
   * Dispose of the resources held by the string.
   */
  dispose(): void {
  }
  
  protected copyFromDoc(): void {
    let value: string = this.value;
    this._changed.emit({
      type: 'set',
      start: 0,
      end: value.length,
      value: value
    });
  }

  protected copyToDoc(): void {
    this.doc.submitOp({p: this.path, oi: this._str.text});
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

    let last = op.p.slice(-1).pop();
    if (op.oi !== undefined) { // Set case.
      this._changed.emit({
        type: 'set',
        start: 0,
        end: op.oi.length,
        value: op.oi
      });
    } else if (op.si) { // Insert case.
      this._changed.emit({
        type: 'insert',
        start: last,
        end: last + op.si.length,
        value: op.si
      });
    } else if (op.sd) { //Delete case.
      this._changed.emit({
        type: 'remove',
        start: last,
        end: last + op.sd.length,
        value: op.sd
      });
    }
  }

  private _onChange(source: ObservableString, args: IObservableString.IChangedArgs): void {
    this._changed.emit(args);
  }
    

  private _changed = new Signal<this, IObservableString.IChangedArgs>(this);
  private _str: ObservableString | null = new ObservableString();
}
