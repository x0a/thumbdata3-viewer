import './index.css'

interface DOMObject {
	fileOpen: HTMLButtonElement;
	filePicker: HTMLInputElement;
	progressContainer: HTMLDivElement;
	progress: HTMLDivElement;
	progressText: HTMLDivElement;
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
	filename: string;
	images: Array<string>;
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
		this.filename = "";
		this.images = [];
		this.currentIndex = -1;

		this.unhookNavigation = this.hookNavigation();
		this.closeButton.addEventListener("click", this.close.bind(this));
		this.prevButton.addEventListener("click", this.prevImage.bind(this));
		this.nextButton.addEventListener("click", this.nextImage.bind(this));
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
	createImageURL(image: ArrayBuffer) {
		return URL.createObjectURL(new Blob([image], { type: "image/jpeg" }));
	}
	createImage(imageURL: string) {
		const imageChild = this.imageTemplate.content.cloneNode(true).childNodes[0] as HTMLDivElement;
		const imagePreview = imageChild.querySelector("img") as HTMLImageElement;

		imageChild.classList.add("image-thumbnail");
		imageChild.classList.remove("d-none");

		imagePreview.addEventListener("error", () => {
			console.error("Failed to load image");
			URL.revokeObjectURL(imageURL);
			this.images.splice(this.images.indexOf(imageURL), 1);
			requestAnimationFrame(() => this.updateImages());
		})

		imagePreview.src = imageURL;
		return imageChild;
	}
	update(images: Array<ArrayBuffer>) {
		this.images = images.map(buffer => this.createImageURL(buffer));
		this.updateImages();
	}
	clear() {
		this.clearImages();
		this.images.forEach(url => URL.revokeObjectURL(url));
		this.images = [];
		this.emptyText.classList.remove("d-none");
	}
	clearImages() {
		const children = this.imageContainer.querySelectorAll(".image-thumbnail") as NodeListOf<HTMLDivElement>;
		for (const child of children) {
			this.imageContainer.removeChild(child);
		}
	}
	updateImages() {
		this.clearImages();

		if (!this.images.length) {
			this.emptyText.classList.remove("d-none");
			return;
		} else {
			this.emptyText.classList.add("d-none");
		}

		for (let i = 0; i < this.images.length; i++) {
			const image = this.createImage(this.images[i]);
			image.addEventListener("click", this.showImage.bind(this, i));
			this.imageContainer.appendChild(image);
		}
	}
	showImage(index: number) {
		const imageURL = this.images[index];
		const downloadURL = this.filename + "_" + index + ".jpg";

		this.mainImage.src = imageURL;
		this.mainImageDownload.href = imageURL;
		this.mainImageDownload.download = downloadURL;
		this.mainImageDownload.title = "Download " + downloadURL;
		this.imageViewer.classList.remove("d-none");
		this.mainBrowser.classList.add("d-none");
		this.currentIndex = index;
		this.imageDescription.textContent = `Image ${index + 1} of ${this.images.length}`;
		
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
}
window.addEventListener("DOMContentLoaded", () => {
	const imageViewer = new ImageViewer();

	const DOM: DOMObject = {
		fileOpen: document.querySelector("#filePickerOpen"),
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
			imageViewer.update(data.images)
		}
	})

})