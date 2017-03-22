
var child_process = require("child_process");
var fs = require("fs");
var os = require("os");
var util = require ("util");

var serviceWrap;
var runInitialised = false;

var linuxStartStopScript = [
	'#!/bin/bash',
	'',
	'### BEGIN INIT INFO',
	'# Provides:          ##NAME##',
	'# Required-Start:    ',
	'# Required-Stop:     ',
	'# Default-Start:     ##RUN_LEVELS_ARR##',
	'# Default-Stop:      0 1 6',
	'# Short-Description: Start ##NAME## at boot time',
	'# Description:       Enable ##NAME## service.',
	'### END INIT INFO',
	'',
	'# chkconfig:   ##RUN_LEVELS_STR## 99 1',
	'# description: ##NAME##',
	'',
	'set_pid () {',
	'	unset PID',
	'	_PID=`head -1 "##PROGRAM_PATH##.pid" 2>/dev/null`',
	'	if [ $_PID ]; then',
	'		kill -0 $_PID 2>/dev/null && PID=$_PID',
	'	fi',
	'}',
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
	'	CNT=5',
	'',
	'	set_pid',
	'',
	'	if [ -z "$PID" ]; then',
	'		echo starting ##NAME##',
	'',
	'		"##NODE_PATH##" ##NODE_ARGS## "##PROGRAM_PATH##" ##PROGRAM_ARGS## >/dev/null 2>&1 &',
	'',
	'		echo $! > "##PROGRAM_PATH##.pid"',
	'',
	'		while [ : ]; do',
	'			set_pid',
	'',
	'			if [ -n "$PID" ]; then',
	'				echo started ##NAME##',
	'				break',
	'			else',
	'				if [ $CNT -gt 0 ]; then',
	'					sleep 1',
	'					CNT=`expr $CNT - 1`',
	'				else',
	'					echo ERROR - failed to start ##NAME##',
	'					break',
	'				fi',
	'			fi',
	'		done',
	'	else',
	'		echo ##NAME## is already started',
	'	fi',
	'}',
	'',
	'status () {',
	'	set_pid',
	'',
	'	if [ -z "$PID" ]; then',
	'		exit 1',
	'	else',
	'		exit 0',
	'	fi',
	'}',
	'',
	'stop () {',
	'	CNT=5',
	'',
	'	set_pid',
	'',
	'	if [ -n "$PID" ]; then',
	'		echo stopping ##NAME##',
	'',
	'		kill $PID',
	'',
	'		while [ : ]; do',
	'			set_pid',
	'',
	'			if [ -z "$PID" ]; then',
	'				rm "##PROGRAM_PATH##.pid"',
	'				echo stopped ##NAME##',
	'				break',
	'			else',
	'				if [ $CNT -gt 0 ]; then',
	'					sleep 1',
	'					CNT=`expr $CNT - 1`',
	'				else',
	'					echo ERROR - failed to stop ##NAME##',
	'					break',
	'				fi',
	'			fi',
	'		done',
	'	else',
	'		echo ##NAME## is already stopped',
	'	fi',
	'}',
	'',
	'case $1 in',
	'	force-reload)',
	'		force_reload',
	'		;;',
	'	restart)',
	'		restart',
	'		;;',
	'	start)',
	'		start',
	'		;;',
	'	status)',
	'		status',
	'		;;',
	'	stop)',
	'		stop',
	'		;;',
	'	*)',
	'		echo "usage: $0 <force-reload|restart|start|status|stop>"',
	'		exit 1',
	'		;;',
	'esac'
];

var linuxSystemUnit = [
	'[Unit]',
	'Description=##NAME##',
	'After=network.target',
	'',
	'[Service]',
	'Type=simple',
	'StandardOutput=null',
	'StandardError=null',
	'UMask=0007',
	'ExecStart=##NODE_PATH## ##NODE_ARGS## ##PROGRAM_PATH## ##PROGRAM_ARGS##',
	'',
	'[Install]'
];

function getServiceWrap () {
	if (! serviceWrap)
		serviceWrap = require ("./build/Release/service");
	return serviceWrap;
}

