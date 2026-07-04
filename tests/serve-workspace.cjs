const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css",
    ".png": "image/png",
    ".svg": "image/svg+xml"
};
const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname).replace(/^\/+/, "");
    const file = path.resolve(process.cwd(), pathname || "static/index.html");
    if (!file.startsWith(process.cwd()) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        response.writeHead(404).end("Not found");
        return;
    }
    response.writeHead(200, { "Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream" });
    fs.createReadStream(file).pipe(response);
});
server.listen(4178, "127.0.0.1", () => console.log("visual server ready"));
