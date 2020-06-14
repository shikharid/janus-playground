export function tid() : string {
    return '4xxx-yxxx-xxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function autoExpiringPromise<T>(expiryInMillis: number): Promise<T>{
    return new Promise<T>(((__, reject) => {
        setTimeout(() => reject("request timed out"), expiryInMillis);
    }));
}

export function prettifyJson(json: any) {
    if (typeof json === 'object') return JSON.stringify(json, null, 4);
    else return json;
}

export function rUsername() {
    const a = ["java", "flock", "js", "python"];
    const b = ["noob", "ninja", "monkey"];
    return a[Math.floor(Math.random()*a.length)] + "-" + b[Math.floor(Math.random()*b.length)];
}