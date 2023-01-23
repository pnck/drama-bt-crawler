## 爬爬 BT 站，省得每天打开浏览器找

- ```bash
  $ pnpm install
  ```
- ```bash
  $ npm run craw
  ```
- 如果你配置了 `aria2 RPC`, 可以使用 `jsonrpc` 接口自动添加任务： 
  ```bash
  ARIA2_API='<RPC_URL>' npm run download
  ```
  - 不指定环境变量则访问本地 aria2 默认 RPC 接口
  - 没有考虑 RPC 的 auth，你需要改源码
  - 你可以先执行 `npm run craw` 然后在 `records.json` 里修改完成状态，避免重复添加

## 如果你想爬其它的站
- 源码里的网址稍微用 js 「加密」（uglify/pack）过，我是从`eval((p,a,c,k,e,d)=> ...` 这个头找到的 [解密方法](https://dean.edwards.name/unpacker/) ，其它站点的动态加载逻辑很可能不一样，你需要自己改源码
- 可以使用 `TARGET_PAGE` 环境变量指向其它页面（比如你还想从这个网站抓其它剧的链接）
