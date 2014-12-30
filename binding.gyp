{
  'targets': [
    {
      'target_name': 'service',
      'conditions' : [
        ['OS=="win"', {
          'libraries' : ['advapi32.lib'],
          'sources': [
            'src/service.cc',
            'src/pthread.cc'
          ],
        }]
      ]
    }
  ]
}
