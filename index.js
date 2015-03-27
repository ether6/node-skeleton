var User = require('./models/user');
var express = require('express');
var jwt = require('jwt-simple');
var bcrypt = require('bcrypt');
var bodyParser = require('body-parser');
var url = require('url');
var nodemailer = require('nodemailer');
var app = express();

app.set('name', 'myApp');
app.set('jwtTokenSecret', 'put some long hash here');
app.set('email', 'surfingtheether@gmail.com');

app.use(bodyParser.json());
app.use('/static', express.static(__dirname + '/public'));

// Note that you will need to access:
//
		// https://www.google.com/accounts/DisplayUnlockCaptcha
		// https://www.google.com/settings/security/lesssecureapps
//
// from the gmail account you wish to use. This has security implications
var transporter = nodemailer.createTransport({
		service: 'Gmail',
		auth: {
				user: app.get('email'),
				pass: ''
		}
});

/*
// This bit lets you add something like :id to an endpoint (e.x. /api/user/:id)
//
app.param('id', function (req, res, next, id) {
	next();
});
*/





// middleware
var jwtauth = function(req, res, next){
	var parsed_url = url.parse(req.url, true)
	var token = (req.body && req.body.access_token) || parsed_url.query.access_token || req.headers["x-access-token"];
	if (token) {
		try {
			var decoded = jwt.decode(token, app.get('jwtTokenSecret'))
			if (decoded.exp <= Date.now()) {
				res.end('Access token has expired', 400)        
			}
			User.findById(decoded.iss, function(err, user){
				console.log(user);
				if (!err) {         
					req.user = user                 
					return next()
				}
			})
		} catch (err) {     
			return next()
		}
	} else {
		next()
	}
}
// It's one thing to authenticate, and it's another to require autentication
var requireAuth = function(req, res, next) {
	if (!req.user) {
		res.status(401).json({message: 'could not authenticate'});
		return next();
	} else {
		next()
	}
}

var authenticate = function(req, res, next) {
	// authenitcation with email/password comparison
	if(typeof req.body.email == undefined || typeof req.body.password == undefined) {
		// email or pswd not sent
		res.status(401).json({message: 'Please verify your email/pswd'});
	} else {
		User.findOne({'data.profile.email': decodeURIComponent(req.body.email)}, function (err, user) {
			if(user) { 
				bcrypt.compare(req.body.password, user.password, function (err, compare) {
					if(compare) {
						var expires = new Date().setDate(new Date().getDate() + 7);
						var token = jwt.encode({
							iss: user['_id'],
							exp: expires
						}, app.get('jwtTokenSecret'));
						req.user = user
						req.token = token
						req.expires = expires
						return next()
					} else
						return next()
				}); // end password compare
			}
		});
	}
}


// Validate a username (email) and password pair
app.post('/api/authenticate', authenticate, function (req, res) {
	if (!req.user) {
		res.status(401).json({message: 'could not authenticate'});
	} else {
		res.status(200).json({
			user: req.user.data,
			token : req.token,
			expires: req.expires,
			message: 'successfully logged in',
		});
	}
});

// User has forgotten password
app.get('/api/user/password', function (req, res) {
	var parsed_url = url.parse(req.url, true);
	var email = decodeURIComponent(parsed_url.query.email);
	User.findOne({'data.profile.email': email}, function (err, user) {
		if(err || !user) { 
				// user not found or incorrect username
				res.status(401).json({message: 'An account with that email was not found'});
			} else {
				var code = Math.floor(Math.random()*90000) + 10000;
				
				// Here we email a verification code. Maybe you would rather text it?
				transporter.sendMail({
					from: app.get('email'),
					to: decodeURIComponent(email),
					subject: app.get('name') + ' Verification Code',
					text: 'Here is your verification code: ' + code,
				}, function(error, info){
					if(error) {
						res.status(200).json({message: 'Something went wrong. Please contact site admin at: ' + app.get('email')});
					} else {
						user.pswd_reset.code = code;
						user.pswd_reset.attempts = 0;
						user.save(function (err, post) {
							// error saving user in db
							if(err)
								res.status(401).json(err);
							else
								res.status(200).json({
									message: 'Check your inbox for the verification code',
									redirect: 'reset-pswd'
								});
						});
					}
				});
			}
	});
});

