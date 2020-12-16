const {html} = require('@popeindustries/lit-html-server');

module.exports = {
  script(javascript) {
    return html`<script>${javascript.unsafeStaticJavascript}</script>`;
  }
};
