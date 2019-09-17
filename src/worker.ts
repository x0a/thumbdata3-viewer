declare var DedicatedWorkerGlobalScope: any;

import { Readable } from "readable-stream";
import { ThumbReader, SliceCollector, FileSlice } from "./thumbparser";

const READ_BUFFER = 5242880; // 5 MB

class FileStream extends Readable {
    fileReader: FileReader
    readPos: number;
    file: File;
    chunks: IterableIterator<FileSlice>
    onProgress: (progress: number, total: number) => void;
    /** Converts FileReader into readable stream */
    constructor(file: File, onProgress: (progress: number, total: number) => void, fileSegments?: Array<FileSlice>) {
        super();

        this.fileReader = new FileReader();
        this.fileReader.addEventListener("loadend", () => {
            if (!this.destroyed) {
                this.push(new Uint8Array(this.fileReader.result as ArrayBuffer))
            }
        })
        this.onProgress = onProgress;
        this.file = file;
        this.readPos = 0;
        this.chunks = fileSegments ? this.getRandomSlices(fileSegments) : this.getSequentialSlices();
    }

    *getSequentialSlices(): IterableIterator<FileSlice> {
        for (let position = 0; position < this.file.size; position += READ_BUFFER) {
            const end = position + READ_BUFFER + 1; // + 1 because y in file.slice(, y) is ignored according to MDN
            this.onProgress(position, this.file.size);
            yield [position, end < this.file.size ? end : undefined]
        }
    }
    *getRandomSlices(fileSegments: Array<FileSlice>): IterableIterator<FileSlice> {
        let i = 0;
        for (const [x, y] of fileSegments) {
            this.onProgress(i++, fileSegments.length);
            yield [x, y + 1];
        }
    }

    _read() {
        const { value, done } = this.chunks.next();
        if (done) {
            this.push(null);
        } else {
            this.readSlice(value[0], value[1])
        }
    }

    readSlice(readFrom: number, readTo?: number) {
        const nextSlice = this.file.slice(readFrom, readTo);

        this.fileReader.readAsArrayBuffer(nextSlice);
        this.readPos = readTo;
    }
}

const onMessage = (fn: (event: MessageEvent, sendResponse: (reply: any) => any) => any) => {
    self.addEventListener("message", (event: MessageEvent) => {
        if (typeof DedicatedWorkerGlobalScope !== 'undefined' && self instanceof DedicatedWorkerGlobalScope) {
            fn(event, reply => (self as any as Worker).postMessage(reply))
        } else {
            fn(event, reply => self.postMessage(reply, "*"))
        }
    })
}

let stream: any;

onMessage((event, sendResponse) => {
    const file = event.data.file;

    if (!file) return;
    if (stream) stream.destroy();

    let lastUpdate = Date.now();

    const onProgress = (position: number, total: number, file: boolean = false) => {
        const progress = (position / total) * 100;
        const text = file
            ? (position / 1024).toFixed(0) + " kB / " + (total / 1024).toFixed(0) + " kB"
            : "Image " + position + " / " + total;
        const time = Date.now();

        if (time - lastUpdate > 200) {
            sendResponse({ progress, text })
            lastUpdate = time;
        }
    }

    sendResponse({ status: "Parsing" })

    stream = new FileStream(file, (position, total) => onProgress(position, total, true))
        .pipe(new ThumbReader(fileSegments => {
            sendResponse({ status: "Extracting.." })
            stream = new FileStream(file, (position, total) => onProgress(position, total), fileSegments)
                .pipe(new SliceCollector(images => sendResponse({ images: images })))
        }))
})