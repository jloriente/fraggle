var fs = require('fs')
var path = require('path')
var child_process = require('child_process')
var sys = require('sys')
//require('colors')
var ejs = require('ejs')
var settings = require('./settings');
var isNginx = settings.isNginx();


var basePath = process.env.FRAGGLE_BASE_PATH || process.cwd()
var repos = settings.get('deploymentPath', path.join(basePath, 'repos'))
var logs = path.join(basePath, 'logs')
var conf = path.join(basePath, settings.get('defaultConfFile', 'config.json'))
var outputConfFile = path.join(basePath, 'server.conf')
var minport = 9000


var ejsTemplateFile = path.join(basePath, settings.get( 'serverTemplate', 'haproxy.ejs' ))
var nginxConfPath = settings.get( 'nginxConfPath' , '/etc/nginx/node' )
var nginxConfFileName = settings.get( 'nginxConfFileName' , 'node-default' )

function availablePort(config) {
	var p = minport
	while(!isAvailable(config, p)) {
		p++
	}
	return p
}

function isAvailable(config, p) {
	for (var key in config) {
		var running = config[key].running
		if (!running) {
			continue
		}

		for (var subdomain in running) {
			var port = running[subdomain].port
			if (port === p) {
				return false
			}
		}
	}
	return true
}

function execAndPrint(command, args, options, callback) {
    
    console.log('execAndPrint: ' + command );
    console.log(args);
    console.log(options);

	var proc = child_process.spawn(command, args, options)

	proc.stdout.on('data', function (data) {
		process.stdout.write(data)
	})

	proc.stderr.on('data', function (data) {
		process.stderr.write(data)
	})

	proc.on('exit', function (code) {
		if (code !== 0) {
			callback([command, args.join(' '), 'exited with code', code].join(' '))
		} else {
			callback(null)
		}
	})
}

function createDirectories(callback) {
	createPath(repos, function() {
		createPath(logs, function() {
			callback()
		})
	})
}

function createPathAsRoot(p, callback) {
   execAndPrint('sudo', [ 'mkdir', '-p', p ], null, callback);
}

function createPath(p, callback) {
	path.exists(p, function(exists) {
        console.log('creating path ' + p)
		if (!exists) {
			fs.mkdir(p, "0755", function() {
                console.log('created');
				callback()
				return
			})
		} else {
			callback()
		}
	})
}

function findSubdomain(config, subdomain) {
	for (var key in config) {
		var i = subdomain.indexOf(key)
		if (i > 1 && subdomain.charAt(i-1) === '.' && subdomain.length === i + key.length) {
			return {domain:key, tag:subdomain.substring(0, i-1)}
		}
	}
	return {}
}

