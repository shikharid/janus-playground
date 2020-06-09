#!/usr/bin/env bash

CONTAINER=pappu-janus
sudo docker build -t shikharid/janus-pg .
echo "janus image built"

LOGFILE=/logs/janus/janus-`date +"%d-%m-%Y-%s"`
sudo mkdir -p /logs/janus
sudo docker cp $CONTAINER:/opt/janus/janus_server.log $LOGFILE

sudo docker stop -t 10 $CONTAINER
echo "active Janus container named ${CONTAINER} stopped, find logs at ${LOGFILE}"

sudo docker rm $(sudo docker ps -a -q)
echo "cleaned up stopped containers"

sudo docker run -d --name=pappu-janus -p 7088:7088 -p 7889:7889 -p 8088:8088 -p 8089:8089 -p 1443:1443 -p 8188:8188 -p 12000-13000:12000-13000/udp shikharid/janus-pg
echo "janus started as docker container named ${CONTAINER}"