#!/usr/bin/env python3
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
