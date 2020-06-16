import {PluginHandle, PluginHandleEventListener} from "../janus/PluginHandle";
import {VideoRoom} from "./VideoRoom";
import {Session} from "../janus/Session";
import {userMedia} from "../webrtc/UserMedia";
import {localStreamVid, signalLog, username} from "../elements";
import {JanusEvent, JanusVideoRoomEvent} from "../janus/types/Messages";
import {prettifyJson, rUsername} from "../utils";

export class Publisher {
    private readonly room: VideoRoom;
    public handle?: PluginHandle;
    private localStream?: MediaStream;
    private pc?: RTCPeerConnection;
    private id?: number;

    constructor(room: VideoRoom) {
        this.room = room;
        // @ts-ignore
        window.publisher = this;
    }

    async init() {
        await this.setupPluginHandle();
        if (userMedia.mediaEnabled()) {
            this.localStream = await navigator.mediaDevices.getUserMedia(userMedia.mediaConstraints());
            // @ts-ignore
            window.localStream = this.localStream;
            this.displayLocalVideo();
        } else {
            await this.room.subscribeToAll();
        }
        return Promise.resolve();
    }

    private displayLocalVideo() {
        localStreamVid.srcObject = this.localStream as MediaStream;
    }

    private async setupPluginHandle() {
        this.handle = await this.room.session.createHandle();
        this.handle.setEventListener('event', Publisher.makeHandleListener((ev) => this.handleJanusEvent(ev)));
        this.handle.setEventListener('webrtcup', Publisher.makeHandleListener((ev) => this.handleWebrtcupEvent(ev)));
        this.handle.setEventListener('media', Publisher.makeHandleListener((ev) => this.handleMediaEvent(ev)));
        await this.handle.send({
            request: 'join',
            'ptype': 'publisher',
            'room': this.room.roomId,
            'display': username.value || rUsername()
        });
    }

    private async publishFeed() {
        if (this.localStream) {
            this.pc = new RTCPeerConnection({
                iceServers: [{urls: 'stun:stun.l.google.com:19302'}],
            });

            this.localStream.getTracks().forEach(t => this.pc?.addTrack(t, ls));

            const offer = await this.pc.createOffer({
                offerToReceiveAudio: false,
                offerToReceiveVideo: false
            });
            await this.pc.setLocalDescription(offer);
            const resp = await this.handle?.send({
                request: "publish",
                audio: userMedia.audioEnabled(),
                video: userMedia.videoEnabled(),
                data: false
            }, offer);
            console.log(`rcvd offer resp ${prettifyJson(resp)}`)
        }
    }

    private async handleJanusEvent(event: JanusVideoRoomEvent) {
        let data = event.plugindata?.data;
        if (data?.videoroom === 'joined') {
            console.log(`JOINED room ${this.room.roomId}, starting publish`);
            this.id = data.id;
            localStreamVid.setAttribute('pid', String(this.id));
            await this.publishFeed();
        } else if (data?.videoroom === 'event') {
            if (event.jsep !== undefined && event.jsep.type === 'answer') {
                console.log('rcvd answer from janus');
                this.pc?.setRemoteDescription(event.jsep);
            }
            if (data.publishers) {
                console.log('subscribing to ', data.publishers)
                data.publishers.forEach(pub => this.room.subscribe(pub));
            }
            console.log(`rcvd event for publisher ${prettifyJson(event)}`);
        }
        return Promise.resolve();
    }

    private async handleWebrtcupEvent(event: JanusVideoRoomEvent) {
        console.log(`rcvd webrtcup ${prettifyJson(event)}  on ${this.handle?.handleId}`);
        // webrtcup, subscribe to publishers
        await this.room.subscribeToAll();
        setInterval(() => this.showStats(),  1000);
    }

    private async handleMediaEvent(event: JanusVideoRoomEvent) {
        console.log(`rcvd media event ${prettifyJson(event)}  on ${this.handle?.handleId}`);
    }

    private static makeHandleListener(cb: (ev: JanusVideoRoomEvent) => Promise<any>) : PluginHandleEventListener {
        return new class implements PluginHandleEventListener {
            onEvent(ev: JanusEvent): Promise<any> {
                return cb(ev as JanusVideoRoomEvent);
            }
        }
    }

    private async showStats() {
        // if (this.pc) {
        //     let stats = await this.pc.getStats();
        //     stats.forEach(res => {
        //         // copied from janus.js
        //         var inStats = false;
        //         // Check if these are statistics on incoming media
        //         if((res.mediaType === "video" || res.id.toLowerCase().indexOf("video") > -1) &&
        //             res.type === "inbound-rtp" && res.id.indexOf("rtcp") < 0) {
        //             // New stats
        //             inStats = true;
        //         } else if(res.type == 'ssrc' && res.bytesReceived &&
        //             (res.googCodecName === "VP8" || res.googCodecName === "")) {
        //             // Older Chromer versions
        //             inStats = true;
        //         }
        //         signalLog(`stats: ${prettifyJson(stat)}`)
        //     })
        // }
    }
}