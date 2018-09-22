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

				for (let i = 0; i < images.length; i++) {
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

			let worker = new Worker("ThumbExtractor.js");
			worker.addEventListener("message", msg => {
				const data = msg.data;

				if (data.status) {
					DOM.progress.textContent = data.status;
				} else if (data.progress) {
					DOM.progress.style.width = data.progress + "%";
				} else if (data.images) {
					DOM.progressContainer.classList.add("d-none");
					DOM.fileOpen.classList.remove("d-none");
					DOM.filePicker.value = null;
					updateList(data.images)
				}
			})
			worker.postMessage({ init: file });
		})

		DOM.fileOpen.addEventListener("click", () => {
			DOM.filePicker.click();
		})

		DOM.closeButton.addEventListener("click", () => {
			DOM.imageViewer.classList.add("d-none");
		})


	})
})(window, document, console)