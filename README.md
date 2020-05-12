Playing around with WebRTC servers

##### Setting up Janus on Amazon Linux 2

1. build image - `sudo docker build -t <image-name> .`

2. deploy container - `sudo docker run -d -p 7088:7088 -p 7889:7889 -p 8088:8088 -p 8089:8089 -p 1443:1443 -p 12000-13000:12000-13000/udp <image-id>`
  
       port mapping:
            * 7088 Janus admin http
            * 8088 Janus WebRTC http 
            * 7889 https ngnix server (reverse proxy to 7088) 
            * 8089 https ngnix server (reverse proxy to 7088) 
            * 1443 Janus demos 
            * 12000-13000 rtp port range for Janus WebRTC server

        Note: 7889, 8089, 1443 are to be exposed over public IP, 7088/8088 should ideally be only on localhost
        Note: SSL cert's are self-signed dummies

##### Debugging Janus on Amazon Linux 2

1. get into docker container - `sudo docker exec -it <container-id> bash`
2. nginx logs -> `tail -f /var/log/nginx/access.log`
3. janus logs -> `tail -f /opt/janus/janus_server.log` 


----

##### Todos
- [ ] add todos


