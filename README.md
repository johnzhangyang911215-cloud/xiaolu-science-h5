# 小鹿精华科普 H5

两个横版动画分别从梅花鹿、鹿茸分层讲到冻干双舱与产品使用。打开版本选择页可进入任一版本。手机横屏观看可获得更大的画面。

[打开版本选择页](https://johnzhangyang911215-cloud.github.io/xiaolu-science-h5/)

| 版本 | 播放方式 | 网页源文件 |
| --- | --- | --- |
| [Codex · 聚焦叙事版](https://johnzhangyang911215-cloud.github.io/xiaolu-science-h5/focus/) | 默认自动播放。浏览器限制有声自动播放时，可轻触画面开启音乐。 | [focus/index.html](focus/index.html) |
| [Grok 横版](https://johnzhangyang911215-cloud.github.io/xiaolu-science-h5/grok/) | 点击、空格或右方向键推进，左方向键返回。[自动播放入口](https://johnzhangyang911215-cloud.github.io/xiaolu-science-h5/grok/?auto=1) | [grok/index.html](grok/index.html) |

## 导演与剪辑交接

先读 [任务 1 简报](docs/01-brief.md)。两套横版原工程保存在 [Codex](reference/codex/) 和 [Grok](reference/grok/)，首页的 focus/、grok/ 为播放版本。另附 [剪辑流程图 JPG](assets/storyboard/小鹿科普H5_剪辑流程图.jpg) 和 [制作 skill](assets/skill/xiaolu-science-h5/SKILL.md)。

## 本地预览

在仓库根目录运行以下命令，再在浏览器打开 `http://localhost:8000/`。网页使用本地 Three.js、GSAP、字体、模型与配乐，直接提供静态文件即可。

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

## 接手续改

[CLAUDE.md](CLAUDE.md) 给出了两个原版的对应目录、字幕与镜头的修改入口、预览和回归检查步骤。站点首页只负责选择版本，动画和素材分别放在各自目录中。GitHub Pages 从 main 分支的根目录发布。

聚焦叙事版环境光素材的出处与许可见[素材记录](docs/HDR环境素材来源.md)。

## 模型、PDF 与制作源资料

[打开制作资料目录](assets/README.md)。可直接读取两份原始 PDF、四个网页实际 GLB、三份原始 GLB、可编辑 Blender 场景、产品图、品牌母版、手卡、配乐和分镜方案。仓库内附模型分片、H5 打包与聚焦版视频导出脚本。
