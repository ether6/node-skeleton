var mongoose = require('../db');
var Schema = mongoose.Schema;

var userSchema = new Schema({
	password: { type: String, required: true },
	pswd_reset: {
		code: { type: String, required: false },
		attempts: { type: Number, required: false },
	},
	data: {
		profile: {
			email: { type: String, required: true },
			name: { type: String, required: true },
		}
	}
});
var User = mongoose.model('User', userSchema);
module.exports = User;