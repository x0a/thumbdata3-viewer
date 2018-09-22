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
    const READ_BUFFER = 5000000;

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

        constructor(file: File) {
            this.file = file;
            this.fileReader = new FileReader();
            this.imagePoints = [];
            this.markerStart = false;
            this.jpegStart = 0;
            this.readStartPos = 0;
            this.cancelProcess = false;

            this.fileReader.addEventListener("loadend", () => {
                let markerStart = this.markerStart;
                let jpegStart = this.jpegStart;
                const data: Uint8Array = new Uint8Array(<ArrayBuffer>this.fileReader.result);

                for (let i = 0; i < data.length; i++) {
                    if (data[i] === 0xff && !markerStart) {
                        markerStart = true;
                    } else if (markerStart) {
                        if (data[i] === 0xd8)
                            jpegStart = i - 1 + this.readStartPos;
                        else if (data[i] === 0xd9)
                            this.imagePoints.push([jpegStart, i + this.readStartPos]);

                        markerStart = false;
                    }
                }

                this.markerStart = markerStart;
                this.jpegStart = jpegStart;
                this.readStartPos = this.nextPosition;

                let chunkProg = this.readNextChunk();

                if (chunkProg === false || this.cancelProcess) {
                    this.done(this.imagePoints);
                } else {
                    this.progress(chunkProg);
                }
            });
        }

        readNextChunk() {
            if (this.readStartPos > this.file.size) {
                return false;
            } else {
                const nextPosition = this.readStartPos + READ_BUFFER;
                const readTo = nextPosition > this.file.size ? undefined : nextPosition;
                const nextSlice = this.file.slice(this.readStartPos, readTo);

                this.nextPosition = nextPosition;
                this.fileReader.readAsArrayBuffer(nextSlice);

                return (this.readStartPos / this.file.size) * 100;
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

                this.progress((i / points.length) * 100);
                if(this.cancelProcess)
                    break;
            }

            return images;
        }
        cancel(){
            this.cancelProcess = true;
        }
    }

    let extractor: ThumbReader;
    
    self.addEventListener("message", (msg:MessageEvent) => {
        if (msg.data.init) {
            if(extractor){
                extractor.cancel();
            }

            extractor = new ThumbReader(msg.data.init);
            extractor.progress = (progress: number) => self.postMessage({ progress: progress });

            extractor.extractPoints()
                .then(imagePoints => {
                    self.postMessage({ status: "Extracting.." })
                    return extractor.extractImages(imagePoints);
                })
                .then(images => self.postMessage({ images: images }))

            self.postMessage({
                status: "Parsing"
            })
        }
    })
})(self)