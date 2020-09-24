// 当前js文件的核心就是监测用户输入的 create 命令，然后接收具体的参数，将远端模板下载至本地
let fs = require('fs')
let ncp = require('ncp')
let ora = require('ora')
let path = require('path')
let { promisify } = require('util')
let axios = require('axios')
let inquirer = require('inquirer')
let downloadFn = require('download-git-repo')
let Metalsmith = require('metalsmith')
const cons = require('consolidate')
let { render } = require('consolidate').ejs

// consimconfig 

downloadFn = promisify(downloadFn)  // 让downloadFn 可以支持 async + await 

// 工具方法：添加耗时 loading 
const addLoaing = function (fn) {
  return async function (...args) {
    let spinner = ora('拉取开始')
    spinner.start()
    try {
      let ret = await fn(...args)
      spinner.succeed('拉取成功了')
      return ret
    } catch (err) {
      console.log(err)
      spinner.fail('拉取失败')
    }
  }
}

// 工具方法： 获取仓库列表
const fetchRepoList = async function () {
  let { data } = await axios.get('https://api.github.com/users/WeiruiChen/repos')
  let repos = data.map(item => item.name)
  return repos
}

// 工具方法： 获取 tags 列表
const fetchTagList = async function (reponame) {
  let { data } = await axios.get(`https://api.github.com/repos/WeiruiChen/${reponame}/tags`)
  let repos = data.map(item => item.name)
  return repos
}

// 工具方法：自定义函数完成 git 仓库下载操作
const downloadRepo = async function (repo, tag) {
  // download-git-repo + 缓存
  // 1 定义缓存目录

  let cacheDir = `${process.env[process.platform == 'win32' ? 'USERPROFILE' : 'HOME']}/.tmp`
  // 2 处理 download-git-repo 导出的函数的调用规则 downloadFn(zcegg/create-nm#tagv)
  let api = `WeiruiChen/${repo}`
  if (tag) {
    api += `#${tag}`
  }
  console.log('cacheDir', cacheDir);
  console.log('repo', repo);
  // 3 自定义一个模板下载后的输出目录
  let dest = path.resolve(cacheDir, './' + repo)
  let flag = fs.existsSync(dest)
  console.log(flag, '22222')
  // 4 执行下载操作
  let spinner = ora('开始下载')
  spinner.start()
  if (flag) {
    // 如果 flag 为true 表示当前次我们想要下载的内容是存在的，所以直接使用缓存即可
    // 直接使用缓存就意味着将 dest 返回

    spinner.stop()
    console.log('dest', dest);
    return dest
  } else {
    await downloadFn(api, dest)
    spinner.succeed('模板下载成功')
    return dest
  }
}

module.exports = async function (proname) {
  // 1 获取模板列表
  let repos = await addLoaing(fetchRepoList)()
  console.log(repos)

  // 2 交互问题
  let { tmpname } = await inquirer.prompt({
    type: 'list',
    name: 'tmpname',
    message: "请选择目标仓库模板",
    choices: repos
  })
  console.log(tmpname)

  // 3 拉取 tags ， 如果有内容 tags 就是一个有值的数组，如果没有tags 那它就是一个空数组
  let tags = await addLoaing(fetchTagList)(tmpname)
  console.log(tags)

  // 4 依据当前拉取回来的 tags 分支进行处理（ [v1, v2....]  [] ）
  let dest = null
  if (tags.length) {
    // 当代码运行到这里就说明存在多个 tags 
    let { tagv } = await inquirer.prompt({
      type: 'list',
      name: 'tagv',
      message: "请选择目标版本",
      choices: tags
    })
    console.log(tagv)

    // 4.1 依据选择的模板名称和仓库版本号完成具体的下载操作
    dest = await downloadRepo(tmpname, tagv)
    console.log(dest)
  } else {
    // 当代码运行到这里就说明当前仓库是不存在多个 tag版本
    let { isDownload } = await inquirer.prompt({
      type: 'confirm',
      name: 'isDownload',
      message: "当前不存在多个tag是否直接下载"
    })
    console.log(isDownload)
    if (isDownload) {
      dest = await downloadRepo(tmpname)
      console.log(dest)
    } else {
      return
    }
  }

  // 5 将模板下载完成之后在本地的自定义缓存中存在着具体的文件
  // 利用这些文件就可以初始化我们的项目 

  // 二种情况：一种是项目初始化过程中需要用户动态提供数据，一种是项目中不需要渲染动态数据，直接拷贝即可
  // ncp 
  if (fs.existsSync(path.join(dest, 'que.js'))) {
    // 当前是需要渲染数据
    await new Promise((resolve, reject) => {
      Metalsmith(__dirname)
        .source(dest)
        .destination(path.resolve(proname))
        .use(async (files, metal, done) => {
          // files 就是需要渲染的模板目录下的所有类型的文件
          // 加载当前存放问题的模块 que.js 
          let quesArr = require(path.join(dest, 'que.js'))
          // 依据问题数据，来自定义交互的问题
          let answers = await inquirer.prompt(quesArr)

          // 当前 answers 是传递过来的参数，我们需要在下一个 use 中进行使用
          // 利用 metal.metadata() 来保存所有的数据，交给下一个use 进行命名用即可
          let meta = metal.metadata()
          Object.assign(meta, answers)

          // 这步操作完成之后，那么 que.js 文件就没有用了，不需要拷贝至项目的目录
          delete files['ques.js']
          done()
        })
        .use((files, metal, done) => {
          // 获取上一个 use 中拿到的用户填写的数据
          let data = metal.metadata()
          // 找到那些需要渲染数据的具体文件，找到之后将它们里的内容转为字符串方式
          // 转为字符串之后，接下来就可以针对于字符串进行替换实现渲染 
          Reflect.ownKeys(files).forEach(async (file) => {
            if (file.includes('js') || file.includes('json')) {
              let content = files[file].contents.toString()
              if (content.includes("<%")) {
                content = await render(content, data)
                files[file].contents = Buffer.from(content)
              }
            }
          })
          done()
        })
        .build((err) => {
          if (err) {
            reject()
          } else {
            resolve()
          }
        })
    })
  } else {
    // 不需要渲染时直接将缓存里的内容拷贝至当前项目下
    console.log('当前是不需要渲染数据')
    console.log('dest',dest)
    console.log('proname',tmpname)
    ncp(dest, tmpname)
  }
}



