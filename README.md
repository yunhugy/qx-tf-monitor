# TestFlight 名额监控 - Quantumult X 配置片段

把 JS 脚本上传到 GitHub/Gist/你的服务器后，在 Quantumult X 配置里添加下面任务。

## 本地写法示例

如果你把脚本放到 Quantumult X 的本地脚本目录，任务可写：

```ini
[task_local]
*/1 * * * * qx_tf_monitor.js, tag=TF Quantumult X 名额监控, enabled=true
```

## 远程脚本写法示例

把下面的 URL 换成你的 JS 原始链接 raw URL：

```ini
[task_local]
*/1 * * * * https://example.com/qx_tf_monitor.js, tag=TF Quantumult X 名额监控, enabled=true
```

## 说明

- `*/1 * * * *` 表示每 1 分钟检查一次。
- 只有检测到“Start Testing / Accept Invitation / 开始测试 / 接受邀请”才会推送通知。
- 检测到“此 Beta 版本的测试员已满”等满员文案时，不通知、不打开。
- 通知自带 open-url，点通知即可打开 TestFlight 链接。
- iOS 限制下，Quantumult X 脚本不能在后台无确认自动打开 App，只能推送通知让你点击。
