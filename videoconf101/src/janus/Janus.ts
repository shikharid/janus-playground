// provides api for ws/http based communication to janus server
// abstracts away much of the stuff
import {JANUS_WS} from "./Constants"
import {prettifyJson, tid} from "../utils";
import {JanusResponse} from "./types/JanusResponse";
import {JanusRequest, JanusSessionRequest} from "./types/JanusRequest";
import {Session} from "./Session";
import {isSessionMessage} from "./types/Messages";
import {signalLog} from "../elements";

class Janus {
    private wsPromise?: Promise<WebSocket>;
    private activeReqs: Map<string, PromiseKeeper<any>>;
    private sessions: Map<string, Session>;

    private static readonly DEFAULT_TIMEOUT_MILLIS: number =  10000;

    constructor() {
        this.activeReqs = new Map<string, PromiseKeeper<JanusResponse>>();
        this.sessions = new Map<string, Session>();
    }

    public createSession(): Promise<Session> {
        return janus.send<SessionCreated>({janus: "create"})
            .then(resp => {
                let session: Session = new Session(resp.data.id);
                console.log(`created new session ${session.sessionId}`);
                this.sessions.set(session.sessionId, session);
                return session;
            });
    }

    public send<T extends JanusResponse>(req: JanusRequest) : Promise<T> {
        req.transaction = tid();
        this.logOutgoing(prettifyJson(req));
        let resultF = new Promise<T>((resolve, reject) => {
            this.activeReqs.set(<string>req.transaction, new PromiseKeeper<T>(resolve, reject));
            setTimeout(() => {
                reject(`request ${req.transaction} timed out, body: ${prettifyJson(req)}`);
                // cleanup from activeReqs?
                // this.activeReqs.delete(tranId);
            }, Janus.DEFAULT_TIMEOUT_MILLIS);
        });

        return this.ws().then(ws => ws.send(JSON.stringify(req))).then(__ => resultF);
    }

    private ws(): Promise<WebSocket> {
        if (!this.wsPromise) {
            this.wsPromise = this.createWS();
            return this.wsPromise;
        } else {
            return this.wsPromise;
        }
    }

    private createWS() : Promise<WebSocket> {
        let connection : WebSocket = new WebSocket(JANUS_WS, 'janus-protocol');
        let promise: Promise<WebSocket> = new Promise(((resolve, reject) => {
            connection.onopen = () => {
                this.logOutgoing("JANUS <=> CONNECTED");
                return resolve(connection);
            };
            connection.onclose = (__) => {
                this.logOutgoing("JANUS <~> DISCONNECTED");
                this.wsPromise = undefined;
            }
            connection.onmessage = (ev) => {
                this.logIncoming(prettifyJson(ev.data))
                this.receive(ev.data);
            };
            connection.onerror = (ev) => {
                console.error("JANUS <~> error", ev);
            }
            setTimeout(() => {
                reject(`socket connection timed-out`);
                // cleanup from activeReqs?
                // this.activeReqs.delete(tranId);
            }, Janus.DEFAULT_TIMEOUT_MILLIS);
        }));
        promise.catch(reason => {
            console.error("janus ws connection failed, reason: ", reason, ". resetting!");
            this.logOutgoing("JANUS <~> DISCONNECTED");
            this.wsPromise = undefined;
        });
        return promise;
    }

    private reconnectToJanus() {
        this.wsPromise = this.createWS();
        this.sessions.forEach((__, session_id) => {
            let req: JanusSessionRequest = new class implements JanusSessionRequest {
                janus: string = "claim";
                session_id: string = session_id;
            }
            this.send(req)
                .then(__ => {
                    console.log(`session ${session_id} reclaimed after reconnection`);
                })
        });
    }

    private receive(data: any) {
        data = JSON.parse(data);
        const transactionId: string = data.transaction;
        if (transactionId && data.janus !== 'event') {
            console.debug(`rcvd response for transaction ${transactionId}`);
            if (!this.activeReqs.has(transactionId)) {
                //console.error(`no response handler found for ${transactionId}`);
                this.handleMessage(data);
            } else {
                const pk = this.activeReqs.get(transactionId);
                if (pk !== undefined) {
                    if (data["janus"] === "error") {
                        pk.reject(data["error"]);
                    } else {
                        pk.resolve(data);
                    }
                    // cleanup
                    this.activeReqs.delete(transactionId);
                }
            }
        } else {
            this.handleMessage(data);
        }
    }

    // handle events and plugin data, pass on to specific session if for a session
    private handleMessage(data: any) {
        if (isSessionMessage(data)) {
            const sessionId = data.session_id;
            const session = this.sessions.get(sessionId);
            if (session !== undefined) {
                session.receive(data);
            } else {
                console.error(`rcvd msg for non-existing session ${sessionId}, msg ${prettifyJson(data)}`)
            }
        } else {
            console.error(`unhandled msg ${prettifyJson(data)}`);
        }
    }

    public logOutgoing(log: string) {
        log = `<=== sent: \n ${log}`;
        console.debug(log);
        signalLog(log);
    }

    public logIncoming(log: string) {
        log = `===> rcvd: \n${log}`;
        console.debug(log);
        signalLog(log);
    }
}

class PromiseKeeper<T extends JanusResponse> {
    readonly resolve: (value?: T) => void;
    readonly reject: (reason?: any) => void;

    constructor(resolve: (value?: T) => void, reject: (reason?: any) => void) {
        this.resolve = resolve;
        this.reject = reject;
    }
}

export type SessionCreated = JanusResponse & {
    readonly data: SessionData;
}

type SessionData = {
    readonly id: string;
}

export const janus: Janus = new Janus();