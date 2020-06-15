
export class UserMedia {
    public audioDeviceId?: string;
    public videoDeviceId?: string;

    public mediaConstraints(): MediaStreamConstraints {
        return {audio: this.audioConstraints(), video: this.videoConstraints()};
    }

    private audioConstraints() {
        if (this.audioDeviceId) {
            return {
                deviceId: this.audioDeviceId
            };
        } else {
            console.error('no audio device selected');
            return false;
        }
    }

    private videoConstraints() {
        if (this.videoDeviceId) {
            return {
                deviceId: this.videoDeviceId,
                height: 480,
                width: 640
            }
        } else {
            console.error('no video device selected');
            return false;
        }
    }

    public async videoDevices() {
        await this.getConsent();
        return navigator.mediaDevices.enumerateDevices()
            .then(devices => devices.filter(device => device.kind === "videoinput"));
    }

    public async audioInDevices() {
        await this.getConsent();
        return navigator.mediaDevices.enumerateDevices()
            .then(devices => devices.filter(device => device.kind === "audioinput"));
    }

    public async audioOutDevices() {
        await this.getConsent();
        return navigator.mediaDevices.enumerateDevices()
            .then(devices => devices.filter(device => device.kind === "audiooutput"));
    }

    private async getConsent() {
        return navigator.mediaDevices.getUserMedia({audio: true, video: true})
            .then(st => st.getTracks().forEach(tr => tr.stop()));
    }
}

export let userMedia = new UserMedia();

// @ts-ignore
window.umedia = userMedia;