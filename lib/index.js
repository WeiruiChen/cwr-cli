// 前任手里的 命令名称和命令行参数，现在应该教给我来管理了
module.exports = function (aname, args) {
  // 1 我们已经可以在 Index.js 拿到参数了
  // 2 当前 yyl 有二个命令 config create ，我难道需要将这二个命令的逻辑都写在 Index.js 中吗？
  // console.log(aname, ...args)
  require('./' + aname)(...args)
}