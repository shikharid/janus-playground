#!/usr/bin/env bash

sudo docker build -t shikharid/janus-pg .
sudo docker stop -t 10 $(sudo docker ps -q --filter ancestor=shikharid/janus-pg)
sudo docker run -d -p 7088:7088 -p 7889:7889 -p 8088:8088 -p 8089:8089 -p 1443:1443 -p 12000-13000:12000-13000/udp shikharid/janus-pg