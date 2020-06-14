// provides apis to communicate over a video room plugin handle

import {Session} from "./Session";
import {JanusResponse} from "./types/JanusResponse";
import {JanusSessionHandleRequest} from "./types/JanusRequest";
import {prettifyJson} from "../utils";
import {HandleMessage, isJanusEvent, JanusEvent} from "./types/Messages";

export class PluginHandle {
    public readonly handleId: string;
    private readonly session: Session;
    private readonly eventListeners: Map<String, PluginHandleEventListener>;
    constructor(handleId: string, session: Session) {
        this.handleId = handleId;
        this.session = session;
        this.eventListeners = new Map<String, PluginHandleEventListener>();
    }

    public setEventListener(event: string, callback: PluginHandleEventListener) {
        this.eventListeners.set(event, callback);
    }

    public detach(): Promise<any> {
        return this.session.detachHandle(this);
    }

    public send<T extends JanusResponse>(body: object, jsep?: object) : Promise<T> {
        let req: JanusSessionHandleRequest = {
            body: body,
            janus: "message",
            jsep: jsep,
            handle_id: this.handleId,
            session_id: this.session.sessionId
        }
        this.logOutgoing(`sending req \n \t body: ${prettifyJson(body)} \n \t jsep: ${prettifyJson(jsep)}`)
        return this.session.send(req);
    }

    public receive(msg: HandleMessage) {
        if (isJanusEvent(msg)) {
            const handler = this.eventListeners.get(msg.janus);
            if (handler) {
                handler.onEvent(msg);
            } else {
                this.logIncoming(`unhandled EVENT ${prettifyJson(msg)}`);
            }
        } else {
            this.logIncoming(`unhandled MESSAGE ${prettifyJson(msg)}`);
        }
    }

    private logIncoming(log: string) {
        console.debug(`JANUS => session ${this.session.sessionId} => handle ${this.handleId} => ${log}`);
    }

    private logOutgoing(log: string) {
        console.debug(`JANUS <= session ${this.session.sessionId} <= handle ${this.handleId} <= ${log}`);
    }
}

export interface PluginHandleEventListener {
    onEvent(ev: JanusEvent): Promise<any>;
}