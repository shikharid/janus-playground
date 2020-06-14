export function getEl(el: string) {
    return document.getElementById(el);
}

export const constraintsDiv = getEl('constraint-div') as HTMLDivElement;
export const roomDiv = getEl('room-div') as HTMLDivElement;
export const audioSelect = getEl('audioSource') as HTMLSelectElement;
export const videoSelect = getEl('videoSource') as HTMLSelectElement;
export const joinBtn = getEl('join-room-btn') as HTMLButtonElement;
export const progressBar = getEl('progress-bar') as HTMLDivElement;
export const localStreamVid = getEl('local-stream') as HTMLVideoElement;
export const remoteStreamDiv = getEl('remote-streams') as HTMLDivElement;

export const username = getEl('username') as HTMLInputElement;

const remoteVids = new Map<String, RemoteVideoDisplay>();

function newRemoteVidElement(id: string): HTMLVideoElement {
    const vid = document.createElement('video');
    if (localStreamVid.getAttribute('pid') === id) {
        vid.muted = true;
    }
    vid.autoplay = true;
    vid.height = 240;
    vid.width = 320;
    vid.setAttribute('style', 'margin-bottom: 0;')
    vid.setAttribute('playsinline', "true");
    vid.classList.add('responsive-video');
    return vid;
}

function newRemoteInfoElement() {
    return document.createElement('pre');
}

export function remoteVideoDisplayer(id: string): RemoteVideoDisplay {
    if (!remoteVids.has(id)) {
        const vid: HTMLVideoElement = newRemoteVidElement(id);
        const info: HTMLElement = newRemoteInfoElement();
        const div: HTMLDivElement = document.createElement('div');
        div.classList.add('video-box');
        div.classList.add('col');
        div.classList.add('l4');
        div.appendChild(vid);
        div.appendChild(info);
        div.id = id;
        const rvd: RemoteVideoDisplay = {
            videoEl: vid,
            info: info,
            div: div
        }
        remoteVids.set(id, rvd);
        remoteStreamDiv.appendChild(div);
    }
    return <RemoteVideoDisplay>remoteVids.get(id);
}

export function removeRemoteVid(id: string) {
    const rvd = remoteVids.get(id);
    if (rvd) {
        remoteStreamDiv.removeChild(rvd.div);
    }
}

export type RemoteVideoDisplay = {
    div: HTMLDivElement,
    videoEl: HTMLVideoElement,
    info: HTMLElement,
    stats?: HTMLElement
}

const _signalLog = getEl('signal-log') as HTMLPreElement;
const logs: HTMLElement[] = [];

export function signalLog(log: string) {
    const time = new Date().toLocaleTimeString();
    _signalLog.insertAdjacentText('afterbegin', `[${time}] ${log}\n\n`);
}

export const statsDiv = getEl('stats-div') as HTMLDivElement;

export const stats = getEl('stats') as HTMLDivElement;

// let stats = new Stats();
// stats.showPanel( 2); // 0: fps, 1: ms, 2: mb, 3+: custom
// document.body.appendChild( stats.dom );
//
// function animate() {
//
//     stats.begin();
//
//     // monitored code goes here
//
//     stats.end();
//
//     requestAnimationFrame( animate );
//
// }
//
// requestAnimationFrame( animate );

export function hideEl(el: HTMLElement) {
    el.classList.add('hidden');
}

export function unhideEl(el: HTMLElement) {
    el.classList.remove('hidden');
}