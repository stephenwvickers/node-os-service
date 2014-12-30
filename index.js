
var child_process = require("child_process");
var fs = require("fs");
var os = require("os");
var util = require ("util");

var serviceWrap;
var runInitialised = false;

var linuxStartStopScript = [
	'#!/bin/sh',
	'',
	'### BEGIN INIT INFO',
	'# Provides:          ##NAME##',
	'# Required-Start:    ',
	'# Required-Stop:     ',
	'# Default-Start:     2 3 4 5',
	'# Default-Stop:      0 1 6',
	'# Short-Description: Start ##NAME## at boot time',
	'# Description:       Enable ##NAME## service.',
	'### END INIT INFO',
	'',
	'# chkconfig:   2345 99 1',
	'# description: ##NAME##',
	'',
	'force_reload () {',
	'	stop',
	'	start',
	'}',
	'',
	'restart () {',
	'	stop',
	'	start',
	'}',
	'',
	'start () {',
	'	echo starting ##NAME##',
	'	start-stop-daemon --start \\',
	'			--oknodo \\',
	'			--background \\',
	'			--quiet \\',
	'			--make-pidfile \\',
	'			--pidfile "##PROGRAM_PATH##.pid" \\',
	'			--startas "##NODE_PATH##" \\',
	'			-- \\',
	'			##NODE_ARGS## \\',
	'			"##PROGRAM_PATH##" \\',
	'			##PROGRAM_ARGS##',
	'	if [ $? -ne 0 ]; then',
	'		echo start ##NAME## failed: $?',
	'	fi',
	'}',
	'',
	'status () {',
	'	start-stop-daemon --status \\',
	'			--quiet \\',
	'			--pidfile "##PROGRAM_PATH##.pid"',
	'	case $? in',
	'		0)',
	'			echo ##NAME## is running',
	'			exit 0',
	'			;;',
	'		1|3)',
	'			echo ##NAME## is NOT running',
	'			exit 1',
	'			;;',
	'		*)',
	'			echo Unable to determine ##NAME## status',
	'			exit 2',
	'			;;',
	'	esac',
	'}',
	'',
	'stop () {',
	'	echo stopping ##NAME##',
	'	start-stop-daemon --stop \\',
	'			--oknodo \\',
	'			--quiet \\',
	'			--pidfile "##PROGRAM_PATH##.pid"',
	'	if [ $? -ne 0 ]; then',
	'		echo stop ##NAME## failed: $?',
	'	else',
	'		if [ -f "##PROGRAM_PATH##.pid" ]; then',
	'			rm "##PROGRAM_PATH##.pid"',
	'		fi',
	'	fi',
	'}',
	'',
	'case $1 in',
	'	force-reload)',
	'		force_reload',
	'		;;',
	'	restart)',
	'		restart',
	'  		;;',
	'	start)',
	'		start',
	'  		;;',
	'	status)',
	'		status',
	'		;;',
	'	stop)',
	'		stop',
	'  		;;',
	'	*)',
	'		echo "usage: $0 <force-reload|restart|start|status|stop>"',
	'		exit 1',
	'		;;',
	'esac'
];

function getServiceWrap () {
	if (! serviceWrap)
		serviceWrap = require ("./build/Release/service");
	return serviceWrap;
}

