import {ParticipantInfo} from "./ParticipantInfo";

export type SessionMessage = { session_id: string }

export type HandleMessageWithId = SessionMessage & { handle_id: string }
export type HandleMessageWithSender = SessionMessage & { sender: string }

export type HandleMessage = HandleMessageWithId | HandleMessageWithSender

export function isSessionMessage(msg: any): msg is SessionMessage {
    return (msg as SessionMessage).session_id !== undefined;
}

export function isHandleMessage(msg: any): msg is HandleMessage {
    return isHandleMessageWithId(msg) || isHandleMessageWithSender(msg);
}

export function isHandleMessageWithId(msg: any): msg is HandleMessageWithId {
    return isSessionMessage(msg) && ((msg as HandleMessageWithId).handle_id !== undefined);
}

export function isHandleMessageWithSender(msg: any): msg is HandleMessageWithSender {
    return isSessionMessage(msg) && ((msg as HandleMessageWithSender).sender !== undefined);
}

export type JanusEvent = { plugindata?: object, janus: "event" | "webrtcup" | "slowlink" | "media" | "hangup" } & HandleMessage;

export type JanusVideoRoomEvent = {
    plugindata?: {
        plugin: "janus.plugin.videoroom",
        data: {
            videoroom: string,
            id?: number,
            publishers?: ParticipantInfo[]
        }
    },
    jsep?: {
        type: "answer" | "offer",
        sdp: string,
    }
} & JanusEvent;


export function isJanusEvent(msg: any): msg is JanusEvent {
    return isHandleMessage(msg) && (msg as JanusEvent).janus !== undefined;
}
