const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './src/index.ts',
  output: {
    library: 'GoldenLayout',
    libraryTarget: 'umd',
    path: path.resolve(__dirname, 'build'),
    filename: 'golden-layout.js',
  },
  resolve: {
    extensions: [ ".ts", ".tsx", ".js" ],
  },
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: ['ts-loader'],
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(woff(2)?|ttf|eot|svg|png)(\?v=\d+\.\d+\.\d+)?$/,
        use: ['file-loader'],
      },
      {
        test: /\.less$/i,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              sourceMap: true,
            },
          },
          {
            loader: 'less-loader',
            options: {
              sourceMap: true,
            },
          },
        ],
      }
    ],
  },
  plugins: [
    //new CopyWebpackPlugin({ patterns: [{ from: '**/*.{html,scss,less,css,woff,ttf,eot,svg,png,woff2}', context: 'assets/' }] }),
  ],
};