function add (name, options, cb) {
	if (! cb) {
		cb = arguments[1];
		options = {};
	}

	var nodePath = (options && options.nodePath)
			? options.nodePath
			: process.execPath;

	var programPath = (options && options.programPath)
			? options.programPath
			: process.argv[1];

	if (os.platform() == "win32") {
		var displayName = (options && options.displayName)
				? options.displayName
				: name;
		
		var serviceArgs = [];

		serviceArgs.push (nodePath);

		if (options && options.nodeArgs)
			for (var i = 0; i < options.nodeArgs.length; i++)
				serviceArgs.push (options.nodeArgs[i]);

		serviceArgs.push (programPath);
	
		if (options && options.programArgs)
			for (var i = 0; i < options.programArgs.length; i++)
				serviceArgs.push (options.programArgs[i]);
	
		for (var i = 0; i < serviceArgs.length; i++)
			serviceArgs[i] = "\"" + serviceArgs[i] + "\"";
	
		var servicePath = serviceArgs.join (" ");

		try {
			getServiceWrap ().add (name, displayName, servicePath);
			cb();
		} catch (error) {
			cb(error);
		}
	} else {
		var nodeArgs = [];
		if (options && options.nodeArgs)
			for (var i = 0; i < options.nodeArgs.length; i++)
				nodeArgs.push ("\"" + options.nodeArgs[i] + "\"");

		var programArgs = [];
		if (options && options.programArgs)
			for (var i = 0; i < options.programArgs.length; i++)
				programArgs.push ("\"" + options.programArgs[i] + "\"");

		var nodeArgsStr = nodeArgs.join(" ");
		var programArgsStr = programArgs.join(" ");

		var startStopScript = [];

		for (var i = 0; i < linuxStartStopScript.length; i++) {
			var line = linuxStartStopScript[i];
			
			line = line.replace("##NAME##", name);
			line = line.replace("##NODE_PATH##", nodePath);
			line = line.replace("##NODE_ARGS##", nodeArgsStr);
			line = line.replace("##PROGRAM_PATH##", programPath);
			line = line.replace("##PROGRAM_ARGS##", programArgsStr);
			
			startStopScript.push(line);
		}
		
		var startStopScriptStr = startStopScript.join("\n");
		
		var ctlPath = "/etc/init.d/" + name;
		var ctlOptions = {
			mode: 493 // rwxr-xr-x
		};
		
		fs.writeFile(ctlPath, startStopScriptStr, ctlOptions, function(error) {
			if (error) {
				cb(error);
			} else {
				// Try chkconfig first, then update-rc.d
				var child = child_process.spawn("chkconfig", ["--add", name]);
		
				child.on("exit", function(code) {
					if (code != 0) {
						cb(new Error("chkconfig failed: " + code));
					} else {
						cb();
					}
				});
				
				child.on("error", function(error) {
					if (error.errno == "ENOENT") {
						var child = child_process.spawn("update-rc.d",
								[name, "defaults"]);
		
						child.on("exit", function(code) {
							if (code != 0) {
								cb(new Error("update-rc.d failed: " + code));
							} else {
								cb();
							}
						});
				
						child.on("error", function(error) {
							cb(new Error("chkconfig failed: " + error.errno));
						});
					} else {
						cb(error);
					}
				});
			}
		});
	}
	
	return this;
}

function isStopRequested () {
	return getServiceWrap ().isStopRequested ();
}

function remove (name, cb) {
	if (os.platform() == "win32") {
		try {
			getServiceWrap ().remove (name);
			cb();
		} catch (error) {
			cb(error);
		}
	} else {
		var ctlPath = "/etc/init.d/" + name;

		fs.unlink(ctlPath, function(error) {
			if (error) {
				cb(error);
			} else {
				// Try chkconfig first, then update-rc.d
				var child = child_process.spawn("chkconfig", ["--del", name]);

				child.on("exit", function(code) {
					if (code != 0) {
						cb(new Error("chkconfig failed: " + code));
					} else {
						cb();
					}
				});
		
				child.on("error", function(error) {
					if (error.errno == "ENOENT") {
						var child = child_process.spawn("update-rc.d", [name, "remove"]);

						child.on("exit", function(code) {
							if (code != 0) {
								cb(new Error("update-rc.d failed: " + code));
							} else {
								cb();
							}
						});
		
						child.on("error", function(error) {
							cb(new Error("chkconfig failed: " + error.errno));
						});
					} else {
						cb(error);
					}
				});
			}
		});
	}
}

function run (stdoutLogStream, stderrLogStream, stopCallback) {
	if (! stopCallback) {
		stopCallback = stderrLogStream;
		stderrLogStream = stdoutLogStream;
	}

	if (! runInitialised) {
		process.__defineGetter__('stdout', function() {
			return stdoutLogStream;
		});
		
		process.__defineGetter__('stderr', function() {
			return stderrLogStream;
		});
		
		if (os.platform() == "win32") {
			setInterval (function () {
				if (isStopRequested ()) {
					stopCallback ();
				}
			}, 2000);
		} else {
			process.on("SIGINT", function() {
				stopCallback ();
			});

			process.on("SIGTERM", function() {
				stopCallback ();
			});
		}
		
		runInitialised = true;
	}
	
	if (os.platform() == "win32") {
		getServiceWrap ().run ();
	}
}

function stop (rcode) {
	if (os.platform() == "win32") {
		getServiceWrap ().stop (rcode);
	}
	process.exit (rcode || 0);
}

exports.add = add;
exports.remove = remove;
exports.run = run;
exports.stop = stop;