var actions = {

	'add': function(config, callback) {
		var domain = process.argv[3]
		var repo = process.argv[4]
		var executable = process.argv[5]

		if (!domain || !repo || !executable) {
			console.log('Usage: add <domain> <repo> <executable>')
			callback(false, false)
		} else {
			// TODO: if already exists
			config[domain] = {repo:repo, executable:executable}
			callback(true, true)
		}
	},

	'deploy': function(config, callback) {
		var subdomain = process.argv[3]
		var port = availablePort(config)

		if (!subdomain) {
			console.log('Usage: deploy <tag>.<domain>')
			callback(false, false)
			return
		} else {
			var info = findSubdomain(config, subdomain)
			var domain = info.domain
			var tag = info.tag

			if (!domain || !tag) {
				console.log('Service not found. Use <add> first')
				callback(false, false)
				return
			} else if (!config[domain].executable || !config[domain].repo) {
				console.log('Invalid config for', domain, 'no executable or no repo found')
				callback(false, false)
				return
			} else {
				var repo = config[domain].repo
				var executable = config[domain].executable
				var args = null
                
				if (repo.indexOf('git@') === 0) {
					command = 'git'
					args = ['clone', repo, path.join(repos, subdomain)]
				} else {
					console.log('Unknown repo type', repo)
					callback(false, false)
					return
				}

				createDirectories(function() {
					execAndPrint(command, args, null, function(error) {
                        console.log('innnn : ' + command ); 
                        console.log(args);
                        console.log(error);
						if (error) {
							console.log(error)
							callback(false, false)
							return
						}

						if (repo.indexOf('git@') === 0) {
							command = 'git'
							args = ['checkout', tag]
						}
                        
                        // Checkout repo
						execAndPrint(command, args, {cwd: path.join(repos, subdomain)}, function(error) {
                                console.log('back : ' + command  + args )
							if (error) {
								console.log(error)
								callback(false, false)
								return
							}
                             
                            var running = config[domain].running || {}
                            running[subdomain] = { port:port, path : repos}
                            config[domain].running = running
                            callback(true, true)
                            
                            // TODO: review this, forever replaced with monit 
                            if ( executable !== 'none'){
                                command = 'forever'
                            
                                // Temporally use forever without 'start' param
                                args = ['start', '-a',
                                    '-l', path.join(logs, subdomain+'_l.txt'),
                                    '-o', path.join(logs, subdomain+'_o.txt'),
                                    '-e', path.join(logs, subdomain+'_e.txt'),
                                    path.join(subdomain, executable),
                                    port
                                ]

                                /*
                                args = [ '-a',
                                    '-l', path.join(logs, subdomain+'_l.txt'),
                                    '-o', path.join(logs, subdomain+'_o.txt'),
                                    '-e', path.join(logs, subdomain+'_e.txt'),
                                     path.join(subdomain, executable),
                                    port
                                ]
                                */
                                

                                // Exec forever
                                // Not used: we use monit instead
                               /* execAndPrint(command, args, {cwd: repos}, function(error) {
                                    if (error) {
                                        console.log('ERROR ' + error)
                                        callback(false, false)
                                        return
                                    }
                                    var running = config[domain].running || {}
                                    running[subdomain] = { port:port }
                                    config[domain].running = running

                                    callback(true, true)
                                })
                               */
                            }
						})
					})
				})
			}
		}

	},

	'delete': function(config, callback) {
		var subdomain = process.argv[3]
		var port = availablePort(config)

		if (!subdomain) {
			console.log('Usage: delete <tag>.<domain>')
			callback(false, false)
			return
		} else {
			var info = findSubdomain(config, subdomain)
			var domain = info.domain
			var tag = info.tag

			if (!domain || !tag) {
				console.log('Service not found. Use <add> first')
				callback(false, false)
				return
			} else if (!config[domain].executable) {
				console.log('Invalid config for', domain, 'no executable found')
				callback(false, false)
				return
			}

			var executable = config[domain].executable

			var command = 'forever'
			var args = ['stop', path.join(subdomain, executable)]
			execAndPrint(command, args, {cwd: repos}, function(error) {
				if (error) {
					console.log(error)
					callback(false, false)
					return
				}

				var command = 'rm'
				var args = ['-rf', path.join(repos, subdomain)]
				execAndPrint(command, args, null, function(error) {
					if (error) {
						console.log(error)
						callback(false, false)
						return
					}

					var running = config[domain].running || {}
					delete running[subdomain]
					config[domain].running = running

					callback(true, true)
				})

			})
		}
	},

	'list': function(config, callback) {
		for (var key in config) {
			sys.puts(key.green)

			var running = config[key].running
			if (!running) {
				sys.puts('No running processes')
			} else {
				for (var subdomain in running) {
					var info = running[subdomain]
					console.log(subdomain.blue, (info.port+'').magenta, running[subdomain].prod ? 'PROD' : '')
				}
			}
		}
		callback(false, false)
	},

	'default': function(config, callback) {
		var subdomain = process.argv[3]
		var port = availablePort(config)

		if (!subdomain) {
			console.log('Usage: default <tag>.<domain>')
			callback(false, false)
			return
		} else {
			var info = findSubdomain(config, subdomain)
			var domain = info.domain
			var tag = info.tag

			if (!domain || !tag) {
				console.log('Service not found. Use <add> first')
				callback(false, false)
				return
			} else if (!config[domain].running || !config[domain].running[subdomain]) {
				console.log('Service not running. Use <deploy> first')
				callback(false, false)
				return
			} else {
				var running = config[domain].running
				for (var sub in running) {
					delete running[sub].prod
				}

				config[domain].running[subdomain].prod = true
				callback(true, true)
			}
		}
	}

}

