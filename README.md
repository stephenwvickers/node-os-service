
# os-service - [homepage][homepage]

This module implements the ability to run a [Node.js][nodejs] based JavaScript
program as a native Windows or Linux service.

This module is installed using [node package manager (npm)][npm]:

    # This module contains C++ source code which will be compiled
    # during installation on Windows platforms using node-gyp.  A
    # suitable build chain must be configured on Windows platforms
    # before installation.
    
    npm install os-service

It is loaded using the `require()` function:

    var service = require ("os-service");

A program can then be added, removed and run as a service:

    service.add ("my-service");
    
    service.remove ("my-service");
    
    var logStream = fs.createWriteStream ("my-service.log");
    
    service.run (logStream, function () {
        console.log ("stop request received");
        service.stop ();
    });

[homepage]: http://re-tool.org "Homepage"
[nodejs]: http://nodejs.org "Node.js"
[npm]: https://npmjs.org/ "npm"

# Batch Service Creation

Two approaches can be taken when adding and removing services.

In the first approach a program can be responsible for adding, removing and
starting itself as a service.  This is typically achieved by supporting
program arguments such as `--add`, `--remove`, and `--run`, and executing the
appropriate action.

The following example adds the calling program as a service when called
with a `--add` parameter, and removes the created service when called with a
`--remove` parameter:

    if (process.argv[2] == "--add") {
        service.add ("my-service", {programArgs: ["--run"]}, function(error){ 
           if (error)
              console.trace(error);
        });
    } else if (process.argv[2] == "--remove") {
        service.remove ("my-service", function(error){ 
           if (error)
              console.trace(error);
        }););
    } else if (process.argv[2] == "--run") {
        var logStream = fs.createWriteStream (process.argv[1] + ".log");
        
        service.run (logStream, function () {
            service.stop (0);
        });
        
        // Run service program code...
    } else {
        // Show usage...
    }

Note the `--run` argument passed in the `options` parameter to the
`service.add()` function.  When the service is started using the Windows
Service Control Manager, or the Linux service management facilities,  the first
argument to the program will be `--run`.  The above program checks for this and
if specified runs as a service using the `service.run()` function.

Also note that neither the node binary or the programs fully qualified path
are specified.  These parameters are automatically calculated it not
specified.  Refer to the `service.add()` function description for details
about how this works.

In the second approach a dedicated service management program can be
responsible for adding and removing many services in batch.  The program
adding and removing services is not a service itself, and would never call
the `service.run()` function.

