FROM amazonlinux:2

RUN yum update -y

RUN yum groupinstall -y "Development Tools"

RUN yum install -y sudo gtk-doc jansson-devel \
   openssl-devel sofia-sip-devel glib2-devel \
   opus-devel libogg-devel libcurl-devel pkgconfig \
   libconfig-devel libtool autoconf automake epel-release git 

RUN cd ~ \
    && git clone https://gitlab.freedesktop.org/libnice/libnice \
    && cd libnice \
    && ./autogen.sh \
    && ./configure --prefix=/usr \
    && make && sudo make install

RUN yum install -y wget

RUN cd ~ \
    && wget https://github.com/cisco/libsrtp/archive/v2.2.0.tar.gz \
    && tar xfv v2.2.0.tar.gz \
    && cd libsrtp-2.2.0 \
    && ./configure --prefix=/usr --enable-openssl --libdir=/usr/lib64 \
    && make shared_library && sudo make install

RUN cd ~ \
    && git clone https://github.com/sctplab/usrsctp \
    && cd usrsctp \
    && ./bootstrap \
    && ./configure --prefix=/usr --libdir=/usr/lib64 \
    && make \
    && sudo make install

ENV PKG_CONFIG_PATH=/usr/lib/pkgconfig

RUN cd ~ \
    && wget http://gnu.mirror.iweb.com/gengetopt/gengetopt-2.22.6.tar.gz \
    && tar xfv gengetopt-2.22.6.tar.gz  \
    && cd gengetopt-2.22.6 \
    && ./configure \
    && make && sudo make install

RUN cd ~ \
    && wget https://mirror.chanakancloud.live/pub/gnu/libmicrohttpd/libmicrohttpd-0.9.70.tar.gz \
    && tar xfv libmicrohttpd-0.9.70.tar.gz \
    && cd libmicrohttpd-0.9.70 \
    && ./configure --libdir=/usr/lib64 \
    && make && sudo make install

RUN cd ~ \
    && git clone https://github.com/meetecho/janus-gateway.git \
    && cd janus-gateway \
    && sh autogen.sh \
    && ./configure --prefix=/opt/janus --disable-rabbitmq --disable-mqtt --disable-data-channels \
    && make CFLAGS='-std=c99' \
    && make install \
    && make configs

COPY *.pem /root/

COPY conf/*.jcfg /opt/janus/etc/janus/

EXPOSE 7088 7889 8088 8089 1443
EXPOSE 12000-12200/udp

RUN cd /opt/janus/ && mkdir demos

COPY demos /opt/janus/demos/

RUN amazon-linux-extras install nginx1.12

COPY nginx.conf /etc/nginx/nginx.conf

CMD /usr/sbin/nginx && /opt/janus/bin/janus
