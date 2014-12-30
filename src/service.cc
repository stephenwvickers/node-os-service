#ifndef SERVICE_CC
#define SERVICE_CC

#include <node.h>

#include <io.h>
#include <signal.h>
#include <stdio.h>
#include <string>
#include <windows.h>

#include "pthread.h"
#include "service.h"

static bool run_initialised = false;

static SERVICE_STATUS_HANDLE status_handle;
static pthread_mutex_t status_handle_mtx;

static bool stop_requested = false;
static pthread_mutex_t stop_requested_mtx;

static pthread_cond_t stop_service;
static pthread_mutex_t stop_service_mtx;

HANDLE node_thread_handle;

static char errbuf[1024];
const char* raw_strerror (int code) {
	if (FormatMessage (FORMAT_MESSAGE_FROM_SYSTEM, 0, code, 0, errbuf,
			1024, NULL)) {
		return errbuf;
	} else {
		strcpy (errbuf, "Unknown error");
		return errbuf;
	}
}

DWORD set_status (DWORD status_code, DWORD win32_rcode, DWORD service_rcode) {
	SERVICE_STATUS status;

	memset (&status, 0, sizeof (SERVICE_STATUS));

	status.dwServiceType = SERVICE_WIN32_OWN_PROCESS;
	status.dwCurrentState = status_code;
	status.dwControlsAccepted = SERVICE_ACCEPT_SHUTDOWN | SERVICE_ACCEPT_STOP;
	status.dwWin32ExitCode = (service_rcode
			? ERROR_SERVICE_SPECIFIC_ERROR
			: win32_rcode);
	status.dwServiceSpecificExitCode = service_rcode;
	status.dwCheckPoint = 0;
	status.dwWaitHint = 10000;

	pthread_mutex_lock (&status_handle_mtx);
	SetServiceStatus (status_handle, &status);
	pthread_mutex_unlock (&status_handle_mtx);

	return 0;
}

VOID WINAPI handler (DWORD signal) {
	switch (signal) {
		case (SERVICE_CONTROL_STOP):
		case (SERVICE_CONTROL_SHUTDOWN):
			set_status(SERVICE_STOP_PENDING, NO_ERROR, 0);
			pthread_mutex_lock (&stop_requested_mtx);
			stop_requested = true;
			pthread_mutex_unlock (&stop_requested_mtx);
			break;
		default:
			break;
	}
}

VOID WINAPI run (DWORD argc, LPTSTR *argv) {
	if (! (status_handle = RegisterServiceCtrlHandler ("", handler))) {
		set_status (SERVICE_STOPPED, GetLastError (), 0);
		return;
	}

	set_status (SERVICE_RUNNING, NO_ERROR, 0);

	pthread_mutex_lock (&stop_service_mtx);
	pthread_cond_wait (&stop_service, &stop_service_mtx);
	pthread_mutex_unlock (&stop_service_mtx);
}

DWORD __stdcall run_thread (LPVOID param) {
	SERVICE_TABLE_ENTRY table[] = {{"", run}, {0, }};

	if (StartServiceCtrlDispatcher (table)) {
		while (1) {
			DWORD status;
			BOOL rcode = GetExitCodeThread (node_thread_handle, &status);

			if (! rcode)
				break;

			if (status != STILL_ACTIVE)
				break;
		}
	} else {
		while (1) {
			Sleep(60000);
		}
	}

	ExitThread (0);
}

