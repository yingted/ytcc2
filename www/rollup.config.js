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
import copy from 'rollup-plugin-copy';
let {listLanguages} = require('./youtube_trusted.js');

// `npm run build` -> `production` is true
// `npm run dev` -> `production` is false
const production = !process.env.ROLLUP_WATCH;

/**
 * rollup plugin to generate YouTube languages.
 */
function generateLanguages() {
  return {
    name: 'generate-languages',
    async generateBundle() {
      let languages = await listLanguages();
      this.emitFile({
        type: 'asset',
        fileName: 'gen/youtube_languages.js',
        source: `export const youtubeLanguages = ${JSON.stringify(languages)};`,
      });
    },
  };
}

export default {
  input: 'main.js',
  output: {
    file: 'static/main.bundle.js',
    format: 'iife', // immediately-invoked function expression — suitable for <script> tags
    sourcemap: true
  },
  plugins: [
    resolve(), // tells Rollup how to find node_modules
    commonjs(),
    copy({
      targets: [
        { src: './node_modules/dialog-polyfill/dist/dialog-polyfill.css', dest: 'static/dialog-polyfill/' },
      ],
    }),
    generateLanguages(),
    production && terser(), // minify, but only in production
    !production && livereload({ delay: 200 }),  // livereload, only in dev
  ]
};
