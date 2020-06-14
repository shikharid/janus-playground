
export type JanusRequest = {
    janus: string;
    transaction?: string;
}

export type JanusSessionRequest = JanusRequest & {
    session_id: string;
}

export type JanusSessionHandleRequest  = JanusSessionRequest & {
    handle_id: string;
    body?: object;
    jsep?: object;
}

export type PluginAttachRequest = JanusSessionRequest & {
    plugin: string;
}