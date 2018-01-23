
/**
 ** Change to the examples directory so this program can run as a service.
 **/
process.chdir(__dirname);

var fs = require ("fs");
var service = require ("../");

function usage () {
	console.log ("usage: node periodic-logger --add <name> [description] [username] [password] [dep dep ...]");
	console.log ("       node periodic-logger --remove <name>");
	console.log ("       node periodic-logger --run");
	process.exit (-1);
}

if (process.argv[2] == "--add" && process.argv.length >= 4) {
	var options = {
		programArgs: ["--run", "me"]
	};

	if (process.argv.length > 4)
		options.description = process.argv[4];

	if (process.argv.length > 5)
		options.username = process.argv[5];

	if (process.argv.length > 6)
		options.password = process.argv[6];
		
	if (process.argv.length > 7)
		options.dependencies = process.argv.splice(7);

	service.add (process.argv[3], options, function(error) {
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
		console.log(new Date ().toString ());
	}, 1000);
} else {
	usage ();
}
