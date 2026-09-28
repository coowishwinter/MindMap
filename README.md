# 思维导图工作台（xima-mindmap）

多用户思维导图工具：每人一个独立空间（图 / 历史版本 / 草稿互相隔离），带自动存草稿、手动保存、历史版本恢复。

## 部署位置

| | |
|---|---|
| 访问 | http://192.168.31.10:8100 （仅内网） |
| 宿主目录 | `/volume2/docker/AA-my/xima-mindmap` |
| 容器内路径 | `/app`（本目录整体挂载） |
| 容器名 | `xima-mindmap`（`node:24-slim`，`-u 1000:1000`） |
| 端口 | 宿主 **8100** → 容器 **8099** |

## 起停 / 更新

```bash
cd /volume2/docker/AA-my/xima-mindmap

docker compose up -d          # 启动（首次会自动建容器）
docker compose down           # 停止
docker compose up -d --force-recreate   # 改了 environment / ports 后用

git pull                      # 拉最新代码
docker compose restart        # 让新代码生效（改了 server.mjs 必须重启）
```

> ⚠️ 改 `index.html` 只需刷新浏览器；改 `server.mjs` **必须重启容器**才生效。

## 目录结构

```
.
├── docker-compose.yml      # 部署文件
├── server.mjs              # 服务端：静态页 + 空间身份 + 文件库 + 历史 + 草稿
├── index.html              # 前端（单文件，无依赖）
├── 犀码互联商业地图.json    # 示例图（起始页「打开」按钮用）
├── smoke-test.sh           # 接口冒烟测试（空间隔离 / 口令 / 限速 / 令牌）
└── spaces/                 # 【运行数据，不入库】每个空间一个目录
    ├── index.json          #   空间名 + 口令散列（sha256，无明文）
    └── <令牌>/              #   maps/（图）· history/（历史快照）· draft.json（草稿）
```

## 多用户机制（简述）

- 身份：cookie `mm_space=<32位随机令牌>`，服务端 `resolveSpace()` 把令牌映射到 `spaces/<令牌>/` 目录，空间之间读写完全隔离（跨空间按名字读别人的图返回 404）。
- 入口：输「名字 + 口令（≥4 位）」创建/进入；「专属链接」`http://<host>/?k=<令牌>` 换设备免口令进入。
- 口令：只存散列；同名空间 5 分钟内连错 10 次锁 5 分钟。
- 未来接账号体系：只需替换 `resolveSpace()`（读登录会话），存储布局与接口不动。

## 数据与备份

运行数据全在 `spaces/`，**不在 git 里**。备份直接打包这个目录：

```bash
tar czf xima-mindmap-data-$(date +%Y%m%d).tar.gz spaces/
```
