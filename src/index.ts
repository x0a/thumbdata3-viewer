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

	interface DOMObject{
		fileOpen: HTMLButtonElement;
		filePicker: HTMLInputElement;
		imageViewer: HTMLDivElement;
		closeButton: HTMLButtonElement;
		imageContainer: HTMLDivElement;
		emptyText: HTMLDivElement;
		imageTemplate: HTMLDivElement;
		imageViewerMain: HTMLImageElement;
	}

	window.addEventListener("DOMContentLoaded", () => {

		let DOM: DOMObject = {
			fileOpen: document.querySelector("#filepickerOpen"),
			filePicker: document.querySelector("#filepicker"),
			imageContainer: document.querySelector("#imageContainer"),
			emptyText: document.querySelector("#emptyText"),
			imageTemplate: document.querySelector("#imageTemplate"),
			imageViewer: document.querySelector(".image-viewer"),
			imageViewerMain: document.querySelector(".image-viewer img"),
			closeButton: document.querySelector("#closeButton"),
		}

		let updateList = (images: string[]) => {
			let children: NodeListOf<HTMLDivElement> = DOM.imageContainer.querySelectorAll(".col-md-3:not(.d-none)");
			children.forEach(child => DOM.imageContainer.removeChild(child))

			if(images.length === 0){
				DOM.emptyText.classList.remove("d-none");
			}else{
				DOM.emptyText.classList.add("d-none");

				for(let i:number = 0; i < images.length; i++){
					let imageChild = <HTMLDivElement> DOM.imageTemplate.cloneNode(true);
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

		DOM.filePicker.addEventListener("change", (event:Event) => {
			let target = (<HTMLInputElement> event.target);
			if(target.files.length === 0) return;

			let file:File = target.files[0];
			let reader:FileReader = new FileReader();

			reader.addEventListener("loadend", () => {
				let data: Uint8Array = new Uint8Array(reader.result);
				let markerStart: boolean = false;
				let jpegStart: number = 0;
				let images: string[] = [];

				for(let i = 0; i < data.length; i++){
					if(data[i] === 0xff && !markerStart){
						markerStart = true;
					}else if(markerStart){
						if(data[i] === 0xd8)
							jpegStart = i - 1;
						else if(data[i] === 0xd9)
							images.push(URL.createObjectURL(new Blob([data.slice(jpegStart, i)], {type: "image/jpeg"})));
						
						markerStart = false;
					}
				}
				updateList(images);
			})

			reader.readAsArrayBuffer(file);
		})

		DOM.fileOpen.addEventListener("click", () => {
			DOM.filePicker.click();
		})

		DOM.closeButton.addEventListener("click", () => {
			DOM.imageViewer.classList.add("d-none");
		})

		
	})
})(window, document, console)