// Attempt to reset password
app.post('/api/user/password', authenticate, function (req, res, next) {
	// user has authenticated, so we replace old password with the new password
	if (req.user) {
		var user = req.user
		bcrypt.genSalt(10, function (err, salt) {
			// error encrypting pswd
			if(err) {
				res.status(401).json(err);
				return next()
			}
			bcrypt.hash(req.body.new_password, salt, function(err, crypted) {
				// error creating hash
				if(err) {
					res.status(401).json(err);
					return next()
				}
				user.password = crypted
				user.save(function (err, post) {
					// error saving user in db
					if(err) {
						res.status(401).json(err);
						return next()
					}
					res.status(200).json({message: 'Password successfully reset'});
				});
			});
		});
	} else if(typeof req.body.code != 'undefined') {
		// otherwise lookup user by email address and compare the random
		// generated reset code that we sent
		User.findOne({'data.profile.email': decodeURIComponent(req.body.email)}, function (err, user) {
			if(err || !user) { 
				res.status(401).json({message: 'An account with that email was not found'});
				return next();
			} else {
				if(user.pswd_reset.attempts >= 3) {
					res.status(401).json({message: 'You have exceeded the maximum number of attempts'});
					return next();
				}
				if(req.body.code == user.pswd_reset.code) {
					bcrypt.genSalt(10, function (err, salt) {
						// error encrypting pswd
						if(err) {
							res.status(401).json(err);
							return next()
						}
						bcrypt.hash(req.body.new_password, salt, function(err, crypted) {
							// error creating hash
							if(err) {
								res.status(401).json(err);
								return next()
							}
							user.password = crypted
							user.save(function (err, post) {
								// error saving user in db
								if(err) {
									res.status(401).json(err);
									return next()
								}
								res.status(200).json({message: 'Password successfully reset'});
							});
						});
					});
				} else {
					user.pswd_reset.attempts++;
					user.save(function (err, post) {
						// error saving user in db
						if(err) {
							res.status(401).json(err);
							return next()
						}
						else
							res.status(401).json({message: 'The code did not match'});
					});
				}
			}
		});
	} else {
		res.status(401).json({message: 'Could not authenticate'});
	}
});

// Create a new user
app.post('/api/user', function (req, res) {
	if(typeof req.body.email == undefined || typeof req.body.password == undefined) {
		// username or pswd not sent
		res.status(401).json({message: 'Please verify your email/pswd'});
	} else {
		User.findOne({'data.profile.email': decodeURIComponent(req.body.email)}, function (err, user) {
			if(user) {
				res.status(401).json({message: 'This account already exists'});
			} else {
				bcrypt.genSalt(10, function (err, salt) {
					// error encrypting pswd
					if(err) {
						res.status(401).json(err);
						return next();
					}
					bcrypt.hash(req.body.password, salt, function(err, crypted) {
						// error creating hash
						if(err)
							res.status(401).json(err);
						// check to see if user is in the db

						var user = new User({
							data: {
								profile: {
									email: req.body.email,
									name: req.body.name,
								},
							},
							password: crypted
						})
						user.save(function (err, post) {
							// error saving user in db
							if(err)
								res.status(401).json(err);
							else
								res.status(201).json({
									user: user.data,
									message: 'Account Created'
								});
						});
					}); // end hash pswd
				}); // end generate salt
			}
		});
	}
});

// Retreive user data from the database (user is delivered from jwtauth())
app.get('/api/user', jwtauth, requireAuth, function (req, res) {
		res.status(200).json({user: req.user.data});
});

app.get('*', function(req, res){
  return res.redirect('/static/')
})

app.listen(3000, function () {
	console.log('Server listening on', 3000)
});



