
var util = require ("util");

var serviceWrap;
var runInitialised = false;

function getServiceWrap () {
	if (! serviceWrap)
		serviceWrap = require ("./build/Release/service");
	return serviceWrap;
}

function add (name, options) {
	var serviceArgs = [];

	var displayName = (options && options.displayName)
			? options.displayName
			: name;

	var nodePath = (options && options.nodePath)
			? options.nodePath
			: process.execPath;

	var programPath = (options && options.programPath)
			? options.programPath
			: process.argv[1];
	
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
	
	getServiceWrap ().add (name, displayName, servicePath);
	
	return this;
}

function isStopRequested () {
	return getServiceWrap ().isStopRequested ();
}

function remove (name) {
	getServiceWrap ().remove (name);
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
		
		setInterval (function () {
			if (isStopRequested ()) {
				stopCallback ();
			}
		}, 2000);
		
		runInitialised = true;
	}
	
	getServiceWrap ().run ();
}

function stop (rcode) {
	getServiceWrap ().stop (rcode);
	process.exit (rcode);
}

exports.add = add;
exports.remove = remove;
exports.run = run;
exports.stop = stop;
