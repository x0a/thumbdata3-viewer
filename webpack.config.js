const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin")

module.exports = {
  entry: {
    "index": "./src/index.ts",
    "worker": "./src/worker.ts"
  },
  mode: "production",
  plugins: [
    new HtmlWebpackPlugin({
      template: "./src/index.pug",
      filename: "index.html",
      excludeChunks: ["worker"]
    }),
  ],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/
      },
      {
        test: /\.pug$/,
        use: "pug-loader"
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ]
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js", ".css"]
  },
  output: {
    path: path.resolve(__dirname, "dist")
  }
};