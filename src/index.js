let app = angular.module("thumbdata3App", []);
app.directive('onFileChange', $parse => {
	return {
		restrict: 'A',
		link: (scope, element, attrs) => {
			var onChangeHandler = $parse(attrs.onFileChange);
			element.on('change', event => {
				scope.$apply(() => onChangeHandler(scope, {$event:event}))
			});
			element.on('$destroy', () => element.off());
		}
	};
});

app.controller("main", $scope => {
	$scope.images = [];
	$scope.showimage = -1;

	$scope.openfilepicker = () => {
		document.querySelector("input").click();
	}

	$scope.filepicked = (e) => {
		if(e.target.files.length === 0) return;
		$scope.images = [];

		let file = e.target.files[0];
		let reader = new FileReader();

		reader.addEventListener("loadend", () => {
			let data = new Uint8Array(reader.result);
			let markerStart = false;
			let jpegStart = false;

			for(let i = 0; i < data.length; i++){
				// \xff\xd8 means the start of a jpeg
				// \xff\xd9 means the end of a jpeg
				if(data[i] === 0xff && !markerStart){
					markerStart = true;
				}else if(markerStart){
					if(data[i] === 0xd8)
						jpegStart = i - 1;
					else if(data[i] === 0xd9)
						$scope.images.push(URL.createObjectURL(new Blob([data.slice(jpegStart, i)], {type: "image/jpeg"})));
					
					markerStart = false;
				}
			}
			$scope.$digest();
		});

		reader.readAsArrayBuffer(file)
	}
	$scope.show = (index) => {
		$scope.showimage = index;
	}
});