// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  JSONValue, JSONExt
} from '@phosphor/coreutils';

import {
  ISignal, Signal
} from '@phosphor/signaling';

import {
  IObservableValue, ObservableValue
} from '@jupyterlab/coreutils';

import {
  SharePrimitive, isSubpath
} from './share';


/**
 * A concrete implementation of an [[IObservableValue]]
 * that supports collaborative editing through ShareDB.
 */
export
class ShareValue extends SharePrimitive implements IObservableValue {
  constructor(shareDoc: any, path: Array<string | number>) {
    super(shareDoc, path);
    this._val.changed.connect(this._onChange, this);
    this.connected.then(() => {
      this._val.changed.disconnect(this._onChange, this);
      this._val.dispose();
      this._val = null;
    });
  }

  /**
   * The type of the Observable.
   */
  get type(): 'Value' {
    return 'Value';
  }

  /**
   * A signal emitted when the string has changed.
   */
  get changed(): ISignal<this, ObservableValue.IChangedArgs> {
    return this._changed;
  }

  get(): JSONValue {
    if (this._val) {
      return this._val.get();
    }
    return this.value;
  }

  set(value: JSONValue): void {
    if (JSONExt.deepEqual(value, this.get())) {
      return;
    }
    if (this._val) {
      this._val.set(value);
      return; 
    }
    this.doc.submitOp({
      p: this.path,
      oi: value 
    });
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
    this._changed.emit({
      oldValue: this._val.get(),
      newValue: this.value
    });
  }

  protected copyToDoc(): void {
    this.doc.submitOp({p: this.path, oi: this._val.get()});
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

    if (op.oi !== undefined) { // Reset case.
      this._changed.emit({
        oldValue: op.od,
        newValue: op.oi
      });
    }
  }

  private _onChange(source: ObservableValue, args: ObservableValue.IChangedArgs): void {
    this._changed.emit(args);
  }
    

  private _changed = new Signal<this, ObservableValue.IChangedArgs>(this);
  private _val: ObservableValue | null = new ObservableValue();
}
