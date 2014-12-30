#ifndef PTHREAD_H
#define PTHREAD_H

#ifndef _WIN32
#include <pthread.h>
#else
#include <windows.h>

typedef HANDLE pthread_mutex_t;
typedef HANDLE pthread_cond_t;
typedef DWORD  pthread_t;
typedef HANDLE pid_t;

int pthread_cond_destroy (pthread_cond_t *cond);
int pthread_cond_init (pthread_cond_t *cond, const void *ignored);
int pthread_cond_signal (pthread_cond_t *cond);
int pthread_cond_wait (pthread_cond_t *cond, pthread_mutex_t *mutex);
int pthread_mutex_destroy (pthread_mutex_t *mutex);
int pthread_mutex_init (pthread_mutex_t *mutex, void *ignored);
int pthread_mutex_lock (pthread_mutex_t *mutex);
int pthread_mutex_unlock (pthread_mutex_t *mutex);
pthread_t pthread_self (void);
#endif /* WIN32 */

#endif /* PTHREAD_H */
