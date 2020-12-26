function renderTerms({html}) {
  return html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="referrer" content="no-referrer">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Terms of service</title>
      </head>
      <body style="margin: 0 auto; max-width: 640px;">
        <header>
          <style>
            h1 {
              font-size: 1.5em;
              padding: 0;
              margin: 0;
            }
            header {
              margin-block-end: 0.5em;
            }
          </style>
          <h1>Terms of service</h1>
          Thanks for coming to read the terms of service.<br>
          If anything is wrong, or if you have suggestions, please <a href="https://github.com/yingted/ytcc2/issues/new">report an issue</a>.
        </header>

        <main>
          <h2>These terms</h2>
          <ul>
            <li>This website provides file sharing services for captions.</li>
            <li>These terms may be updated at any time. For example, to add a legalese version.</li>
            <li>If you don't agree to them, don't use this website.</li>
            <li>You need to be at least 13 years old (16 in Europe), and also old enough to accept these terms.</li>
          </ul>

          <h2>Don't rely on this website</h2>
          <ul>
            <li>There is no guarantee this website can do anything useful, or does not do anything harmful.</li>
            <li>The website admin can change anything at any time.</li>
            <li>This website can have bugs, errors, omissions, and other problems.</li>
            <li>This website can be taken down, given to somebody else, or hacked at any time.</li>
          </ul>

          <h2>Uploading captions (Share button)</h2>
          <ul>
            <li>Don't upload anything illegal. For example, violating copyright.</li>
            <li>Don't upload personal data.</li>
            <li>Opening a captions file doesn't upload your captions.</li>
            <li>Uploading is optional. You can also save your captions to a file you can send privately.</li>
          </ul>

          <h2>Other people's videos, captions, and websites</h2>
          <ul>
            <li>This website is not responsible for other people's content.</li>
            <li>The captions viewer shows captions from YouTube and captions uploaded by other users.</li>
            <li>The captions viewer includes a YouTube video player, which plays YouTube videos from other users.</li>
            <li>This website has links to other websites, managed by other people.</li>
          </ul>

          <h2>Your copyrights</h2>
          <ul>
            <li>Only upload data you have copyright to.</li>
            <li>You give this website the right to publish your uploads forever, until you delete it.</li>
            <li>Even if you delete your upload, someone else could have copied it.</li>
            <li>If someone else uploaded your stuff, contact the website to take it down.</li>
          </ul>

          <h2>This website's copyrights</h2>
          <ul>
            <li>The code for this website is <a href="https://github.com/yingted/ytcc2">available on GitHub</a>.</li>
            <li>The license is in the link.</li>
            <li>This website's copyrights don't apply to the embedded videos, uploaded captions, or other linked websites.</li>
          </ul>

          <h2>Your privacy</h2>
          <ul>
            <li>
              The YouTube enables YouTube tracking when you play the video.
              You can still use the captions editor without playing the video.
            </li>
            <li>The captions editor uses your browser language to pick the captions to load and the language to publish in.</li>
            <li>
              The captions editor uses cookies to let you delete your captions after uploading them.
              If you clear your cookies, you lose this ability.
            </li>
          </ul>

          <h2>Enforcement</h2>
          <ul>
            <li>
              The website admin can do anything to enforce these terms.
              For example, delete content that looks like it's violating these terms, or just down the whole website.
            </li>
          </ul>
        </main>
      </body>
    </html>
  `;
}

module.exports = {
  renderTerms,
};