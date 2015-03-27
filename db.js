var mongoose = require('mongoose');
mongoose.connect('mongodb://0.0.0.0/something', function () {
  console.log('mongodb connected');
})
module.exports = mongoose;