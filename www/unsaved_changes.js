let unsavedCount = 0;
class UnsavedChanges {
  constructor() {
    this._isSet = false;
  }
  set() {
    if (this._isSet) return;
    this._isSet = true;
    ++unsavedCount;
    if (unsavedCount === 1) {
      window.onbeforeunload = function(e) {
        e.preventDefault();
        e.returnValue = '';
      };
    }
  }
  clear() {
    if (!this._isSet) return;
    this._isSet = false;
    --unsavedCount;
    if (unsavedCount === 0) {
      window.onbeforeunload = null;
    }
  }
}
export function newUnsavedChanges() {
  return new UnsavedChanges();
}
