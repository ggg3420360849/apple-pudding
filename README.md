.env 文件自己创建一个，内容按照 .env.example，里面的 appkey、url 去 aigc 官网里我的赛事里面获取。

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
static/index.html        # 前端页面
```
