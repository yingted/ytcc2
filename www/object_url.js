export class ObjectUrl {
  constructor() {
    this._keySingleton = new WeakSet();
    this._url = null;
  }
  create(key, makeBlob) {
    // Dedupe calls:
    if (this._keySingleton.has(key)) {
      return this._url;
    }

    // Free the previous URL:
    this._keySingleton = new WeakSet();
    if (this._url !== null) {
      URL.revokeObjectURL(this._url);
    }

    // Make a new URL:
    this._keySingleton.add(key);
    this._url = URL.createObjectURL(makeBlob());
    return this._url;
  }
}
