/**
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {render, directive} from 'lit-html';

/**
 * Generate a non-crypto-secure random UUID.
 * @returns {string} uuid a random UUID in compact hex format
 */
export function randomUuid() {
  for (
    var result = '';
    result.length * 4 < 128;
    result += Math.floor(Math.random() * 16).toString(16));
  return result;
};

/**
 * Usage: html`<div @render=${onRender(f)}></div>`
 * `f` receives the target element as "this"
 * @param {function} f the function to run on render
 */
export const onRender = directive(f => part => {
  f.call(part.element);
});

/**
 * An AsyncRef<T> represents a mutable T.
 * For example, AsyncRef<string> can represent document.querySelector('input').value.
 *
 * @template T
 * @example
 * r = new AsyncRef(x0);
 * x1 = r.value;
 * r.value = x2;
 * for async (let xi of r.observe()) {
 *   break;
 * }
 * template = html`${asyncReplace(r.observe())}`;
 */
export class AsyncRef {
  constructor(value) {
    this._value = value;
    this._callbacks = [];
  }
  /**
   * @returns {T}
   */
  get value() {
    return this._value;
  }
  /**
   * @param {T} x
   */
  set value(x) {
    this._value = x;
    let callbacks = this._callbacks;
    this._callbacks = [];
    for (let callback of callbacks) {
      callback(x);
    }
  }
  /**
   * @returns {Promise<T>}
   */
  nextValue() {
    return new Promise(resolve => {
      this._callbacks.push(resolve);
    });
  }
  /**
   * Iterate through all changes, but debounce events if the iteration is slow.
   * @returns {AsyncIterator<T>}
   */
  observeFuture() {
    let thiz = this;
    let queue = [];
    (function select() {
      let next = new Promise(resolve => {
        thiz._callbacks.push(x => {
          // Add the next promise:
          select();
          // Resolve this promise:
          resolve({value: x, done: false});
        });
      });
      queue.push(next);
      // Avoid having more than the most recent finished event and the next event:
      if (queue.length > 2) {
        queue = queue.slice(queue.length - 2);
      }
    })();

    return {
      [Symbol.asyncIterator]() {
        return {
          // Get the next event:
          next() {
            return queue.shift();
          }
        }
      }
    };
  }
  /**
   * @returns {AsyncIterator<T>}
   */
  async *observe() {
    yield this._value;
    yield* this.observeFuture();
  }
  /**
   * Transform this AsyncRef with a synchronous function.
   * Has a delay.
   */
  _map(func) {
    let ret = new AsyncRef(func(this._value));
    let thiz = this;
    (async function() {
      for await (let x of thiz.observeFuture()) {
        ret.value = func(x);
      }
    })();
    return ret;
  }

  /**
   * Transform this AsyncRef with a synchronous function.
   */
  map(func) {
    let ret = new AsyncRef(func(this._value));
    let thiz = this;
    (function select() {
      thiz._callbacks.push(function(x) {
        select();
        ret.value = func(x);
      });
    })();
    return ret;
  }
}

export class Signal {
  constructor() {
    this._handlers = [];
  }
  addListener(f) {
    if (this._handlers.indexOf(f) === -1) {
      this._handlers.push(f);
    }
  }
  removeListener(f) {
    let i = this._handlers.indexOf(f);
    if (i !== -1) {
      this._handlers.splice(i, 1);
    }
  }
  emit(x) {
    for (let cb of this._handlers) {
      cb.call(this, x);
    }
  }
}

export function render0(template) {
  const container = document.createElement('div');
  render(template, container);
  console.assert(container.firstElementChild === container.lastElementChild);
  return container.firstElementChild;
};
