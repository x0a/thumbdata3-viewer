let gulp = require("gulp");
let cleanCSS = require("gulp-clean-css");
let pug = require("gulp-pug");
let concat = require("gulp-concat");
let minify = require("gulp-uglify-es").default;
let ts = require("gulp-typescript");
let sourcemaps = require("gulp-sourcemaps");

let tsProject = ts.createProject("tsconfig.json");

gulp.task("minify-css", () => {
	return gulp.src("src/*.css")
	.pipe(cleanCSS())
	.pipe(gulp.dest("dist/"))
})

gulp.task("pug", () => {
	return gulp.src("src/*.pug")
	.pipe(pug())
	.pipe(gulp.dest("dist/"))
})

gulp.task("js", () => {
	return tsProject.src()
	.pipe(tsProject())
	.js.pipe(gulp.dest("dist/"))
})

gulp.task("default", gulp.parallel("minify-css", "pug", "js"))