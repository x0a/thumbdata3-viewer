//gulp-specific
let gulp = require("gulp");
let cleanCSS = require("gulp-clean-css");
let pug = require("gulp-pug");
let concat = require("gulp-concat");
let minify = require("gulp-uglify-es").default;
let ts = require("gulp-typescript");
let sourcemaps = require("gulp-sourcemaps");

//general
let tsProject = ts.createProject("tsconfig.json");
var exec = require('child_process').exec;

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
	return gulp.src("src/*.ts")
	.pipe(sourcemaps.init())
	.pipe(tsProject())
	.pipe(concat("index.js"))
	.pipe(minify())
	.pipe(sourcemaps.write())
	.pipe(gulp.dest("dist/"))
})
gulp.task("update", (done) => {
	//copy dist folder into github-pages branch
	exec("git subtree push --prefix dist origin gh-pages", (err, stdout, stderr) => {
		done(err);
	})
})
gulp.task("default", gulp.parallel("minify-css", "pug", "js"))