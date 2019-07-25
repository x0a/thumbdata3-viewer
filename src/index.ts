import './index.css'

interface DOMObject {
	fileOpen: HTMLButtonElement;
	filePicker: HTMLInputElement;
	imageViewer: HTMLDivElement;
	closeButton: HTMLButtonElement;
	imageContainer: HTMLDivElement;
	emptyText: HTMLDivElement;
	imageTemplate: HTMLTemplateElement;
	imageViewerMain: HTMLImageElement;
	progressContainer: HTMLDivElement;
	progress: HTMLDivElement;
	progressText: HTMLDivElement;
	imageDownload: HTMLAnchorElement;
}
class ImageViewer {
	imageTemplate: HTMLElement;
	constructor() {
		this.imageTemplate = document.querySelector("#imageTemplate")
	}
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
				const imageChild = DOM.imageTemplate.content.cloneNode(true).childNodes[0] as HTMLDivElement;
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
	let getWorker = () => {
		let worker: any;
		let sendMessage;

		try {
			if(location.protocol === "file:") throw "Nope";
			
			worker = new Worker("worker.js");
			sendMessage = (message: any) => (worker as any as Worker).postMessage(message);
		} catch (e) {
			let script = document.createElement("script");
			script.setAttribute("src", "worker.js");
			document.head.appendChild(script);
			worker = window;
			sendMessage = (message: any) => (worker as any as Window).postMessage(message, "*");
		}

		return [worker, sendMessage];
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
		sendMessage({ file: file });
	})

	DOM.fileOpen.addEventListener("click", () => {
		DOM.filePicker.click();
	})

	DOM.closeButton.addEventListener("click", () => {
		DOM.imageViewer.classList.add("d-none");
	})

	let [worker, sendMessage] = getWorker();

	worker.addEventListener("message", (msg: MessageEvent) => {
		const data = msg.data;

		if (data.status) {
			DOM.progress.textContent = data.status;
		} else if (data.progress) {
			DOM.progress.style.width = data.progress + "%";
			DOM.progressText.textContent = data.text;
		} else if (data.images) {
			DOM.progressText.classList.add("d-none");
			DOM.progressContainer.classList.add("d-none");
			DOM.fileOpen.classList.remove("d-none");
			DOM.filePicker.value = "";

			updateList(data.images)
		}
	})

})