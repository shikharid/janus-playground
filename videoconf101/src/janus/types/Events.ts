import {JanusVideoRoomEvent} from "./Messages";

export type VideoRoomJoinedEvent = JanusVideoRoomEvent & {
    plugindata: {
        data: {
            videoroom: "joined"
        }
    }
}