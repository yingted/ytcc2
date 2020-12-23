function renderFooter({html}) {
  return html`
    <footer>
      <style>
        footer ul {
          margin: 0;
          padding: 0;
        }
        footer ul li {
          display: inline-block;
          padding: 0 0.5em;
        }
        footer ul li a[href] {
          display: inline-block;
          padding: calc(var(--touch-target-size) / 2 - 0.5em) 0;
        }
      </style>
      <hr>
      <ul>
        <li>
          <a href="https://github.com/yingted/ytcc2/issues/new">Report an issue</a>
        </li>
        <li>
          <a href="/terms">Terms of service</a>
        </li>
      </ul>
    </footer>
  `;
}

module.exports = {
  renderFooter,
};
