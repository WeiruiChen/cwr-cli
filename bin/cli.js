#! /usr/bin/env node

let {program} = require('commander')
let {version} = require('../package.json')
let mainFn = require('..')  // 在当前目录结构下就相当于是将 lib下的 index.js 导入

// 1 提前将需要自定义的命令配置存放起来(create config)
let actionMap = {
  create: {
    alias: 'crt',
    description: '初始化模板项目',
    examples: ['cwr-cli create <projectname>']
  },
  config: {
    alias: 'cfg',
    description: '初始化项目配置',
    examples: [
      'cwr-cli config set <k> <v>',
      'cwr-cli config get <k>'
    ]
  }
}

// 2 遍历存放自定义命令的数据结构进行（）
Reflect.ownKeys(actionMap).forEach((aname) => {
  program
    .command(aname)
    .alias(actionMap[aname].alias)
    .description(actionMap[aname].description)
    .action(() => {
      // console.log(process.argv.slice(3))
      // console.log(aname, '命令执行了')

      // 现在我们可以拿到执行的命令和命令的参数
      // 交给谁？==》我们写工具包，应该都有一个入口的文件， 这个入口文件负责实现具体的业务，或者负责实现业务分发
      // 在这里监控具体自定义命令的执行，一旦某个命令执行后，就将参数传给 Index.js 当中的函数 
      mainFn(aname, process.argv.slice(3))
    })
})

program.on('--help', () => {
  console.log('Examples: ')
  Reflect.ownKeys(actionMap).forEach((aname) => {
    actionMap[aname].examples.forEach((item) => {
      console.log('　' + item)
    })
  })
})

program.version(version).parse(process.argv)
