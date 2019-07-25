import { Readable } from "readable-stream";
import { ThumbReader, SliceCollector } from "./thumbparser";
declare var DedicatedWorkerGlobalScope: any;

type FileSegments = [number, number];
const READ_BUFFER = 5242880; // 5 MB

class FileStream extends Readable {
    onProgress: (progress: number, total: number) => void;
    fileReader: FileReader
    readPos: number;
    file: File;
    chunks: IterableIterator<FileSegments>
    /** Converts FileReader into readable stream */
    constructor(file: File, onProgress: (progress: number, total: number) => void, fileSegments?: Array<FileSegments>) {
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

    *getSequentialSlices(): IterableIterator<FileSegments> {
        for (let position = 0; position < this.file.size; position += READ_BUFFER) {
            const end = position + READ_BUFFER + 1; // + 1 because y in file.slice(, y) is ignored according to MDN
            this.onProgress(position, this.file.size);
            yield [position, end < this.file.size ? end : undefined]
        }
    }
    *getRandomSlices(fileSegments: Array<FileSegments>): IterableIterator<FileSegments> {
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
let lastUpdate = Date.now();

onMessage((event, sendResponse) => {
    const file = event.data.file;

    if (file) {
        if (stream) stream.destroy();

        sendResponse({ status: "Parsing" })

        stream = new FileStream(file, (position: number, total: number) => {
            const progress = (position / total) * 100;
            const text = (position / 1024).toFixed(0) + " kB / " + (total / 1024).toFixed(0) + " kB"
            const time = Date.now();

            if (time - lastUpdate > 200) {
                sendResponse({ progress: progress, text: text })
                lastUpdate = time;
            }
        })
            .pipe(new ThumbReader(fileSegments => {
                sendResponse({ status: "Extracting.." })
                stream = new FileStream(file, (position: number, total: number) => {
                    const progress = (position / total) * 100;
                    const text = "Image " + position + " / " + total;
                    const time = Date.now();

                    if (time - lastUpdate > 200) {
                        sendResponse({ progress: progress, text: text })
                        lastUpdate = time;
                    }
                }, fileSegments)
                stream.pipe(new SliceCollector(images => sendResponse({ images: images })))
            }))

    }
})