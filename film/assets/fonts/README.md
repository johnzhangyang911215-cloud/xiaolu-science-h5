# 字体

`film-serif.woff2`、`film-sans.woff2` 是思源宋体 / 思源黑体（Source Han Serif CN / Source Han Sans CN Regular，SIL OFL 1.1，许可见同目录 LICENSE 文件）的子集，只含 `film/copy.json` 用到的字符和常用标点数字。

`copy.json` 新增文字后需重新生成：

```
python3 tools/subset_fonts.py SourceHanSerifCN-Regular.otf SourceHanSansCN-Regular.otf
```

原始 OTF 取自 `https://github.com/adobe-fonts/source-han-serif`、`source-han-sans` 的 `release/SubsetOTF/CN/`。
