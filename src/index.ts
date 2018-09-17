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

((window: Window, document: Document, console: Console) => {

	interface DOMObject {
		fileOpen: HTMLButtonElement;
		filePicker: HTMLInputElement;
		imageViewer: HTMLDivElement;
		closeButton: HTMLButtonElement;
		imageContainer: HTMLDivElement;
		emptyText: HTMLDivElement;
		imageTemplate: HTMLDivElement;
		imageViewerMain: HTMLImageElement;
		progressContainer: HTMLDivElement;
		progress: HTMLDivElement;
	}

	const READ_BUFFER = 5000000;

	class PromiseReader {
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
		lastPosition: number;
		progress: any;
		done: any;

		constructor(file: File) {
			this.file = file;
			this.fileReader = new FileReader();
			this.imagePoints = [];
			this.markerStart = false;
			this.jpegStart = 0;
			this.lastPosition = 0;

			this.fileReader.addEventListener("loadend", () => {
				let markerStart = this.markerStart;
				let jpegStart = this.jpegStart;
				let data: Uint8Array = new Uint8Array(<ArrayBuffer>this.fileReader.result);
				for (let i = 0; i < data.length; i++) {
					if (data[i] === 0xff && !markerStart) {
						markerStart = true;
					} else if (markerStart) {
						if (data[i] === 0xd8)
							jpegStart = i - 1 + this.lastPosition;
						else if (data[i] === 0xd9)
							this.imagePoints.push([jpegStart, i + this.lastPosition]);

						markerStart = false;
					}
				}
				this.markerStart = markerStart;
				this.jpegStart = jpegStart;
				this.lastPosition += READ_BUFFER;

				let chunkProg = this.readNextChunk();

				if (chunkProg === false) {
					this.done(this.imagePoints);
				} else {
					this.progress(chunkProg);
				}
			});
		}

		readNextChunk() {
			const wouldExceed = this.lastPosition + READ_BUFFER > this.file.size
			if (this.lastPosition > this.file.size) {
				return false;
			} else {
				const nextEnd = wouldExceed ? undefined : READ_BUFFER + this.lastPosition;
				const nextSlice = this.file.slice(this.lastPosition, nextEnd);

				this.fileReader.readAsArrayBuffer(nextSlice);
				return (this.lastPosition / this.file.size) * 100;
			}
		}

		extractPoints(): Promise<Array<Array<number>>> {
			return new Promise(resolve => {
				this.done = resolve;
				this.readNextChunk();
			})
		}

		async extractImages(points: Array<Array<number>>) {
			let sliceReader = new PromiseReader();
			let images = [];

			for (let i = 0; i < points.length; i++) {
				this.progress(i / points.length * 100);
				let point = points[i];
				let fileSlice = this.file.slice(point[0], point[1]);
				let buff = new Uint8Array(await sliceReader.readAsArrayBuffer(fileSlice));

				images.push(URL.createObjectURL(new Blob([buff], { type: "image/jpeg" })))
			}

			return images;
		}
	}

	window.addEventListener("DOMContentLoaded", () => {

		let DOM: DOMObject = {
			fileOpen: document.querySelector("#filePickerOpen"),
			filePicker: document.querySelector("#filePicker"),
			imageContainer: document.querySelector("#imageContainer"),
			emptyText: document.querySelector("#emptyText"),
			imageTemplate: document.querySelector("#imageTemplate"),
			imageViewer: document.querySelector(".image-viewer"),
			imageViewerMain: document.querySelector(".image-viewer img"),
			closeButton: document.querySelector("#closeButton"),
			progressContainer: document.querySelector(".progress"),
			progress: document.querySelector(".progress-bar")
		}
		let clearList = () => {
			let children: NodeListOf<HTMLDivElement> = DOM.imageContainer.querySelectorAll(".col-md-3:not(.d-none)");
			children.forEach(child => DOM.imageContainer.removeChild(child))
		}
		let updateList = (images: string[]) => {
			clearList();

			if (images.length === 0) {
				DOM.emptyText.classList.remove("d-none");
			} else {
				DOM.emptyText.classList.add("d-none");

				for (let i: number = 0; i < images.length; i++) {
					let imageChild = <HTMLDivElement>DOM.imageTemplate.cloneNode(true);
					let imagePreview: HTMLImageElement = imageChild.querySelector("img");

					imageChild.classList.remove("d-none");
					imagePreview.src = images[i];

					imageChild.addEventListener("click", () => {
						DOM.imageViewerMain.src = images[i];
						DOM.imageViewer.classList.remove("d-none");
					})

					DOM.imageContainer.appendChild(imageChild);
				}
			}
		}

		DOM.filePicker.addEventListener("change", (event: Event) => {
			let target = (<HTMLInputElement>event.target);
			if (target.files.length === 0) return;
			let file: File = target.files[0];

			DOM.progressContainer.classList.remove("d-none");
			DOM.progress.style.width = "0%";
			DOM.progress.textContent = "Parsing..";
			DOM.emptyText.classList.add("d-none");
			DOM.fileOpen.classList.add("d-none");

			clearList();
			let thumbReader = new ThumbReader(file);

			thumbReader.progress = (progress: number) => {
				DOM.progress.style.width = progress + "%";
			}

			thumbReader.extractPoints()
				.then(imagePoints => {
					DOM.progress.textContent = "Extracting..";
					return thumbReader.extractImages(imagePoints)
				})
				.then(images => updateList(images))
				.then(() => {
					DOM.progressContainer.classList.add("d-none");
					DOM.fileOpen.classList.remove("d-none");
					DOM.filePicker.value = null;
				});
		})

		DOM.fileOpen.addEventListener("click", () => {
			DOM.filePicker.click();
		})

		DOM.closeButton.addEventListener("click", () => {
			DOM.imageViewer.classList.add("d-none");
		})


	})
})(window, document, console)