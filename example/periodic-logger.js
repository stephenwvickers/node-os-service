
/**
 ** Change to the examples directory so this program can run as a service.
 **/
process.chdir(__dirname);

var fs = require ("fs");
var service = require ("../");

function usage () {
	console.log ("usage: node periodic-logger --add <name>");
	console.log ("       node periodic-logger --remove <name>");
	console.log ("       node periodic-logger --run");
	process.exit (-1);
}

if (process.argv[2] == "--add" && process.argv.length >= 4) {
	service.add (process.argv[3], {programArgs: ["--run", "me"]}, function(error) {
		if (error)
			console.log(error.toString());
	});
} else if (process.argv[2] == "--remove" && process.argv.length >= 4) {
	service.remove (process.argv[3], function(error) {
		if (error)
			console.log(error.toString());
	});
} else if (process.argv[2] == "--run") {
	var logStream = fs.createWriteStream (process.argv[1] + ".log");
	service.run (logStream, function () {
		service.stop (0);
	});

	// Here is our long running code, simply print a date/time string to
	// our log file
	setInterval (function () {
		console.error (new Date ().toString ());
	}, 1000);
} else {
	usage ();
}
