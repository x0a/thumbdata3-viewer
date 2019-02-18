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

import './index.css'

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
	progressText: HTMLDivElement;
	imageDownload: HTMLAnchorElement;
}

window.addEventListener("DOMContentLoaded", () => {
	let filename = "";
	
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
		progress: document.querySelector(".progress-bar"),
		progressText: document.querySelector(".progress-text"),
		imageDownload: document.querySelector("#imageDownload")
	}

	let clearList = () => {
		let children = DOM.imageContainer.querySelectorAll(".image-thumbnail") as NodeListOf<HTMLDivElement>;
		children.forEach(child => DOM.imageContainer.removeChild(child))
	}

	let updateList = (images: ArrayBuffer[]) => {
		clearList();

		if (images.length === 0) {
			DOM.emptyText.classList.remove("d-none");
		} else {
			DOM.emptyText.classList.add("d-none");

			for (let i = 0; i < images.length; i++) {
				const image = images[i]
				const imageURL = URL.createObjectURL(new Blob([image], { type: "image/jpeg" }));
				const imageChild = DOM.imageTemplate.cloneNode(true) as HTMLDivElement;
				const imagePreview = imageChild.querySelector("img") as HTMLImageElement;

				imageChild.classList.add("image-thumbnail");
				imageChild.classList.remove("d-none");

				imagePreview.addEventListener("error", () => {
					console.error("Failed to load image");
					URL.revokeObjectURL(imageURL);
					imageChild.remove();

					if (!DOM.imageContainer.children.length) {
						DOM.emptyText.classList.remove("d-none");
					}
				})

				imagePreview.src = imageURL;

				imageChild.addEventListener("click", () => {
					DOM.imageViewerMain.src = imageURL;
					DOM.imageDownload.href = imageURL;
					DOM.imageDownload.download = filename + "_" + i + ".jpg"
					DOM.imageViewer.classList.remove("d-none");
				})

				DOM.imageContainer.appendChild(imageChild);
			}
		}
	}

	DOM.filePicker.addEventListener("change", (event: Event) => {
		const target = event.target as HTMLInputElement
		if (!target.files || !target.files.length) return;
		let file = target.files[0] as File;

		DOM.progressText.classList.remove("d-none");
		DOM.progressContainer.classList.remove("d-none");
		DOM.progress.style.width = "0%";
		DOM.progress.textContent = "Parsing..";
		DOM.emptyText.classList.add("d-none");
		DOM.fileOpen.classList.add("d-none");

		clearList();
		filename = file.name.replace(/\./, "_");
		worker.postMessage({ file: file });
	})

	DOM.fileOpen.addEventListener("click", () => {
		DOM.filePicker.click();
	})

	DOM.closeButton.addEventListener("click", () => {
		DOM.imageViewer.classList.add("d-none");
	})

	let worker = new Worker("worker.js");
	let lastUpdate = Date.now();

	worker.addEventListener("message", msg => {
		const data = msg.data;

		if (data.status) {
			DOM.progress.textContent = data.status;
		} else if (data.progress) {
			let time = Date.now();

			if (time - lastUpdate > 200) {
				DOM.progress.style.width = data.progress + "%";
				DOM.progressText.textContent = data.text;
				lastUpdate = time;
			}
		} else if (data.images) {
			DOM.progressText.classList.add("d-none");
			DOM.progressContainer.classList.add("d-none");
			DOM.fileOpen.classList.remove("d-none");
			DOM.filePicker.value = "";

			updateList(data.images)
		}
	})

})