var someApp = angular.module("someApp", ['ngRoute']);

someApp.config(function($routeProvider, $locationProvider) {
	$routeProvider
		.when("/", {
			templateUrl: 'static/views/profile.html'
		})
		.when("/log-in", {
			templateUrl: 'static/views/log-in.html',
		})
		.when("/new-account", {
			templateUrl: 'static/views/new-account.html'
		})
		.when("/password-forgot", {
			templateUrl: 'static/views/password-forgot.html'
		})
		.when("/password-code", {
			templateUrl: 'static/views/password-code.html'
		})
		.when("/password-reset", {
			templateUrl: 'static/views/password-reset.html'
		})
		.when("/profile", {
			templateUrl: 'static/views/profile.html'
		})
		.otherwise({
			templateUrl: 'static/views/profile.html'
		})

	// configure html5 to get links working on jsfiddle
	$locationProvider.html5Mode(true)
})

someApp.controller('someAppCtrl', function($scope, $http, $location) {
	
	$scope.message = '';
	$scope.create = {};
	$scope.login = {};
	$scope.forgot_pswd = {};
	$scope.reset_pswd = {};
	$scope.loggedIn = false

	// when the page loads, load the user if we have user credentials
	if(typeof(Storage) !== "undefined") {
		$scope.token = localStorage.getItem("token");
		$scope.expires = localStorage.getItem("expires");
		if($scope.token) {
			$http.get('/api/user?access_token=' + $scope.token + '&expires=' + $scope.expires).
				success(function(data, status, headers, config) {
					if(status == 200 && data.user) {
						$scope.user = data.user;
					}
					if(data.message)
						$scope.message = data.message;
					$scope.loggedIn = true
					$location.path('/profile')
				});
		}
	}

	$scope.$watch(function() { return $location.path(); }, function(newValue, oldValue){  
	    if ($scope.loggedIn == false && !(
	    		newValue == '/log-in' ||
	    		newValue == '/password-forgot' ||
	    		newValue == '/password-code' ||
	    		newValue == '/new-account' )
	    ){
	        $location.path('/log-in') 
	    }
	})

	$scope.$logOut = function() { 
		if(typeof(Storage) !== 'undefined') {
			localStorage.removeItem('token')
			localStorage.removeItem('expires')
		}
		$scope.loggedIn = false
		$location.path('/log-in')
	}

	$scope.logIn = function() {
		$http.post('/api/authenticate', $scope.login).
			success(function(data, status, headers, config) {
				if(status == 200) {
					$scope.user = data.user;		
					$scope.loggedIn = true
					$location.path('/profile')

					// if the user wants to "Rmember Me" on login
					if(typeof(Storage) !== "undefined") {
						if($scope.login.remember && data.token) {
							localStorage.setItem("token", data.token);
							localStorage.setItem("expires", data.expires);
						} else {
							localStorage.removeItem(data.token);
							localStorage.removeItem(data.expires);
						}
					}
				}
				if(data.message)
					$scope.message = data.message;
			}).
			error(function(data, status, headers, config) {
				if(data.message)
					$scope.message = data.message;
			});
	}

	$scope.addNewUser = function() {
		$http.post('/api/user', $scope.create).
			success(function(data, status, headers, config) {
				if(status == 200) {
					$scope.user.profile = data.profile;
					$scope.token = data.token;
					$scope.expires = data.expires;
				}
				if(data.message)
					$scope.message = data.message;
			}).
			error(function(data, status, headers, config) {
				console.log(data, status, headers, config);
				if(data.message)
					$scope.message = data.message;
			});
	}

	$scope.forgotPswd = function() {
		$scope.reset_pswd.email = $scope.forgot_pswd.email;
		$http.get('/api/user/password?email=' + $scope.forgot_pswd.email).
			success(function(data, status, headers, config) {
				if(data.message)
					$scope.message = data.message;
				$location.path('/password-code')
			}).
			error(function(data, status, headers, config) {
				if(data.message)
					$scope.message = data.message;
			});
	}

	$scope.resetPswd = function(reset_pswd) {
		data = {
			email: reset_pswd.email,
			password: reset_pswd.password,
			new_password: reset_pswd.new_password,
		}
		$http.post('/api/user/password', data).
			success(function(data, status, headers, config) {
				if(data.message)
					$scope.message = data.message;
			}).
			error(function(data, status, headers, config) {
				if(data.message)
					$scope.message = data.message;
			});
	}

	$scope.codePswd = function(code_pswd) {
		data = {
			email: code_pswd.email,
			new_password: code_pswd.new_password,
			code: code_pswd.code,
		}
		$http.post('/api/user/password', data).
			success(function(data, status, headers, config) {
				if(data.message)
					$scope.message = data.message;
			}).
			error(function(data, status, headers, config) {
				if(data.message)
					$scope.message = data.message;
			});
	}

});
