#!/usr/bin/env python3
# Copyright 2020 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import dataclasses
import youtube_dl
import unittest.mock
import sys
import json

@dataclasses.dataclass
class AsrTrack:
  lang: str
  url: str

def list_subtitles(url):
  ydl_opts = {
    'skip_download': True,
    'writeautomaticsub': True,
    'listsubtitles': True,
    'subtitlesformat': 'srv3',
  }
  all_subtitles = []
  class ListSubtitles(youtube_dl.YoutubeDL):
    def list_subtitles(self, video_id, subtitles, name='subtitles'):
      # Remove regular subtitles:
      if name == 'subtitles':
        return
      for lang, lang_subtitles in subtitles.items():
        for lang_subtitle in lang_subtitles:
          if lang_subtitle['ext'] == 'srv3':
            all_subtitles.append(AsrTrack(
              lang=lang,
              url=lang_subtitle['url'],
            ))

  # Skip this function to speed it up:
  with unittest.mock.patch('youtube_dl.extractor.youtube.YoutubeIE._get_subtitles', return_value={}):
    with ListSubtitles(ydl_opts) as ydl:
      ydl.download([url])

  return all_subtitles

def main():
  # Usage: ./youtube_captions.py 'https://www.youtube.com/watch?v=...' /dev/stdout
  # (prints [{lang: 'en', url: ...}, ...], a list of the srv3 urls)
  url, json_socket = sys.argv[1:]
  subtitles = list_subtitles(url)
  with open(json_socket, 'w') as f:
    json.dump([dataclasses.asdict(subtitle) for subtitle in subtitles], f)

if __name__ == '__main__':
  main()
