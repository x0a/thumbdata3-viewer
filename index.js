((window, document, console) => {
    window.addEventListener("DOMContentLoaded", () => {
        let DOM = {
            fileOpen: document.querySelector("#filepickerOpen"),
            filePicker: document.querySelector("#filepicker"),
            imageContainer: document.querySelector("#imageContainer"),
            emptyText: document.querySelector("#emptyText"),
            imageTemplate: document.querySelector("#imageTemplate"),
            imageViewer: document.querySelector(".image-viewer"),
            imageViewerMain: document.querySelector(".image-viewer img"),
            closeButton: document.querySelector("#closeButton"),
        };
        let updateList = (images) => {
            let children = DOM.imageContainer.querySelectorAll(".col-md-3:not(.d-none)");
            children.forEach(child => DOM.imageContainer.removeChild(child));
            if (images.length === 0) {
                DOM.emptyText.classList.remove("d-none");
            }
            else {
                DOM.emptyText.classList.add("d-none");
                for (let i = 0; i < images.length; i++) {
                    let imageChild = DOM.imageTemplate.cloneNode(true);
                    let imagePreview = imageChild.querySelector("img");
                    imageChild.classList.remove("d-none");
                    imagePreview.src = images[i];
                    imageChild.addEventListener("click", () => {
                        DOM.imageViewerMain.src = images[i];
                        DOM.imageViewer.classList.remove("d-none");
                    });
                    DOM.imageContainer.appendChild(imageChild);
                }
            }
        };
        DOM.filePicker.addEventListener("change", (event) => {
            let target = event.target;
            if (target.files.length === 0)
                return;
            let file = target.files[0];
            let reader = new FileReader();
            reader.addEventListener("loadend", () => {
                let data = new Uint8Array(reader.result);
                let markerStart = false;
                let jpegStart = 0;
                let images = [];
                for (let i = 0; i < data.length; i++) {
                    if (data[i] === 0xff && !markerStart) {
                        markerStart = true;
                    }
                    else if (markerStart) {
                        if (data[i] === 0xd8)
                            jpegStart = i - 1;
                        else if (data[i] === 0xd9)
                            images.push(URL.createObjectURL(new Blob([data.slice(jpegStart, i)], { type: "image/jpeg" })));
                        markerStart = false;
                    }
                }
                updateList(images);
            });
            reader.readAsArrayBuffer(file);
        });
        DOM.fileOpen.addEventListener("click", () => {
            DOM.filePicker.click();
        });
        DOM.closeButton.addEventListener("click", () => {
            DOM.imageViewer.classList.add("d-none");
        });
    });
})(window, document, console);
