var path = require('path')
const webpack = require('webpack')

module.exports = {
  entry: {
    webrtc: path.join(__dirname,'./src/webrtc/index.js'),
    webrtcVideo:  './src/webrtcVideo',
    index: path.join(__dirname, './src/index.js'),
  },
  output: {
    filename: '[name].js',
    path: path.join(__dirname, './build')
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        loader: 'babel',
        query: {
          presets:'es2015',
        },
        exclude: /node_modules/,
        include: __dirname
      },
      {
        test: /\.styl$/,
        loader: 'style-loader!css-loader!stylus-loader',
        exclude: /node_modules/,
        include: __dirname
      }
    ],
  },
  plugins: [
    new webpack.optimize.UglifyJsPlugin({
      compress: {
        warnings: false
      }
    })
  ],
  resolve: {
    extensions: ['', '.js', '.styl']
  }
}