// Restart server - nginx or haproxy - from command line
function restartServerCommand(){
    var pid = '/var/run/' + (isNginx ? 'nginx.pid' : 'haproxy.pid');
    var execPath = isNginx ? '/usr/sbin/nginx' : '/usr/local/sbin/haproxy';
    fs.readFile( pid, 'ascii', function(err, content) {
        var args = null
        if (err) {
            sys.puts('ERROR: ' + err);
            args = [ execPath, '-f', outputConfFile, '-p', pid, '-st']
        } else {
            content = content.replace(/^\s*|\s*$/g,"")
            if(!isNginx){
                args = [ execPath, '-f', outputConfFile, '-p', pid, '-st', content]
            }else{
                //args = [ execPath, '-s', 'reload' ,'-c', outputConfFile, '-g', '"'+'pid '+pid+';"']
                args = [ execPath, '-s', 'reload' ,'-c', outputConfFile ]
            }
        }

        var command = 'sudo'

        execAndPrint(command, args, null, function(error) {
            if (error) {
                console.log(error)
            } else {
                console.log( isNginx ? 'Nginx restarted' : 'HAProxy restarted')
            }
        })
    })
}

// Restart ngix using init.d script
// 1.- copy nginx conf file to /etc
// 2.- restart nginx
function restartServerInitd(){
    createPathAsRoot( nginxConfPath, function(){
        // cp nginx conf to /etc/
        var confFile = path.join( nginxConfPath, nginxConfFileName );
        var args = [ 'cp', outputConfFile, confFile ]
        var command = 'sudo'
        execAndPrint(command, args, null, function(err){
            if (err){
                console.log(err);
            }else{
                console.log( 'Nginx conf file created ' + nginxConfFileName )
                var execPath ='/etc/init.d/nginx';
                args = [ execPath, 'restart'];
                command = 'sudo'
                execAndPrint(command, args, null, function(error) {
                    if (error) {
                        console.log(error)
                    } else {
                        console.log('Nginx restarted')
                    }
                })
            }
        })
    });
}


var action = process.argv[2]

if (!action) {
	console.log('Must pass an action')
} else {
	var f = actions[action]

	if (!f) {
		console.log('Unknown action', action)
	} else {
        
        // Read the config.json file
		var services = fs.readFile(conf, 'utf8', function(err, data) {
			if (err) {
				console.log(err)
			}

			if (data) {
				try {
					data = JSON.parse(data)
                    console.log(data);
				} catch(e) {
					console.log('Error parsing data')
					console.log(data)
				}
			}
			data = data || {}
            // Call the action passing the data
			f(data, function(requires_config_save, requires_proxy_restart) {

                // Callback run after action 
				if (requires_config_save) {
					fs.writeFile(conf, JSON.stringify(data), function(err) {
						console.log('Saving config file: ' + conf )
					});
				}

				if (requires_proxy_restart) {
					fs.readFile(ejsTemplateFile, 'utf8', function(err, template) {
						if (err) {
							console.log('Error reading ' + ejsTemplateFile)
							return
						}

                        sys.puts('Rendering template with data: ');
                        console.log(data);

                        var out = ejs.render(template, {locals:{data:data}})

                        sys.puts('Result from ejs render: ' + out)
                        sys.puts('Saving to file: ' + sys.inspect(outputConfFile));

						fs.writeFile( outputConfFile, out, function(err) {
							if (err) {
								console.log('Error writing configuration file ' + outputConfFile )
								return
							}

                            if (!isNginx) {
                                restartServerCommand();
                            }else{
                                restartServerInitd();
                            }
						})
					})
				}

			})

		})
	}
}
