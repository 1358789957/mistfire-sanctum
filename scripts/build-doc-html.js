// 把 docs/拟人化QQ机器人设计文档.md 打包成一个可直接发给别人的单文件 HTML。
// 用法： node scripts/build-doc-html.js
// 生成： docs/napcat-humanized-bot.html （用浏览器打开即可，会渲染 Mermaid 图，需要联网加载渲染库）
const fs = require('fs');
const path = require('path');

const mdPath = path.join(__dirname, '..', 'docs', '拟人化QQ机器人设计文档.md');
const outPath = path.join(__dirname, '..', 'docs', 'napcat-humanized-bot.html');
const md = fs.readFileSync(mdPath, 'utf8');

const template = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>拟人化 QQ 机器人（NapCat）完整设计文档</title>
<style>
:root{--fg:#1f2328;--muted:#656d76;--line:#d0d7de;--bg:#fff;--code:#f6f8fa;--accent:#6e40c9;}
*{box-sizing:border-box}
body{margin:0;background:#eef0f3;color:var(--fg);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
  line-height:1.75;font-size:16px;-webkit-text-size-adjust:100%;}
.wrap{max-width:860px;margin:0 auto;padding:34px 22px 110px;background:var(--bg);
  box-shadow:0 1px 0 1px var(--line);}
@media(min-width:900px){.wrap{margin:24px auto;border-radius:12px;}}
h1,h2,h3,h4{line-height:1.35;margin:1.6em 0 .6em;font-weight:700;}
h1{font-size:1.85em;border-bottom:2px solid var(--line);padding-bottom:.3em;}
h2{font-size:1.4em;border-bottom:1px solid var(--line);padding-bottom:.25em;margin-top:2em;}
h3{font-size:1.15em;}
a{color:var(--accent);text-decoration:none;}a:hover{text-decoration:underline;}
blockquote{margin:1em 0;padding:.5em 1em;border-left:4px solid var(--accent);
  background:#f7f4fc;color:var(--muted);border-radius:0 6px 6px 0;}
code{background:var(--code);padding:.15em .4em;border-radius:5px;font-size:.9em;
  font-family:"SFMono-Regular",Consolas,"Liberation Mono",monospace;}
pre{background:var(--code);padding:14px 16px;border-radius:8px;overflow:auto;border:1px solid var(--line);}
pre code{background:none;padding:0;font-size:.86em;line-height:1.6;}
pre.mermaid{background:#fff;text-align:center;border:1px dashed var(--line);}
table{border-collapse:collapse;width:100%;margin:1em 0;font-size:.94em;display:block;overflow:auto;}
th,td{border:1px solid var(--line);padding:8px 12px;text-align:left;}
th{background:var(--code);}
tr:nth-child(2n) td{background:#fbfcfd;}
hr{border:none;border-top:1px solid var(--line);margin:2em 0;}
ul{padding-left:1.4em;}li{margin:.25em 0;}
input[type=checkbox]{margin-right:.4em;}
</style>
</head>
<body>
<div class="wrap"><div id="content">正在渲染文档…（需要联网加载渲染库）</div></div>
<script type="text/markdown" id="src">
__MD__
</script>
<script src="https://cdn.jsdelivr.net/npm/marked@12/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<script>
(function(){
  var container = document.getElementById('content');
  var src = document.getElementById('src').textContent;
  if(!window.marked){container.innerHTML='<p>渲染库加载失败，请联网后刷新，或直接查看 .md 源文件。</p>';return;}
  container.innerHTML = marked.parse(src);
  container.querySelectorAll('code.language-mermaid').forEach(function(code){
    var pre = code.closest('pre');
    var box = document.createElement('pre');
    box.className = 'mermaid';
    box.textContent = code.textContent;
    pre.replaceWith(box);
  });
  if(window.mermaid){
    try{
      mermaid.initialize({startOnLoad:false, theme:'default', securityLevel:'loose'});
      mermaid.run({querySelector:'.mermaid'});
    }catch(e){}
  }
})();
</script>
</body>
</html>`;

fs.writeFileSync(outPath, template.replace('__MD__', function(){ return md; }));
console.log('wrote', outPath, fs.statSync(outPath).size, 'bytes');
