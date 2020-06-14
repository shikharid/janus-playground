import {PluginHandle, PluginHandleEventListener} from "../janus/PluginHandle";
import {VideoRoom} from "./VideoRoom";
import {remoteVideoDisplayer, removeRemoteVid} from "../elements";
import {JanusEvent, JanusVideoRoomEvent} from "../janus/types/Messages";
import {prettifyJson} from "../utils";
import {ParticipantInfo} from "../janus/types/ParticipantInfo";

export class Subscriber {
    public handle?: PluginHandle;
    public readonly info: ParticipantInfo;

    private readonly room: VideoRoom;
    private remoteStream: MediaStream;
    private pc: RTCPeerConnection;

    constructor(room: VideoRoom, info: ParticipantInfo) {
        this.room = room;
        this.info = info;
        this.pc = new RTCPeerConnection({
            iceServers: [{urls: 'stun:stun.l.google.com:19302'}],
        });
        this.remoteStream = new MediaStream();
        this.setupPCEventListeners();
    }

    async init() {
        return this.setupPluginHandle();
    }

    private async setupPluginHandle() {
        this.handle = await this.room.session.createHandle();
        this.handle.setEventListener('event', Subscriber.makeHandleListener((ev) => this.handleJanusEvent(ev)));
        this.handle.setEventListener('webrtcup', Subscriber.makeHandleListener((ev) => this.handleWebrtcupEvent(ev)));
        this.handle.setEventListener('media', Subscriber.makeHandleListener((ev) => this.handleMediaEvent(ev)));
        this.handle.setEventListener('attached', Subscriber.makeHandleListener((ev) => this.handleAttachedEvent(ev)));
        this.handle.setEventListener('hangup', Subscriber.makeHandleListener((ev) => this.handleHangupEvent(ev)));
        await this.handle.send({
            request: 'join',
            'ptype': 'subscriber',
            'room': this.room.roomId,
            'feed': this.info.id,
            'audio': true,
            'video': true,
            'data': false
        });
    }

    private async handleJanusEvent(event: JanusVideoRoomEvent) {
        let data = event.plugindata?.data;
        if (data?.videoroom === 'attached') {
            if (event.jsep) {
                // attached, set remote description on pc
                console.log(`rcvd attached for publisher ${prettifyJson(event)}`);
                await this.pc.setRemoteDescription(event.jsep);
                const answer = await this.pc.createAnswer({offerToReceiveAudio: true, offerToReceiveVideo: true});
                await this.handle?.send({
                    request: "start"
                }, answer);
                await this.pc.setLocalDescription(answer);
            }
        } else {
            console.log('rcvd unhandled subscriber event', event)
        }
        return Promise.resolve();
    }

    private async handleWebrtcupEvent(event: JanusVideoRoomEvent) {
        console.log(`rcvd webrtcup ${prettifyJson(event)}  on ${this.handle?.handleId}`);
    }

    private async handleMediaEvent(event: JanusVideoRoomEvent) {
        console.log(`rcvd media event ${prettifyJson(event)}  on ${this.handle?.handleId}`);
    }

    private async handleAttachedEvent(ev: JanusVideoRoomEvent) {
        console.log(`rcvd attached event ${prettifyJson(ev)}  on ${this.handle?.handleId}`);
    }

    private static makeHandleListener(cb: (ev: JanusVideoRoomEvent) => Promise<any>) : PluginHandleEventListener {
        return new class implements PluginHandleEventListener {
            onEvent(ev: JanusEvent): Promise<any> {
                return cb(ev as JanusVideoRoomEvent);
            }
        }
    }

    private setupPCEventListeners() {
        this.pc.ontrack = (track) => {
            console.error('REMOTE PC rcvd track from subscriber, track ', track);
            this.remoteStream.addTrack(track.track);
            remoteVideoDisplayer(String(this.info.id)).videoEl.srcObject = this.remoteStream;
            remoteVideoDisplayer(String(this.info.id)).info.textContent = `name: ${this.info.display}\nid: ${this.info.id}`;
            // for (let i: number = 0;i < 10; ++i) {
            //     remoteVideoDisplayer(String(this.info.id + String(i))).videoEl.srcObject = this.remoteStream;
            //     remoteVideoDisplayer(String(this.info.id + String(i))).info.textContent = `name: ${this.info.display}\nid: ${this.info.id}`;
            // }
        }
        this.pc.onconnectionstatechange = (st) => {
            console.error('REMOTE PC conn state change event', st, ' state is: ', this.pc.connectionState);
        }
        this.pc.onicecandidate = (ca) => {
            console.error('REMOTE PC new ice candidate', ca);
        }
        this.pc.oniceconnectionstatechange = (st) => {
            console.error('REMOTE PC ICE conn state change event', st, ' state is: ', this.pc.connectionState);
        }
        this.pc.onicecandidateerror = (st) => {
            console.error('REMOTE PC ICE conn ERROR event ', st);
        }
        this.pc.onicegatheringstatechange = (st) => {
            console.error('REMOTE PC ICE GATHERING event ', st);
        }
        this.pc.onnegotiationneeded = (st) => {
            console.error('REMOTE PC NEGOTIATION needed ', st);
        }
        this.pc.onstatsended = (st) => {
            console.error('REMOTE PC STATS event ', st);
        }
    }

    private handleHangupEvent(ev: JanusVideoRoomEvent) {
        console.log(`HANG UP FOR ${this.info.id} ev: ${prettifyJson(ev)}`);
        removeRemoteVid(String(this.info.id));
        this.room.unsubscribe(this);
        return Promise.resolve(undefined);
    }
}