function runProcess(path, args, cb) {
	var child = child_process.spawn(path, args);

	child.on("exit", function(code) {
		if (code != 0) {
			var error = new Error(path + " failed: " + code)
			error.code = code
			cb(error);
		} else {
			cb();
		}
	});

	child.on("error", function(error) {
		if (error) {
			cb(error);
		} else {
			cb();
		}
	});
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

	var username = options ? (options.username || null) : null;
	var password = options ? (options.password || null) : null;

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
			getServiceWrap ().add (name, displayName, servicePath, username,
					password);
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
		
		var runLevels = [2, 3, 4, 5];
		if (options && options.runLevels)
			runLevels = options.runLevels;

		var nodeArgsStr = nodeArgs.join(" ");
		var programArgsStr = programArgs.join(" ");


		var initPath = "/etc/init.d/" + name;
		var systemdFolder = "/etc/systemd/system";
		
		var systemdInUserMode = (options && options.userMode);
		if (systemdInUserMode) {
			systemdFolder = os.homedir() + "/.config/systemd/user";
		}

		var systemPath = systemdFolder + "/" + name + ".service";

		var ctlOptions = {
			mode: 493 // rwxr-xr-x
		};

		fs.stat(systemdFolder, function(error, stats) {
			if (error) {
				if (error.code == "ENOENT") {
					var startStopScript = [];

					for (var i = 0; i < linuxStartStopScript.length; i++) {
						var line = linuxStartStopScript[i];
						
						line = line.replace("##NAME##", name);
						line = line.replace("##NODE_PATH##", nodePath);
						line = line.replace("##NODE_ARGS##", nodeArgsStr);
						line = line.replace("##PROGRAM_PATH##", programPath);
						line = line.replace("##PROGRAM_ARGS##", programArgsStr);
						line = line.replace("##RUN_LEVELS_ARR##", runLevels.join(" "));
						line = line.replace("##RUN_LEVELS_STR##", runLevels.join(""));
						
						startStopScript.push(line);
					}
					
					var startStopScriptStr = startStopScript.join("\n");

					fs.writeFile(initPath, startStopScriptStr, ctlOptions, function(error) {
						if (error) {
							cb(new Error("writeFile(" + initPath + ") failed: " + error.message));
						} else {
							runProcess("chkconfig", ["--add", name], function(error) {
								if (error) {
									if (error.code == "ENOENT") {
										runProcess("update-rc.d", [name, "defaults"], function(error) {
											if (error) {
												cb(new Error("update-rd.d failed: " + error.message));
											} else {
												cb()
											}
										})
									} else {
										cb(new Error("chkconfig failed: " + error.message));
									}
								} else {
									cb()
								}
							})
						}
					})
				} else {
					cb(new Error("stat(/usr/lib/systemd/system) failed: " + error.message));
				}
			} else {
				var systemUnit = [];

				for (var i = 0; i < linuxSystemUnit.length; i++) {
					var line = linuxSystemUnit[i];
					
					line = line.replace("##NAME##", name);
					line = line.replace("##NODE_PATH##", nodePath);
					line = line.replace("##NODE_ARGS##", nodeArgsStr);
					line = line.replace("##PROGRAM_PATH##", programPath);
					line = line.replace("##PROGRAM_ARGS##", programArgsStr);
					
					systemUnit.push(line);
				}
				
				var systemUnitStr = systemUnit.join("\n");

				fs.writeFile(systemPath, systemUnitStr, ctlOptions, function(error) {
					if (error) {
						cb(new Error("writeFile(" + systemPath + ") failed: " + error.message));
					} else {
						var systemctlOpts = ["enable", name];
						if (systemdInUserMode) {
							systemctlOpts.splice(0, 0, "--user");
						}
						runProcess("systemctl", systemctlOpts, function(error) {
							if (error) {
								cb(new Error("systemctl failed: " + error.message));
							} else {
								cb()
							}
						})
					}
				})
			}
		})
	}
	
	return this;
}

function isStopRequested () {
	return getServiceWrap ().isStopRequested ();
}

function remove (name, options, cb) {
	if (! cb) {
		cb = arguments[1];
		options = {};
	}
	if (os.platform() == "win32") {
		try {
			getServiceWrap ().remove (name);
			cb();
		} catch (error) {
			cb(error);
		}
	} else {
		var initPath = "/etc/init.d/" + name;

		var systemdFolder = "/etc/systemd/system";
		var systemdInUserMode = (options && options.userMode);
		if (systemdInUserMode) {
			systemdFolder = os.homedir() + "/.config/systemd/user";
		}
		var systemPath = systemdFolder + "/" + name + ".service";

		function removeCtlPaths() {
			fs.unlink(initPath, function(error) {
				if (error) {
					if (error.code == "ENOENT") {
						fs.unlink(systemPath, function(error) {
							if (error) {
								cb(new Error("unlink(" + systemPath + ") failed: " + error.message))
							} else {
								cb()
							}
						});
					} else {
						cb(new Error("unlink(" + initPath + ") failed: " + error.message))
					}
				} else {
					cb()
				}
			});
		};

		fs.stat(systemdFolder, function(error, stats) {
			if (error) {
				if (error.code == "ENOENT") {
					runProcess("chkconfig", ["--del", name], function(error) {
						if (error) {
							if (error.code == "ENOENT") {
								runProcess("update-rc.d", [name, "remove"], function(error) {
									if (error) {
										cb(new Error("update-rc.d failed: " + error.message));
									} else {
										removeCtlPaths()
									}
								});
							} else {
								cb(new Error("chkconfig failed: " + error.message));
							}
						} else {
							removeCtlPaths()
						}
					})
				} else {
					cb(new Error("stat(/usr/lib/systemd/system) failed: " + error.message));
				}
			} else {
				var systemctlOpts = ["disable", name];
				if (systemdInUserMode) {
					systemctlOpts.splice(0, 0, "--user");
				}
				runProcess("systemctl", systemctlOpts, function(error) {
					if (error) {
						cb(new Error("systemctl failed: " + error.message));
					} else {
						removeCtlPaths()
					}
				})
			}
		})
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
