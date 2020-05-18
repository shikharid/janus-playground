#!/usr/bin/env bash

sudo docker build -t shikharid/janus-pg .
# stop container
sudo docker stop -t 10 pappu-janus
# clear container files
sudo docker rm $(sudo docker ps -a -q)
# run janus
sudo docker run -d --name=pappu-janus -p 7088:7088 -p 7889:7889 -p 8088:8088 -p 8089:8089 -p 1443:1443 -p 12000-13000:12000-13000/udp shikharid/janus-pg