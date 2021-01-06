# ytcc2

## Setup
```bash
# Config setup:
cp www/config.sample.json www/config.json
# Put your build secrets in:
vi www/config.json

# Build the image:
docker build -t ytcc2:0.2.1 .

# Put your prod secrets in:
vi www/config.json
# SELinux:
chcon -t svirt_sandbox_file_t www/config.json

# Start serving:
docker run --rm \
  --mount type=bind,source="$PWD"/www/config.json,target=/usr/src/app/www/config.json,readonly \
  --mount type=bind,source=/var/run/postgresql,target=/var/run/postgresql \
  --network=host \
  --env PORT=8080 \
  --env NODE_ENV=production \
  --interactive --tty --init \
  ytcc2:0.2.1
```

## Source Code Headers

Use [addlicense](https://github.com/google/addlicense) to add copyright headers.