namespace service {

void InitAll (Handle<Object> target) {
	pthread_mutex_init (&status_handle_mtx, NULL);
	pthread_mutex_init (&stop_requested_mtx, NULL);
	pthread_mutex_init (&stop_service_mtx, NULL);
	
	pthread_cond_init (&stop_service, NULL);

	target->Set (String::NewSymbol ("add"),
			FunctionTemplate::New (Add)->GetFunction ());
	target->Set (String::NewSymbol ("isStopRequested"),
			FunctionTemplate::New (IsStopRequested)->GetFunction ());
	target->Set (String::NewSymbol ("remove"),
			FunctionTemplate::New (Remove)->GetFunction ());
	target->Set (String::NewSymbol ("run"),
			FunctionTemplate::New (Run)->GetFunction ());
	target->Set (String::NewSymbol ("stop"),
			FunctionTemplate::New (Stop)->GetFunction ());
}

NODE_MODULE(service, InitAll)

Handle<Value> Add (const Arguments& args) {
	HandleScope scope;
	
	if (args.Length () < 3) {
		ThrowException (Exception::Error (String::New (
				"Two arguments are required")));
		return scope.Close (args.This ());
	}
	
	if (! args[0]->IsString ()) {
		ThrowException (Exception::TypeError (String::New (
				"Name argument must be a string")));
		return scope.Close (args.This ());
	}
	String::AsciiValue name (args[0]->ToString ());

	if (! args[1]->IsString ()) {
		ThrowException (Exception::TypeError (String::New (
				"Display name argument must be a string")));
		return scope.Close (args.This ());
	}
	String::AsciiValue display_name (args[1]->ToString ());

	if (! args[2]->IsString ()) {
		ThrowException (Exception::TypeError (String::New (
				"Name argument must be a string")));
		return scope.Close (args.This ());
	}
	String::AsciiValue path (args[2]->ToString ());

	SC_HANDLE scm_handle = OpenSCManager (0, SERVICES_ACTIVE_DATABASE,
			SC_MANAGER_ALL_ACCESS);
	if (! scm_handle) {
		std::string message ("OpenSCManager() failed: ");
		message += raw_strerror (GetLastError ());
		ThrowException (Exception::Error (String::New (message.c_str ())));
		return scope.Close (args.This ());
	}

	SC_HANDLE svc_handle = CreateService (scm_handle, *name, *display_name,
			SERVICE_ALL_ACCESS, SERVICE_WIN32_OWN_PROCESS, SERVICE_AUTO_START,
			SERVICE_ERROR_NORMAL, *path, 0, 0, 0, 0, 0);

	if (! svc_handle) {
		std::string message ("CreateService() failed: ");
		message += raw_strerror (GetLastError ());
		CloseServiceHandle (scm_handle);
		ThrowException (Exception::Error (String::New (message.c_str ())));
		return scope.Close (args.This ());
	}

	CloseServiceHandle (svc_handle);
	CloseServiceHandle (scm_handle);

	return scope.Close (args.This ());
}

Handle<Value> IsStopRequested (const Arguments& args) {
	HandleScope scope;

	pthread_mutex_lock (&stop_requested_mtx);
	Handle<Boolean> requested = Boolean::New (stop_requested);
	stop_requested = false;
	pthread_mutex_unlock (&stop_requested_mtx);

	return scope.Close (requested);
}

Handle<Value> Remove (const Arguments& args) {
	HandleScope scope;
	
	if (args.Length () < 1) {
		ThrowException (Exception::Error (String::New (
				"One argument is required")));
		return scope.Close (args.This ());
	}
	
	if (! args[0]->IsString ()) {
		ThrowException (Exception::TypeError (String::New (
				"Name argument must be a string")));
		return scope.Close (args.This ());
	}
	String::AsciiValue name (args[0]->ToString ());

	SC_HANDLE scm_handle = OpenSCManager (0, SERVICES_ACTIVE_DATABASE,
			SC_MANAGER_ALL_ACCESS);
	if (! scm_handle) {
		std::string message ("OpenSCManager() failed: ");
		message += raw_strerror (GetLastError ());
		ThrowException (Exception::Error (String::New (message.c_str ())));
		return scope.Close (args.This ());
	}

	SC_HANDLE svc_handle = OpenService (scm_handle, *name, SERVICE_ALL_ACCESS);
	if (! svc_handle) {
		std::string message ("OpenService() failed: ");
		message += raw_strerror (GetLastError ());
		CloseServiceHandle (scm_handle);
		ThrowException (Exception::Error (String::New (message.c_str ())));
		return scope.Close (args.This ());
	}

	if (! DeleteService (svc_handle)) {
		std::string message ("DeleteService() failed: ");
		message += raw_strerror (GetLastError ());
		CloseServiceHandle (svc_handle);
		CloseServiceHandle (scm_handle);
		ThrowException (Exception::Error (String::New (message.c_str ())));
		return scope.Close (args.This ());
	}

	CloseServiceHandle (svc_handle);
	CloseServiceHandle (scm_handle);

	return scope.Close (args.This ());
}

Handle<Value> Run (const Arguments& args) {
	HandleScope scope;
	
	if (run_initialised)
		return scope.Close (args.This ());

	node_thread_handle = GetCurrentThread ();

	HANDLE handle = CreateThread (NULL, 0, run_thread, NULL, 0, NULL);
	if (! handle) {
		std::string message ("CreateThread() failed: ");
		message += raw_strerror (GetLastError ());
		ThrowException (Exception::Error (String::New (message.c_str ())));
		return scope.Close (args.This ());
	} else {
		CloseHandle (handle);
	}
	
	run_initialised = true;

	return scope.Close (args.This ());
}

Handle<Value> Stop (const Arguments& args) {
	HandleScope scope;
	
	if (! run_initialised)
		return scope.Close (args.This ());
	
	int rcode = 0;
	if (args.Length () > 1) {
		if (! args[0]->IsUint32 ()) {
			ThrowException (Exception::TypeError (String::New (
					"Name argument must be a string")));
			return scope.Close (args.This ());
		}
		rcode = args[0]->ToUint32 ()->Value ();
	}
	
	set_status (SERVICE_STOP_PENDING, NO_ERROR, 0);
	
	pthread_cond_signal (&stop_service);
	
	set_status (SERVICE_STOPPED, NO_ERROR, rcode);

	return scope.Close (args.This ());
}

}; /* namespace service */

#endif /* SERVICE_CC */
