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

FROM node:12
RUN apt-get update && apt-get install -y python3 python3-pip

# Install everything:
WORKDIR /usr/src/app
COPY . .

WORKDIR /usr/src/app/captions
RUN rm -rf node_modules
RUN npm ci
RUN npm run build
WORKDIR /usr/src/app/www
RUN rm -rf node_modules
RUN python3 -m pip install --user -r ./requirements.txt
RUN npm ci
RUN npm run build

WORKDIR /usr/src/app/captions
RUN npm prune --production
# Remove the compiler:
RUN ["bash", "-c", "rm -rf node_modules/bs-platform/{darwin,win32,linux,vendor,lib/4.06.1}"]
WORKDIR /usr/src/app/www
RUN npm prune --production

# Run the web service on container startup.
EXPOSE 8080
CMD ["node", "index.js"]
