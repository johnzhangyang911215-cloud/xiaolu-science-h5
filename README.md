# 小鹿精华科普 H5

两个横版动画分别从梅花鹿、鹿茸分层讲到冻干双舱与产品使用。打开版本选择页可进入任一版本。手机横屏观看可获得更大的画面。

[打开版本选择页](https://johnzhangyang911215-cloud.github.io/xiaolu-science-h5/)

| 版本 | 播放方式 | 网页源文件 |
| --- | --- | --- |
| [Codex · 聚焦叙事版](https://johnzhangyang911215-cloud.github.io/xiaolu-science-h5/focus/) | 默认自动播放。浏览器限制有声自动播放时，可轻触画面开启音乐。 | [focus/index.html](focus/index.html) |
| [Grok 横版](https://johnzhangyang911215-cloud.github.io/xiaolu-science-h5/grok/) | 点击、空格或右方向键推进，左方向键返回。[自动播放入口](https://johnzhangyang911215-cloud.github.io/xiaolu-science-h5/grok/?auto=1) | [grok/index.html](grok/index.html) |

## 本地预览

在仓库根目录运行以下命令，再在浏览器打开 `http://localhost:8000/`。网页使用本地 Three.js、GSAP、字体、模型与配乐，直接提供静态文件即可。

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

## 接手续改

[CLAUDE.md](CLAUDE.md) 给出了两个原版的对应目录、字幕与镜头的修改入口、预览和回归检查步骤。站点首页只负责选择版本，动画和素材分别放在各自目录中。GitHub Pages 从 main 分支的根目录发布。

聚焦叙事版环境光素材的出处与许可见[素材记录](docs/HDR环境素材来源.md)。
