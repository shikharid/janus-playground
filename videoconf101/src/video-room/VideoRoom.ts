import {ParticipantInfo} from "../janus/types/ParticipantInfo";
import {Session} from "../janus/Session";
import {Publisher} from "./Publisher";
import {Subscriber} from "./Subscriber";

export class VideoRoom {
    public readonly session: Session;
    public readonly roomId: number;
    private readonly publisher: Publisher;
    private subscribers: Map<number, Subscriber>;

    constructor(session: Session, roomId: number) {
        this.session = session;
        this.roomId = roomId;
        this.publisher = new Publisher(this);
        this.subscribers = new Map<number, Subscriber>();
    }

    public async subscribe(participant: ParticipantInfo) {
        console.log(`subscribing to ${participant.display}:${participant.id}`);
        let subscriber = new Subscriber(this, participant);
        await subscriber.init();
        this.subscribers.set(participant.id, subscriber);
    }

    public unsubscribe(subscriber: Subscriber) {
        this.subscribers.delete(subscriber.info.id);
    }

    public async listParticipants(): Promise<ParticipantInfo[]> {
        return this.publisher.handle?.send<any>({
            request: "listparticipants",
            room: this.roomId
        }).then(resp => resp.plugindata.data.participants);
    }

    async init(): Promise<void> {
        return this.publisher.init();
    }

    async subscribeToAll() {
        const participants = await this.listParticipants();
        participants.forEach(participant => this.subscribe(participant));
    }
}