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

## 想象动物区功能说明

本轮对“想象动物区”进行了完整的儿童创作流程改造：

- **空白画布起步**：首次进入时不再预置熊猫或任何身体部件，让小朋友从空白画纸开始自由组合；旧版默认草稿会自动迁移为空白画布。
- **九类连续素材栏**：素材按“头、身体、左手、右手、左脚、右脚、尾巴、翅膀、装饰”排列为连续网格，编号和卡片对齐，不再分成断开的区域。
- **左右四肢独立组合**：左手、右手、左脚、右脚可以分别选择不同动物的素材，并可单独添加、移动、缩放和旋转。
- **自由编辑画布**：点击画布部件即可选中；支持拖动定位、按钮缩放、左右旋转、恢复默认位置以及一键清空整个画布。
- **扩展尾巴和装饰素材**：已接入 6 个尾巴和 8 个装饰素材；素材经过透明背景处理，在画布和缩略图中不会出现白色方框。
- **随机灵感组合**：随机按钮会组合头、身体、左右四肢、尾巴、翅膀和装饰，并为各部件生成不同的位置、大小和角度。
- **创作信息记录**：可以填写动物名称、栖息地和性格，系统根据所选部件生成能力与故事描述。
- **收藏时生成成品截图**：点击“放进动物册”后，前端会按照当前画布的真实位置和层级合成透明背景截图，自动裁掉四周空白，并压缩为 256×256 小图。
- **缩略图与动物册完全一致**：下方成品预览和“我的奇妙动物册”共用收藏时生成的同一张截图，不再分别重排部件；后续编辑不会改变已经收藏的作品。
- **本地持久化**：草稿、部件变换、成品截图和最近的动物册作品保存在当前儿童会话中，刷新后仍可继续使用。

想象动物素材目录：

```text
static/assets/imagine/builder/heads/                  # 头部素材
static/assets/imagine/builder/bodies/                 # 身体素材
static/assets/imagine/builder/hands/                  # 左右手共用的成对原图
static/assets/imagine/builder/feet/                   # 左右脚共用的成对原图
static/assets/imagine/builder/wings/                  # 翅膀素材
static/assets/imagine/builder/tail/transparent/       # 已处理透明背景的尾巴素材
static/assets/imagine/builder/decorate/transparent/   # 已处理透明背景的装饰素材
```

如果新上传的尾巴或装饰是白底 PNG，可使用 `tools/remove_connected_white_background.py` 生成透明版本。该工具只移除与图片边缘连通的白色区域，会保留黑色轮廓内部的白色图案。

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

## 素材来源

想象动物区的动物身体、翅膀、尾巴和装饰使用项目定制插画素材。
