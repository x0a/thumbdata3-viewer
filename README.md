# https://x0a.github.io/thumbdata3-viewer/

Fully client-side HTML5 thumbdata-3 viewer (and general JPEG extractor)

# Development
## Getting started
```bash
git clone https://github.com/x0a/thumbdata3-viewer.git
npm install -g webpack
cd thumbdata3-viewer
npm install
```

## Build
For active development run `npm run watch`, which will start webpack in watch mode.
Then run `npx serve ./dist` and open `http://localhost:5000`, refreshing as needed. You can also open `./dist/index.html` directly in your browser and refresh as needed.

For a final build, run `npm run build`. Files in `./dist` will be ready for distribution
