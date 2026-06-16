.env文件自己创建一个，内容按照.env.example，里面的appkey，url去aigc官网里我的赛事里面获取

打开方式
cd D:\study\AIGC\blue-animal-demo
.\.venv\Scripts\uvicorn.exe main:app --reload
启动成功后，在浏览器打开：
http://127.0.0.1:8000/demo
接口文档页面是：
http://127.0.0.1:8000/docs