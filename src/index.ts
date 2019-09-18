import * as JSZip from "jszip";
import './index.css'

interface DOMObject {
	fileOpen: HTMLButtonElement;
	filePicker: HTMLInputElement;
	progressContainer: HTMLDivElement;
	progress: HTMLDivElement;
	progressText: HTMLDivElement;
}
interface Image {
	url: string,
	buffer: ArrayBuffer
}

class ImageViewer {
	imageTemplate: HTMLTemplateElement;
	imageContainer: HTMLDivElement;
	imageViewer: HTMLDivElement;
	mainImage: HTMLImageElement;
	mainImageDownload: HTMLAnchorElement;
	emptyText: HTMLDivElement;
	closeButton: HTMLButtonElement;
	prevButton: HTMLButtonElement;
	nextButton: HTMLButtonElement;
	mainBrowser: HTMLDivElement;
	imageDescription: HTMLDivElement;
	zipButton: HTMLButtonElement;
	zipDownload: HTMLAnchorElement;
	progressText: HTMLSpanElement;
	filename: string;
	images: Array<Image>;
	currentIndex: number;
	unhookNavigation: () => any;

	constructor() {
		this.imageTemplate = document.querySelector("#imageTemplate");
		this.imageContainer = document.querySelector("#imageContainer");
		this.imageViewer = document.querySelector(".image-viewer");
		this.mainImage = this.imageViewer.querySelector("img");
		this.mainImageDownload = this.imageViewer.querySelector("#imageDownload");
		this.emptyText = document.querySelector("#emptyText");
		this.closeButton = document.querySelector("#closeButton");
		this.prevButton = document.querySelector("#prevButton");
		this.nextButton = document.querySelector("#nextButton");
		this.mainBrowser = document.querySelector(".main-browser");
		this.imageDescription = document.querySelector(".image-description");
		this.zipButton = document.querySelector("#zipBtn");
		this.zipDownload = document.querySelector(".zip-download");
		this.progressText = document.querySelector(".progress-text");

		this.filename = "";
		this.images = [];
		this.currentIndex = -1;

		this.unhookNavigation = this.hookNavigation();
		this.closeButton.addEventListener("click", this.close.bind(this));
		this.prevButton.addEventListener("click", this.prevImage.bind(this));
		this.nextButton.addEventListener("click", this.nextImage.bind(this));
		this.zipButton.addEventListener("click", this.downloadZIP.bind(this));
	}
	setImages(images: Array<ArrayBuffer>) {
		this.images = images.map(buffer => {
			const blob = new Blob([buffer], { type: "image/jpeg" });
			return {
				url: URL.createObjectURL(blob),
				buffer
			}
		});
		this.renderPage();
	}
	renderImage(image: Image) {
		const imageChild = this.imageTemplate.content.cloneNode(true).childNodes[0] as HTMLDivElement;
		const imagePreview = imageChild.querySelector("img") as HTMLImageElement;

		imageChild.classList.add("image-thumbnail");
		imageChild.classList.remove("d-none");

		imagePreview.addEventListener("error", () => {
			console.error("Failed to load image");
			URL.revokeObjectURL(image.url);
			this.images.splice(this.images.findIndex(({ url }) => image.url === url), 1);
			requestAnimationFrame(() => this.renderPage());
		})

		imagePreview.src = image.url;
		return imageChild;
	}
	renderPage() {
		this.emptyImages();

		if (!this.images.length) {
			this.emptyText.classList.remove("d-none");
			this.zipButton.classList.add("d-none");
			return;
		} else {
			this.emptyText.classList.add("d-none");
			this.zipButton.classList.remove("d-none");
		}

		for (let i = 0; i < this.images.length; i++) {
			const image = this.renderImage(this.images[i]);
			image.addEventListener("click", this.showImage.bind(this, i));
			this.imageContainer.appendChild(image);
		}
	}
	emptyImages() {
		this.imageContainer.querySelectorAll(".image-thumbnail")
			.forEach(child => this.imageContainer.removeChild(child))
	}
	showImage(index: number) {
		const imageURL = this.images[index].url;
		const downloadURL = this.filename + "_" + index + ".jpg";

		this.mainImage.src = imageURL;
		this.mainImageDownload.href = imageURL;
		this.mainImageDownload.download = downloadURL;
		this.mainImageDownload.title = "Download " + downloadURL;
		this.imageViewer.classList.remove("d-none");
		this.mainBrowser.classList.add("d-none");
		this.imageDescription.textContent = `Image ${index + 1} of ${this.images.length}`;

		this.currentIndex = index;

		if (index === 0) {
			this.prevButton.setAttribute("disabled", "true");
		} else {
			this.prevButton.removeAttribute("disabled");
		}

		if (index === this.images.length - 1) {
			this.nextButton.setAttribute("disabled", "true");
		} else {
			this.nextButton.removeAttribute("disabled");
		}
	}
	nextImage() {
		const index = this.currentIndex + 1;
		if (index >= this.images.length) return;
		this.showImage(index);
	}
	prevImage() {
		const index = this.currentIndex - 1;
		if (index < 0) return;
		this.showImage(index);
	}
	close() {
		this.currentIndex = -1;
		this.imageViewer.classList.add("d-none");
		this.mainBrowser.classList.remove("d-none");
	}
	clear() {
		this.emptyImages();
		this.images.forEach(({ url }) => URL.revokeObjectURL(url));
		this.images = [];
		this.emptyText.classList.remove("d-none");
		this.zipButton.classList.add("d-none");
	}
	generateZIP(): Promise<Blob> {
		const archive = new JSZip();

		this.zipButton.disabled = true;
		this.progressText.textContent = "0%";
		this.progressText.classList.remove("d-none");

		for (let i = 0; i < this.images.length; i++) {
			const image = this.images[i];
			archive.file((i + 1) + ".jpg", image.buffer);
		}
		return archive.generateAsync({ type: "blob" }, ({ percent }) => {
			this.progressText.textContent = "Zipping " + percent.toFixed(0) + "%";
		})
			.then(blob => {
				this.progressText.classList.add("d-none");
				this.zipButton.disabled = false;
				return blob;
			})
	}
	downloadZIP() {
		this.generateZIP()
			.then(blob => {
				const url = URL.createObjectURL(blob);
				const download = this.filename + ".zip";
				this.zipDownload.download = download;
				this.zipDownload.href = url;
				this.zipDownload.click();
			})
	}

