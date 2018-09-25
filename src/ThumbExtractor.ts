/*
	Copyright (c) 2018 x0a

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

((self: any) => {
    const READ_BUFFER = 5242880; // 5 MB

    class PromiseReader {
		/*
			Replaces event-based FileReader with promise-based FileReader
		*/

        fileReader: FileReader;
        complete: any;

        constructor() {
            this.fileReader = new FileReader();
            this.fileReader.addEventListener("loadend", () => {
                if (this.complete) {
                    this.complete(this.fileReader.result);
                }
            })
        }
        readAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
            return new Promise(resolve => {
                this.complete = resolve;
                this.fileReader.readAsArrayBuffer(blob);
            })
        }
    }

    class ThumbReader {
        file: File;
        fileReader: FileReader;
        imagePoints: Array<Array<number>>;
        markerStart: boolean;
        jpegStart: number;
        readStartPos: number;
        nextPosition: number;
        progress: any;
        done: any;
        cancelProcess: boolean;
        scanStart: boolean;
        scanHeader: Array<number>;

        constructor(file: File) {
            this.file = file;
            this.fileReader = new FileReader();
            this.imagePoints = [];
            this.markerStart = false;
            this.jpegStart = 0;
            this.readStartPos = 0;
            this.scanStart = false;
            this.scanHeader = [];
            this.cancelProcess = false;

            this.fileReader.addEventListener("loadend", () => {
                let markerStart = this.markerStart;
                let jpegStart = this.jpegStart;
                let scanStart = this.scanStart;

                const data: Uint8Array = new Uint8Array(<ArrayBuffer>this.fileReader.result);

                for (let i = 0; i < data.length; i++) {
                    const byte = data[i];

                    if (!markerStart) {
                        if (byte === 0xff) {
                            markerStart = true;
                        } else if (scanStart) {
                            this.scanHeader.push(byte);
                        }
                    } else {
                        if (byte === 0xd8) {
                            jpegStart = i - 1 + this.readStartPos;
                            scanStart = false;
                            this.scanHeader = [];
                        } else if (byte === 0xc0 || byte === 0xc2) { // start of image header, c0 == baseline, c4 = progressive
                            /*if (scanStart) {
                                console.log("New header started before old one could finish. Old header:", JSON.stringify(this.scanHeader));
                            }*/
                            scanStart = true;
                            this.scanHeader = [];
                        } else if (byte === 0xc4 || byte === 0xdb) { // end of image header, c4 = start of huffman table, db = start of quantization table
                            scanStart = false;
                        } else if (byte === 0xd9) {
                            if (!scanStart && this.verifyHeader(this.scanHeader)) {
                                this.imagePoints.push([jpegStart, this.readStartPos + i + 1]);
                            } else {
                                //console.log("Rejected because of invalid header, header:", this.scanHeader.map(val => val.toString(16)));
                                scanStart = false;
                                this.scanHeader = [];
                            }
                        } else if (scanStart) {
                            this.scanHeader.push(0xff, byte);
                        }
                        markerStart = false;
                    }
                }

                this.scanStart = scanStart;
                this.markerStart = markerStart;
                this.jpegStart = jpegStart;
                this.readStartPos = this.nextPosition;

                this.readNextChunk();
            });
        }

        verifyHeader(header: Array<number>) {
            if (header.length < 5)
                return false;

            const headerLength = header[0] * 256 + header[1]; // first 2 bytes determine length of the header

            if (header.length === headerLength)
                return true;
        }

        readNextChunk() {
            if (this.readStartPos > this.file.size || this.cancelProcess) {
                this.done(this.imagePoints);
            } else {
                const nextPosition = this.readStartPos + READ_BUFFER;
                const readTo = nextPosition > this.file.size ? undefined : nextPosition;
                const nextSlice = this.file.slice(this.readStartPos, readTo);

                this.nextPosition = nextPosition;
                this.fileReader.readAsArrayBuffer(nextSlice);

                this.progress(this.readStartPos, this.file.size);
            }
        }

        extractPoints(): Promise<Array<Array<number>>> {
            return new Promise(resolve => {
                this.done = resolve;
                this.readNextChunk();
            })
        }

        async extractImages(points: Array<Array<number>>) {
            let extractor = new PromiseReader();
            let images = [];

            for (let i = 0; i < points.length; i++) {
                const [readStart, readEnd] = points[i];
                const fileSlice = this.file.slice(readStart, readEnd);
                const buffer = new Uint8Array(await extractor.readAsArrayBuffer(fileSlice));

                images.push(URL.createObjectURL(new Blob([buffer], { type: "image/jpeg" })))

                this.progress(i, points.length);

                if (this.cancelProcess)
                    break;
            }

            return images;
        }

        cancel() {
            this.cancelProcess = true;
        }
    }

    let extractor: ThumbReader;

    self.addEventListener("message", (msg: MessageEvent) => {
        if (msg.data.init) {
            if (extractor) {
                extractor.cancel();
            }

            extractor = new ThumbReader(msg.data.init);

            extractor.progress = (position: number, total: number) => {
                const progress = (position / total) * 100;
                const text = (position / 1024).toFixed(0) + " kB / " + (total / 1024).toFixed(0) + " kB"
                self.postMessage({ progress: progress, text: text })
            };

            extractor.extractPoints()
                .then(imagePoints => {
                    self.postMessage({ status: "Extracting.." })
                    extractor.progress = (position: number, total: number) => {
                        const progress = (position / total) * 100;
                        const text = position + " / " + total;
                        self.postMessage({ progress: progress, text: text })
                    };
                    return extractor.extractImages(imagePoints);
                })
                .then(images => {
                    self.postMessage({ images: images });
                    extractor = null;
                })

            self.postMessage({
                status: "Parsing"
            })
        }
    })
})(self)