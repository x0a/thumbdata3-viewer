let gulp = require("gulp");
let cleanCSS = require("gulp-clean-css");
let pug = require("gulp-pug");
let minify = require("gulp-uglify-es").default;

gulp.task("minify-css", () => {
	return gulp.src("../src/*.css")
	.pipe(cleanCSS())
	.pipe(gulp.dest("../dist"))
})

gulp.task("pug", () => {
	return gulp.src("../src/*.pug")
	.pipe(pug())
	.pipe(gulp.dest("../dist/"))
})

gulp.task("js", () => {
	return gulp.src("../src/*.js")
	.pipe(minify())
	.pipe(gulp.dest("../dist"))
})

gulp.task("default", gulp.parallel("minify-css", "pug", "js"))