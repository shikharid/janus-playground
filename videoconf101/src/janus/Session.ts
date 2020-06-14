// provides apis to communicate over a "session"

import {janus} from "./Janus";
import {JanusResponse} from "./types/JanusResponse";
import {JanusSessionHandleRequest, JanusSessionRequest, PluginAttachRequest} from "./types/JanusRequest";
import {PluginHandle} from "./PluginHandle";
import {prettifyJson} from "../utils";
import {isHandleMessage, isHandleMessageWithId, isHandleMessageWithSender, SessionMessage} from "./types/Messages";

export class Session {
    public readonly sessionId: string;
    private readonly handles: Map<String, PluginHandle>;
    constructor(sessionId: string) {
        this.sessionId = sessionId;
        this.handles = new Map();
        this.keepSessionAlive();
    }

    public createHandle(plugin: string = "janus.plugin.videoroom"): Promise<PluginHandle> {
        let req: PluginAttachRequest = {
            janus: "attach",
            plugin: plugin,
            session_id: this.sessionId
        };
        return this.send<PluginHandleCreated>(req)
            .then(resp => {
                let handle: PluginHandle = new PluginHandle(resp.data.id, this);
                this.handles.set(handle.handleId, handle);
                return handle;
            });
    }

    public send<T extends JanusResponse>(req: JanusSessionRequest) : Promise<T> {
        req.session_id = this.sessionId;
        this.logOutgoing(`sending req ${prettifyJson(req)}`);
        return janus.send(req);
    }

    public receive(msg: SessionMessage) {
        let logUnhandled = () => this.logIncoming(`unhandled msg ${prettifyJson(msg)}`);

        if (isHandleMessage(msg)) {
            let handleId, handle;
            if (isHandleMessageWithId(msg)) {
                handleId = msg.handle_id;
            } else if(isHandleMessageWithSender(msg)) {
                handleId = msg.sender;
            }
            if (handleId !== undefined && (handle = this.handles.get(handleId)) !== undefined) {
                handle.receive(msg);
            } else {
                logUnhandled();
            }
        } else {
            logUnhandled();
        }
    }

    public detachHandle(handle: PluginHandle) {
        let req: JanusSessionHandleRequest = {
            session_id: this.sessionId,
            janus: "detach",
            handle_id: handle.handleId
        }
        return this.send(req)
            .then(resp => {
                this.logIncoming(`plugin handle detached ${handle.handleId}, resp ${prettifyJson(resp)}`);
                this.handles.delete(handle.handleId);
            })
    }

    private keepSessionAlive() {
        // send keep alive every 50 seconds, ttl is 60 seconds
        setInterval(() => {
            this.send({janus: "keepalive", session_id: this.sessionId})
              //  .then(resp => this.logIncoming(`rcvd keep alive response, resp ${prettifyJson(resp)}`));
        }, 15 * 1000);
    }

    private logIncoming(log: string) {
        console.debug(`JANUS => session ${this.sessionId} => ${log}`);
    }

    private logOutgoing(log: string) {
        console.debug(`JANUS <= session ${this.sessionId} <= ${log}`);
    }
}

type HandleData = {
    readonly id: string;
}
type PluginHandleCreated = JanusResponse & {readonly data: HandleData; }