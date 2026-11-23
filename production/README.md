# 制作资料与复现

仓库包含两套横版网页的制作输入。克隆后直接读取本目录，PDF、GLB、图像、音频和 Blender 场景均以实际文件保存。两套可编辑网页分别在 [focus](../focus/) 和 [grok](../grok/)。

## 选材、分镜和数据依据

| 要做的事 | 资料入口 | 用法 |
| --- | --- | --- |
| 核对鹿茸来源、取材、规格和尾屏数字 | [产品资料 PDF](pdf/20260413-小鹿产品PPT.pdf) | 第 12 页用于来源追溯，第 38–39 页核对取材及双舱规格，第 40 页核对 28 天四项数据。第 43 页属于另一组测试。 |
| 查系列视觉与手卡 | [手卡原图](reference-cards/) · [面膜功效 PDF](pdf/小鹿面膜直播kt版功效.pdf) | 资料库覆盖多款产品。面膜手卡对应面膜品类，精华尾屏的数字回到精华产品资料核对。 |
| 搭建产品与品牌画面 | [包装及系列原图](product-images/) · [品牌 AI 和标志 SVG](brand/) | 找单支、20 支装、盒盖或不同视角时从原图取材；两版上线用图位于各自的 assets/img。品牌竖式 SVG 是可选标志素材。 |
| 查看分镜怎样确定 | [聚焦版已确认方案](records/focus/方案/聚焦叙事优化方案_已确认.md) · [实施计划](records/focus/方案/实施计划.md) · [七幕时间码](storyboard/七幕时间码.csv) | 时间码针对 Codex 横版。在 Grok 中用浏览器控制台的 window.__scene() 定位当前幕。 |
| 对照动作和配乐 | [使用动作原参考](reference/) · [原始配乐](audio/) · [横版预览](previews/) | 配乐文件夹存原曲，各版 assets/audio/bgm.mp3 是网页实际载入的版本。Grok 的两份横版 MP4 分别有声、无配音。 |
| 看制作及导出检查 | [聚焦版检查记录](records/focus/检查/) · [环境光 HDR](lighting/) | 有截图联络图、关键转场、成片逐帧报告。报告里的历史制作机路径仅代表当时的导出环境。 |

## 挑选正确的模型

- [网页实际 GLB](models/runtime/) 有四个。`deer.glb` 对应鹿及鹿茸，`box-closed.glb` 对应合盖盒，`ampoule.glb` 用于单支展示，`usage.glb` 用于使用动作。分别从两版的 manifest 和模型分片解码后，四对文件的 SHA-256 均相同。
- [原始三份 GLB](models/drive/) 保留资料文件夹中的原名和内容。[合盖高精模型](models/high-detail/) 可供包装特写使用。做网页替换时检查模型层级、节点名、动作名与画面比例。
- [Blender 母版](blender/) 包含梅花鹿与鹿茸、盒装材质与单支精华 v8。鹿场景使用无损 gzip 压缩。在仓库根目录执行下方命令即可得到原始 .blend。其余 .blend 可直接打开。

```sh
gunzip -c production/blender/梅花鹿_鹿茸合成.blend.gz > build-deer.blend
```

要追溯单支材质和粉液效果的做法，可读 [build_v8.py](blender/build_v8.py)。它从 [inputs](blender/inputs/) 内的 v7 场景出发，重新烘焙细粉、液面与滴液。需要重跑时先将 blender 目录复制到工作目录，脚本会在自身目录写入 v8 场景和验证记录。

## 把修改带回网页

1. 修改模型后导出为 GLB 2，保留代码引用的节点和层级。用下方命令在一个新目录内生成对应版本的分片和 manifest。

   ```sh
   python3 tools/model_chunks.py focus usage edited.glb build/new-usage
   ```

2. 将生成的文件复制到本次修改版本的 assets/models/。修改镜头和动作时，从该版 assets/js/main.js 的 scenes 入手。用浏览器从上一幕连续播放经过修改点，确认装配、字幕和镜头衔接。
3. 在仓库根目录执行以下命令，得到能离线打开的单文件 H5。

   ```sh
   python3 tools/bundle_focus.py 横版
   python3 tools/bundle_grok.py
   ```

   聚焦版输出到 build/小鹿精华_聚焦叙事版_横版.html，Grok 版输出到 build/grok.html。
4. 要重导聚焦版 MP4，准备支持 WebGL 2 的 Chromium、Node.js 和带 libx264 的 FFmpeg。原项目的逐帧导出器已适配本仓库路径。

   ```sh
   npm install --prefix tools
   (cd tools && npx playwright install chromium)
   node tools/export_focus.cjs 横版 --check
   node tools/export_focus.cjs 横版
   ```

   可用 CHROME_PATH 和 FFMPEG 指定本机程序。Grok 使用独立的手动切幕时间线，自动预览入口为 grok/?auto=1。聚焦版逐帧导出器依赖该版专用捕获接口。

## 素材清单

[逐文件索引](drive-inventory.csv) 记录共享资料夹中本次归档的 242 个文件。每行都有原名、仓库内实际位置和 SHA-256。相同文件通过索引指向同一份实体。少数历史文字记录将用户主目录缩写为 ~，Three.js 构建入口中的历史机器路径已替换成包导入路径；两列哈希可用于识别这些调整。系统缓存、Grok 竖版网页及竖版预览已按交接范围排除。
