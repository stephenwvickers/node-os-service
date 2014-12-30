#ifndef PTHREAD_C
#define PTHREAD_C

#include <stdio.h>
#include <time.h>

#include "pthread.h"

int pthread_cond_destroy (pthread_cond_t *cond) {
	return (CloseHandle (*cond) == 0 ? -1 : 0);
}

int pthread_cond_init (pthread_cond_t *cond, const void *ignored) {
	return ((*cond = CreateEvent (NULL, FALSE, FALSE, NULL)) == NULL ? -1 : 0);
}

int pthread_cond_signal (pthread_cond_t *cond) {
	return (SetEvent (*cond) == 0 ? -1 : 0);
}

int pthread_cond_wait (pthread_cond_t *cond, pthread_mutex_t *mutex) {
	DWORD status;
	DWORD	msec = INFINITE;

	ReleaseMutex (*mutex);
	status = WaitForSingleObject (*cond, msec);
	WaitForSingleObject (*mutex, INFINITE);
	
	return (status == WAIT_OBJECT_0 ? 0 : -1);
}

int pthread_mutex_destroy (pthread_mutex_t *mutex) {
	return (CloseHandle (*mutex) == 0 ? -1 : 0);
}

int pthread_mutex_init (pthread_mutex_t *mutex, void *ignored) {
	return ((*mutex = CreateMutex (NULL, FALSE, NULL)) == NULL ? -1 : 0);
}

int pthread_mutex_lock (pthread_mutex_t *mutex) {
	return (WaitForSingleObject (*mutex, INFINITE) == WAIT_OBJECT_0 ? 0 : -1);
}

int pthread_mutex_unlock (pthread_mutex_t *mutex) {
	return (ReleaseMutex (*mutex) == 0 ? -1 : 0);
}

pthread_t pthread_self (void) {
	return (GetCurrentThreadId ());
}

#endif /* PTHREAD_C */
