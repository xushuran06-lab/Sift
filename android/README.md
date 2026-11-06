# Sift 安卓离线 Demo

安装包：`../releases/Sift-Demo-0.2.0.apk`，已复制到站点 `dist/downloads/`。

- Android 8.0+（minSdk 26），target/compile SDK 36；Java 平台 Activity/WebView，无 Gradle 或第三方运行时依赖。
- 内置现有网页资源，经固定 HTTPS 虚拟源拦截加载，不访问托管网站；安装后离线运行。
- 不声明任何权限，不联网、不读取通知、不监听聊天。原链接通过系统浏览器打开。
- 图片通过系统文档选择器选择，导出通过系统“另存为”写入用户指定位置，不申请存储权限。
- 通过系统分享菜单接收 `text/plain`。文字先选来源再手动分析；纯 URL 进入链接收藏表单，不抓取正文。
- Android 返回键先关闭弹窗，再返回主信息页，最后退出。
- 状态保存在 WebView 的应用私有 localStorage，与网页版的数据相互独立；卸载会删除本地数据。

## 重建

使用 JDK 21、Android SDK Build Tools 36.0.0、Android 36 平台：

```bash
python3 android/build.py \
  --java /path/to/jdk/Contents/Home \
  --tools /path/to/sdk/build-tools/36.0.0 \
  --platform /path/to/sdk/platforms/android-36
```

此工作区的工具下载在项目外 `../.android-toolchain/`，均来自 Google/Amazon 官方 HTTPS 地址，并核对了官方校验值。可复用：

```bash
python3 android/build.py \
  --java ../.android-toolchain/amazon-corretto-21.jdk/Contents/Home \
  --tools ../.android-toolchain/tools/android-16 \
  --platform ../.android-toolchain/platform/android-36
```

开发测试签名保存在 `android/.signing/demo.jks`，已加入 Git 忽略，权限仅限当前用户。脚本复用此密钥，便于后续测试版覆盖安装保留数据；不要丢失密钥或把它上传到站点。不是正式发布版的生产签名。

`android/build/` 为中间文件，`releases/` 为输出。构建时排除 `dist/downloads/`，避免将旧 APK 再打包进新 APK。若重新构建，发布前同步 APK、SHA256 文件和下载页校验值。

## 验证结果与限制

已通过 Java 编译、D8 转换、aapt 清单/资源检查、zipalign、APK v2/v3 签名校验、ZIP 完整性/网页资源一致性检查及五组 Node 测试。

没有连接安卓真机或模拟器，无法声称完成了安装启动、软键盘、系统图片选择、系统另存为和 OEM 返回手势的实机验收。用户首次试用应覆盖：

1. 安装并打开，飞行模式下仍能显示页面。
2. 选择来源，导入消息，退出重开后来源与收藏保留。
3. 测试笔记、图片收藏与 JSON/Markdown/日历 .ics 导出。
4. 文字分享至 Sift，确认来源后处理；URL 分享进入链接收藏。
5. 返回键关闭弹窗，底部导航不被系统手势区域或键盘遮挡。

如果出现白屏，先检查手机的 Android System WebView/浏览器内核版本；页面使用现代 JavaScript 语法。

平台参考：[应用内本地内容](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)、[APK 签名验证](https://developer.android.com/tools/apksigner)。

## 0.2新增

打包本轮结构化待办、关键词筛选、人工核对、收藏回顾与日历导出。日历文件使用系统另存为，由用户自行导入日历；不申请日历或通知权限，不自动添加日历事件。覆盖安装前建议导出本地备份；复用原开发签名，包名不变。
