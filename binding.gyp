{
  'targets': [
    {
      'target_name': 'service',
      'sources': [
        'src/service.cc',
        'src/pthread.cc'
      ],
      'conditions' : [
        ['OS=="win"', {
          'libraries' : ['advapi32.lib']
        }]
      ]
    }
  ]
}
