
# windows-service - [homepage][homepage]

This module implements the ability to run a [Node.js][nodejs] based JavaScript
program as a native Windows service.

This module is installed using [node package manager (npm)][npm]:

    # This module contains C++ source code which will be compiled
    # during installation using node-gyp.  A suitable build chain
    # must be configured before installation.
    
    npm install windows-service

It is loaded using the `require()` function:

    var service = require ("windows-service");

A program can then be added, removed and run as a Windows service:

    service.add ("My Service");
    
    service.remove ("My Service");
    
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
        service.add ("My Service", {programArgs: ["--run"]});
    } else if (process.argv[2] == "--remove") {
        service.remove ("My Service");
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
Service Control Manager the first argument to the program will be `--run`.
The above program checks for this and if specified runs as a service using
the `service.run()` function.

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
        service.add ("Service 1", {programPath: "c:\example\service1.js"});
        service.add ("Service 2", {programPath: "c:\example\service2.js"});
        service.add ("Service 3", {programPath: "c:\example\service3.js"});
    } else {
        service.remove ("Service 1");
        service.remove ("Service 2");
        service.remove ("Service 3");
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
regardless of whether it is started at the console, or by the Windows Service
Control Manager.

When the `service.run()` function is called this module will attempt to
connect to the Windows Service Control Manager so that control requests can be
received - so that the service can be stopped.

When starting a program at the console an attempt to connect to the Windows
Service Control Manager will fail.  In this case the `service.run()` function
will assume the program is running at the console and silently ignore this
error.

This behaviour results in a program which can be run either at the console or
the Windows Service Control Manager with no change.

# Current Working Directory

Upon starting the current working directory of a service program will be the
`"%windir%\system32"` directory (i.e. `c:\windows\system32`).  Service
programs need to consider this when working with relative directory and file
paths.

This path will most likely be different when running the same program at the
console, so a service program may wish to change the current working
directory to a more suitable location using the `process.chdir()` function to
avoid different behaviour between the two methods of starting a program.

# Using This Module

Given the intended purpose of this module only Windows platforms are
supported.

However, this module aims to support other platforms in the future.  That is
it aims to support installing as a service on other platforms - by creating
`/etc/init.d/...` scripts for example - so that the same service management
code can be used to abstract away platform differences.

## service.add (name, [options])

The `add()` function adds a Windows service.

The `name` parameter specifies the name of the created service.  The optional
`options` parameter is an object, and can contain the following items:

 * `displayName` - The services display name, defaults to the `name` parameter
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
The service can be started using the `net start "My Service"` command.

An exception will be thrown if the service could not be added.  The error will
be an instance of the `Error` class.

The following example installs a service named `My Service`, it explicitly
specifies the services display name, and specifies a number of parameters to
the program:

    var options = {
        displayName: "My Service",
        programArgs: ["--server-port", 8888]
    };
    
    service.add ("my-service", options);

## service.remove (name)

The `remove()` function removes a Windows service.

The `name` parameter specifies the name of the service to remove.  This will
be the same `name` parameter specified when adding the service.

The service must be in a stopped state for it to be removed.  The
`net stop "My Service"` command can be used to stop the service before it is
to be removed.

An exception will be thrown if the service could not be removed.  The error
will be an instance of the `Error` class.

The following example removes the service named `My Service`:

    service.remove ("My Service");

## service.run (stdoutLogStream, [stderrLogStream,] callback)

The `run()` function will connect the calling program to the Windows Service
Control Manager, allowing the program to run as a Windows service.

The programs `process.stdout` stream will be replaced with the
`stdoutLogStream` parameter, and the programs `process.stderr` stream
replaced with the `stdoutLogStream` parameter (this allows the redirection of
all `console.log()` type calls to a service specific log file).  If the
`stderrLogStream` parameter is not specified the programs `process.stderr`
stream will be replaced with the `stdoutLogStream` parameter.  The `callback`
function will be called when the service receives a stop request, e.g. because
the Windows Service Controller was used to send a stop request to the service.

The program should perform cleanup tasks and then call the `service.stop()`
function.

The following example connects the calling program to the Windows Service
Control Manager, it uses the same log stream for standard output and standard
error:

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

## Version 1.0.0 - 21/02/2013

 * Initial release

## Version 1.0.1 - 11/05/2013

 * `runInitialised` was not set to `true` when the service is `run()` for the
   first time in index.js
 * Use MIT license instead of GPL

## Version 1.0.2 - 15/08/2013

 * The variable `rcode` in the `run()` function defined in `service.cc` was
   not used

## Version 1.0.3 - 23/08/2014

 * Windows reports an error when stopping the service, indicate to Windows
   the service is stopping to prevent Windows from generating an error

## Version 1.0.4 - 26/08/2014

 * High CPU utilisation when running services as console programs

# Roadmap

In no particular order:

 * Specify whether the service should auto-starting on boot
 * Add provisions for running under UNIX platforms (i.e. daemonize,
   conditional compile of C++ code for Windows only, create `/etc/init.d/...`
   scripts)

Suggestions and requirements should be sent to <stephen.vickers.sv@gmail.com>.

# License

Copyright (c) 2013 Stephen Vickers

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
