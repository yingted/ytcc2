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

import resolve from '@rollup/plugin-node-resolve';
import {terser} from 'rollup-plugin-terser';
import livereload from 'rollup-plugin-livereload';
import commonjs from '@rollup/plugin-commonjs';
import {babel} from '@rollup/plugin-babel';
import copy from 'rollup-plugin-copy';
import execute from 'rollup-plugin-execute';
import ignore from 'rollup-plugin-ignore';
let {listLanguages} = require('./youtube_trusted.js');
let fs = require('fs').promises;

// `npm run build` -> `production` is true
// `npm run dev` -> `production` is false
const production = !process.env.ROLLUP_WATCH;

async function setContents(path, data) {
  let oldData = null;
  try {
    oldData = await fs.readFile(path, {encoding: 'utf-8'});
  } catch(e) {
  }
  if (data === oldData) return;

  if (data === null) {
    await fs.unlink(path);
  } else {
    await fs.writeFile(path, data);
  }
}

/**
 * rollup plugin to generate YouTube languages.
 */
function generateLanguages() {
  return {
    name: 'generate-languages',
    async buildStart() {
      let fs = require('fs').promises;
      let languages = await listLanguages();
      await setContents(
        __dirname + '/gen/youtube_languages.js',
        `export const youtubeLanguages = ${JSON.stringify(languages)};`);
    },
  };
}

export default [{
  input: 'main.js',
  output: {
    file: 'static/main.bundle.js',
    format: 'iife',
    sourcemap: true,
    globals: {
      crypto: 'undefined',
    },
  },
  plugins: [
    generateLanguages(),
    ignore([
      '@peculiar/webcrypto',
      'fastestsmallesttextencoderdecoder',
    ]),
    resolve({
      browser: true,
    }),
    commonjs(),
    babel({
      babelHelpers: 'bundled',
      exclude: [/node_modules/, /_trusted\.js/],
      presets: [
        ['@babel/preset-env', {
          // IE11 already doesn't work with a bunch of stuff, so let's just remove it
          targets: 'defaults, not ie 11',
          exclude: ['transform-regenerator'],
        }],
      ],
      plugins: [
        '@babel/plugin-proposal-class-properties',
      ],
    }),
    copy({
      targets: [
        { src: './node_modules/dialog-polyfill/dist/dialog-polyfill.css', dest: 'static/dialog-polyfill/' },
      ],
    }),
    production && terser(),
    production ? execute('precompress static/main.bundle.js') : execute('rm -f static/main.bundle.js.{br,gz}'),
    !production && livereload({
      watch: 'static/main.bundle.js',
    }),
  ]
}];
