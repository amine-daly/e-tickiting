const path = require("path");
const { deleteAsync } = require("del");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const RtlCssPlugin = require("rtlcss-webpack-plugin");

// global variables
const rootPath = path.resolve(__dirname);
const distPath = path.join(rootPath, "src", "assets");
const entries = {
  "css/style": "./src/assets/sass/style.scss",
};

const cleanCssOutput = () =>
  deleteAsync(path.join(distPath, "css"), { force: true });

const removeTemporaryJsFiles = () =>
  deleteAsync(path.join(distPath, "css", "*.js"), { force: true });

module.exports = {
  mode: "development",
  stats: "verbose",
  performance: {
    hints: "error",
    maxAssetSize: 10000000,
    maxEntrypointSize: 4000000,
  },
  entry: entries,
  output: {
    // main output path in assets folder
    path: distPath,
    // output path based on the entries' filename
    filename: "[name].js",
  },
  resolve: {
    extensions: [".scss"],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "[name].rtl.css",
    }),
    new RtlCssPlugin({
      filename: "[name].rtl.css",
    }),
    {
      apply: (compiler) => {
        compiler.hooks.beforeRun.tapPromise(
          "CleanCssOutputPlugin",
          cleanCssOutput,
        );
        compiler.hooks.afterEmit.tapPromise(
          "RemoveTemporaryJsPlugin",
          removeTemporaryJsFiles,
        );
      },
    },
  ],
  module: {
    rules: [
      {
        test: /\.scss$/,
        use: [
          MiniCssExtractPlugin.loader,
          "css-loader",
          {
            loader: "sass-loader",
            options: {
              sourceMap: true,
            },
          },
        ],
      },
    ],
  },
};