	hookNavigation() {
		const navHook = (event: KeyboardEvent) => {
			if (this.currentIndex === -1) return;

			if (event.keyCode === 37) { // Left key
				this.prevImage();
			} else if (event.keyCode === 39) { // Right key
				this.nextImage();
			} else if (event.keyCode === 27) { // Esc key
				this.close();
			}
		}
		window.addEventListener("keydown", navHook)
		return () => window.removeEventListener("keydown", navHook);
	}
}
window.addEventListener("DOMContentLoaded", () => {
	const imageViewer = new ImageViewer();

	const DOM: DOMObject = {
		fileOpen: document.querySelector("#filePickerBtn"),
		filePicker: document.querySelector("#filePicker"),
		progressContainer: document.querySelector(".progress"),
		progress: document.querySelector(".progress-bar"),
		progressText: document.querySelector(".progress-text"),
	}

	const getWorker = (): [EventTarget, (message: any) => any] => {
		let worker: EventTarget;
		let sendMessage: (message: any) => any;

		try {
			if (location.protocol === "file:") throw "Nope";
			console.log("Thumbdata3Viewer: Loading thumbparser as Worker")

			worker = new Worker("worker.js");
			sendMessage = (message: any) => (worker as any as Worker).postMessage(message);
		} catch (e) {
			console.log("Thumbdata3Viewer: Unable to load parser as worker, loading as script instead");

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
		DOM.fileOpen.classList.add("d-none");

		imageViewer.clear()
		imageViewer.filename = file.name.replace(/\./, "_");
		sendMessage({ file: file });
	})

	DOM.fileOpen.addEventListener("click", () => {
		DOM.filePicker.click();
	})

	const [worker, sendMessage] = getWorker();

	worker.addEventListener("message", (event: MessageEvent) => {
		const message = event.data;

		if (message.status) {
			DOM.progress.textContent = message.status;
		} else if (message.progress) {
			DOM.progress.style.width = message.progress + "%";
			DOM.progressText.textContent = message.text;
		} else if (message.images) {
			DOM.progressText.classList.add("d-none");
			DOM.progressContainer.classList.add("d-none");
			DOM.fileOpen.classList.remove("d-none");
			DOM.filePicker.value = "";
			imageViewer.setImages(message.images)
		}
	})

})