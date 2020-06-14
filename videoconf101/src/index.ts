import {userMedia} from "./webrtc/UserMedia";
import {rUsername} from "./utils";
import {
    audioSelect,
    constraintsDiv,
    localStreamVid,
    roomDiv,
    remoteStreamDiv,
    joinBtn,
    progressBar,
    videoSelect,
    username, statsDiv, unhideEl, hideEl
} from "./elements";
import {janus} from "./janus/Janus";
import {VideoRoom} from "./video-room/VideoRoom";
import {TEST_ROOM_ID} from "./janus/Constants";

window.addEventListener('load', () => {
    username.value = rUsername();
    hideEl(progressBar)
    showDeviceOptions();
});

joinBtn.onclick = () => {
    if (userMedia.videoDeviceId === null && userMedia.audioDeviceId === null) {
        alert('select atleast one of audio or video devices to proceed');
    } else {
        unhideEl(progressBar);
        setupRoom().then(() => {
            console.log("All set, rendering video room");
            hideEl(constraintsDiv);
            hideEl(progressBar);
            unhideEl(roomDiv);
            unhideEl(statsDiv);
        }).catch(e => {
            console.log(`error in setting up room ${e}`);
            alert('error in setting up room. check console and reload to try again');
        });
    }
}

async function showDeviceOptions() {
    let audioDevices = await userMedia.audioInDevices();
    let videoDevices = await userMedia.videoDevices();
    audioDevices.forEach(device => {
        const option = document.createElement("option");
        option.text = device.label || `Audio device ${device.deviceId}`;
        option.value = device.deviceId;
        audioSelect.appendChild(option);
    });
    videoDevices.forEach(device => {
        const option = document.createElement("option");
        option.text = device.label || `Video device ${device.deviceId}`;
        option.value = device.deviceId;
        videoSelect.appendChild(option);
    })
    userMedia.audioDeviceId = audioSelect.value;
    userMedia.videoDeviceId = videoSelect.value;
    audioSelect.onchange = () => userMedia.audioDeviceId = audioSelect.value;
    videoSelect.onchange = () => userMedia.videoDeviceId = videoSelect.value;
}

async function setupRoom() {
    return janus.createSession().then(session => {
        let vr: VideoRoom = new VideoRoom(session, TEST_ROOM_ID);
        return vr.init();
    });
}