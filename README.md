.env 文件自己创建一个，内容按照 .env.example，里面的 appkey、url 去 aigc 官网里我的赛事里面获取。

生产环境必须设置稳定、随机且仅服务端可见的 `AUTH_SECRET`；修改该值会使现有登录令牌失效。

## 功能页

- 登录/角色选择页
- 首页/动物地图页
- 知识问答页
- AI 动物医生页
- 想象动物区
- 故事页
- 家长报告页

## 打开方式

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

启动成功后，在浏览器打开：

```text
http://127.0.0.1:8000/
```

兼容旧入口：

```text
http://127.0.0.1:8000/demo
```

接口文档页面是：

```text
http://127.0.0.1:8000/docs
```

## 代码结构

```text
main.py                  # 兼容旧启动方式：uvicorn main:app --reload
app/main.py              # FastAPI 应用创建和路由注册
app/config.py            # 环境变量、模型列表等配置
app/schemas.py           # 请求/响应数据模型
app/routers/pages.py     # 页面路由：/、/demo、/favicon.ico
app/routers/api.py       # API 路由：/api/models、/api/animal/chat
app/services/            # 业务逻辑：聊天流程、提示词、返回解析
app/clients/             # 外部接口调用：玄极/AIGC 接口
static/index.html        # 前端组合入口（只负责加载各层）
static/styles/           # 页面样式
static/src/domain/       # 动物目录、解锁规则等领域模型
static/src/core/         # 会话生命周期与应用状态
static/src/application/  # 面向用例的应用服务
static/src/infrastructure/ # HTTP、浏览器存储等底层适配器
static/src/presentation/ # 页面渲染与 DOM 交互协调
static/src/features/     # 问答、照护、创作、故事、语音等功能
static/src/bootstrap.js  # 唯一启动入口
```

前端分层约束和扩展方式见 `static/src/ARCHITECTURE.md`。

前端运行时冒烟检查（不需要启动后端）：

```bash
node tests/frontend-smoke.cjs
```

后端安全与数据一致性回归测试：

```bash
python -m unittest discover -s tests -p "test_*.py" -v
```