The following example adds or removes number of services:

    if (program.argv[2] == "--add") {
        service.add ("service1", {programPath: "c:\example\svc1.js",
            function(error) { 
                if (error) {
                    console.trace(error);
                } else {
                    service.add ("service2", {programPath: "c:\example\svc2.js",
                        function(error) { 
                            if (error) {
                                console.trace(error);
                            }
                        });
                }
            });
    } else {
        service.remove ("service2", function(error) { 
            if (error) {
                console.trace(error);
            } else {
                service.remove ("service1", function(error) { 
                    if (error) {
                        console.trace(error);
                    }
                });
            }
        });
    }

Note that unlike the previous example the `--run` argument is not passed in
the `options` parameter to the `service.add()` function.  Since each service
program does not add or remove itself as a service it only needs to run, and
as such does not need to be told to so.

Also note that the `programPath` argument is passed in the options parameter
to the `service.add()` function, to specify the fully qualified path to each
service program - which would otherwise default to the service management
program adding the services.

Each of the service programs can simply start themselves as services using the
following code:

    var logStream = fs.createWriteStream (process.argv[1] + ".log");
    
    service.run (logStream, function () {
        service.stop (0);
    });
    
    // Run service program code...

# Running Service Programs

When a service program starts it can always call the `service.run()` function
regardless of whether it is started at the console, by the Windows Service
Control Manager, or the Linux service management facilities.

On Windows, when the `service.run()` function is called this module will
attempt to connect to the Windows Service Control Manager so that control
requests can be received - so that the service can be stopped.  When starting a
program at the console an attempt to connect to the Windows Service Control
Manager will fail.  In this case the `service.run()` function will assume the
program is running at the console and silently ignore this error.

On Linux, services started at the console will run in the foreground, this
allows command sequences such as `CTRL+C` to be used, e.g. during development.
When Linux services are started using the Linux service management facilities,
i.e. `service my-service start`, they can be stopped using the signals `SIGINT`
and `SIGTERM`, or again using the Linux service management facilities, i.e.
`service my-service stop`.

This behaviour results in a program which can be run either at the console, the
Windows Service Control Manager, or the Linux service management facilities
with no change.

# Current Working Directory

Upon starting the current working directory of a service program will be
platform specific the , e.g. the `"%windir%\system32"` directory on Windows.
Service programs need to consider this when working with relative directory and
file paths.

This path will most likely be different when running the same program at the
console, so a service program may wish to change the current working
directory to a more suitable location using the `process.chdir()` function to
avoid different behaviour between the two methods of starting a program.

# Using This Module

This module attempts to behave in exactly the same way on Windows and Linux
platforms - at least the API is exactly the same for both platforms both from
a service management and service running perspective.

On Windows platforms the Windows Service Control Manager WIN32 API is used to
manage services.  On Linux platforms the `chkconfig` command is used, and if
not available, the `update-rc.d` command is used instead.

## service.add (name, [options], cb)

The `add()` function adds a service.

The `name` parameter specifies the name of the created service.  The optional
`options` parameter is an object, and can contain the following items:

 * `displayName` - The services display name, defaults to the `name` parameter
   - this parameter will be used on Windows platforms only
 * `nodePath` - The fully qualified path to the node binary used to run the
   service (i.e. `c:\Program Files\nodejs\node.exe`, defaults to the value of
   `process.execPath`
 * `nodeArgs` - An array of strings specifying parameters to pass to
   `nodePath`, defaults to `[]`
 * `programPath` - The program to run using `nodePath`, defaults to the value
   of `process.argv[1]`
 * `programArgs` - An array of strings specifying parameters to pass to
   `programPath`, defaults to `[]`

The service will be set to automatically start at boot time, but not started.
The service can be started using the `net start "my-service"` command on
Windows and `service my-service start` on Linux.

The `cb` callback function is called once the service has been added. The
following arguments will be passed to the callback function:

 * `error` - Instance of the `Error` class, or `null` if no error occurred

The following example installs a service named `my-service`, it explicitly
specifies the services display name, and specifies a number of parameters to
the program:

    var options = {
        displayName: "MyService",
        programArgs: ["--server-port", 8888]
    };
    
    service.add ("my-service", options, function(error) {
        if (error)
            console.trace(error);
    });

## service.remove (name, cb)

The `remove()` function removes a service.

The `name` parameter specifies the name of the service to remove.  This will
be the same `name` parameter specified when adding the service.

The service must be in a stopped state for it to be removed.  The
`net stop "my-service"` command can be used to stop the service on Windows and
the `service my-service stop` on Linux before it is to be removed.

The `cb` callback function is called once the service has been removed. The
following arguments will be passed to the callback function:

 * `error` - Instance of the `Error` class, or `null` if no error occurred

The following example removes the service named `my-service`:

    service.remove ("my-service", function(error) {
        if (error)
            console.trace(error);
    });

## service.run (stdoutLogStream, [stderrLogStream,] callback)

The `run()` function will attempt to run the program as a service.

The programs `process.stdout` stream will be replaced with the
`stdoutLogStream` parameter, and the programs `process.stderr` stream
replaced with the `stdoutLogStream` parameter (this allows the redirection of
all `console.log()` type calls to a service specific log file).  If the
`stderrLogStream` parameter is not specified the programs `process.stderr`
stream will be replaced with the `stdoutLogStream` parameter.  The `callback`
function will be called when the service receives a stop request, e.g. because
the Windows Service Controller was used to send a stop request to the service,
or a `SIGTERM` signal was received.

The program should perform cleanup tasks and then call the `service.stop()`
function.

The following example starts a program as a service, it uses the same log
stream for standard output and standard error:

    var logStream = fs.createWriteStream ("my-service.log");
    
    service.run (logStream, function () {
        console.log ("stop request received");
        service.stop ();
    });

## service.stop ([rcode])

The `stop()` function will cause the service to stop, and the calling program
to exit.

Once the service has been stopped this function will terminate the program by
calling the `process.exit()` function, passing to it the `rcode` parameter
which defaults to `0`.  Before calling this function ensure the program has
finished performing cleanup tasks.

**BE AWARE, THIS FUNCTION WILL NOT RETURN.**

The following example stops the calling program specifying a return code of
`0`, the function will not return:

    var logStream = fs.createWriteStream ("my-service.log");

    service.run (logStream, function () {
        console.log ("stop request received");
        service.stop (0);
    });

# Example Programs

Example programs are included under the modules `example` directory.

# Bugs & Known Issues

None, yet!

Bug reports should be sent to <stephen.vickers.sv@gmail.com>.

# Changes

## Version 1.0.0 - 30/12/2014

 * Initial release

## Version 1.0.1 - 03/03/2015

 * Support Linux platforms which don't have the start-stop-daemon program

# Roadmap

Suggestions and requirements should be sent to <stephen.vickers.sv@gmail.com>.

# License

Copyright (c) 2014 Stephen Vickers

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

# Author

Stephen Vickers <stephen.vickers.sv@gmail.com>
