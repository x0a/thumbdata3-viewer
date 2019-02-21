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

import { Writable } from "readable-stream";

type noop = () => void;
type FileSlice = [number, number];

class Image {
    header: Uint8Array
    headerLength: number;
    scanning: boolean;
    imageStart: number;
    imageEnd: number;

    constructor(startPosition = 0) {
        this.header = new Uint8Array(255);
        this.headerLength = 0;
        this.imageStart = startPosition;
        this.imageEnd = startPosition;
        this.scanning = false;
    }
    appendHeader(byte: number, marker?: boolean) {
        if (this.headerLength > 254) return;
        if (marker)
            this.header[this.headerLength++] = 0xff;
        this.header[this.headerLength++] = byte;
    }
    getLocation(): FileSlice {
        return [this.imageStart, this.imageEnd];
    }
    getHeader() {
        return this.header.slice(0, this.headerLength);
    }
    getHeaderLength() {
        return this.header[0] * 256 + this.header[1];
    }
    end(endPosition: number) {
        this.imageEnd = endPosition;
    }
    isValid() {
        if (this.scanning || this.headerLength < 5)
            return false;

        return this.headerLength === this.getHeaderLength();
    }
}

class ThumbReader extends Writable {
    // *** Writable stream that consums file stream and returns list of file segments */

    fileOffset: number;
    markerStart: boolean;
    readingImage: boolean;
    currentImages: Array<Image>;
    imageChunks: Array<FileSlice>;
    onChunks: (imageChunks: Array<FileSlice>) => void;

    constructor(onChunks: ThumbReader["onChunks"]) {
        super();

        this.fileOffset = 0;
        this.markerStart = false;
        this.readingImage = false;
        this.currentImages = [];
        this.imageChunks = [];
        this.onChunks = onChunks;
    }
    getCurrentImage(): Image {
        if (this.currentImages.length) {
            this.readingImage = true;
            return this.currentImages[this.currentImages.length - 1];
        } else {
            this.readingImage = false;
        }
    }
    addImage(startPosition: number): Image {
        const image = new Image(startPosition)
        this.currentImages.push(image);
        return image;
    }
    _write(chunk: ArrayBuffer, _: string, next: noop) {
        const data = new Uint8Array(chunk);

        let markerStart = this.markerStart;
        let readingImage = this.readingImage;
        let currentImage = this.getCurrentImage();

        for (let i = 0; i < data.length; i++) {
            const byte = data[i];

            if (!markerStart) {
                if (byte === 0xff) {
                    markerStart = true;
                } else {
                    if (readingImage && currentImage.scanning)
                        currentImage.appendHeader(byte);
                }
            } else {
                if (byte === 0xd8) {
                    currentImage = this.addImage(i + this.fileOffset - 1);
                    readingImage = true;
                } else if (readingImage) {
                    if (byte === 0xc0 || byte === 0xc2) { // start of image header, c0 == baseline, c4 = progressive
                        currentImage.scanning = true;
                    } else if (byte === 0xc4 || byte === 0xdb || byte === 0xdd) { // end of image header, c4 = start of huffman table, db = start of quantization table, dd = restart interval
                        currentImage.scanning = false;
                    } else if (byte === 0xd9) {
                        if (currentImage.isValid()) {
                            currentImage.end(this.fileOffset + i + 1);
                            this.imageChunks.push(currentImage.getLocation());
                            this.currentImages.pop();
                        }
                        currentImage = this.getCurrentImage();
                        readingImage = this.readingImage;
                    } else {
                        if (currentImage.scanning)
                            currentImage.appendHeader(byte, true); // a "marker" that we might not recognize, but is still part of the header
                    }
                }
                markerStart = false;
            }
        }

        this.fileOffset += chunk.byteLength
        this.markerStart = markerStart;
        this.readingImage = readingImage;

        next();
    }
    _final(done: noop) {
        this.onChunks(this.imageChunks);
        done();
    }
}
class SliceCollector extends Writable {
    //*** Writable stream that collects binary chunks as array and sends them to the callback provided */
    
    slices: ArrayBuffer[];
    onSlices: (chunks: ArrayBuffer[]) => void;

    constructor(onSlices: SliceCollector["onSlices"]) {
        super();
        this.onSlices = onSlices;
        this.slices = [];
    }
    _write(chunk: ArrayBuffer, _: string, next: noop) {
        this.slices.push(chunk);
        next();
    }
    _final(done: noop) {
        this.onSlices(this.slices);
        done();
    }
}

export { ThumbReader, SliceCollector }
export default ThumbReader;