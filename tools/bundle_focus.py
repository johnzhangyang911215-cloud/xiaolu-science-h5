#!/usr/bin/env python3
"""Bundle the cinema H5 into an offline, self-contained HTML; optionally package it.

This does not alter source files or animation timing. Use --package only after the
source has passed visual review. Existing deliveries from earlier editions are untouched.
"""
from pathlib import Path
from html.parser import HTMLParser
import argparse
import base64
import hashlib
import json
import mimetypes
import re
import zipfile

REPO = Path(__file__).resolve().parents[1]
ROOT = REPO / 'build'
VALID = ('横版',)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def atomic_write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + '.tmp')
    tmp.write_bytes(data)
    tmp.replace(path)


class ResourceAudit(HTMLParser):
    def __init__(self):
        super().__init__()
        self.external = []
        self.media = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ('img', 'audio', 'video', 'source', 'script', 'iframe'):
            for key in ('src', 'poster'):
                value = attrs.get(key, '')
                if value and not value.startswith(('data:', 'blob:', '#')):
                    self.external.append((tag, key, value))
                if value:
                    self.media.append((tag, key, value[:40]))
            if attrs.get('srcset'):
                self.external.append((tag, 'srcset', attrs['srcset']))
        if tag == 'link' and attrs.get('rel') in ('stylesheet', 'preload', 'modulepreload', 'icon'):
            value = attrs.get('href', '')
            if value and not value.startswith(('data:', 'blob:', '#')):
                self.external.append((tag, 'href', value))


def build(layout, package=False):
    folder = REPO / 'focus'
    assets = {}
    source = (folder / 'index.html').read_text(encoding='utf-8')

    def read(path):
        path = path.resolve()
        if not path.is_relative_to(folder.resolve()):
            raise ValueError(f'Asset escapes source folder: {path}')
        data = path.read_bytes()
        assets[str(path.relative_to(folder.resolve()))] = {'bytes': len(data), 'sha256': sha(data)}
        return data

    def data_url(path):
        mime = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
        return f'data:{mime};base64,' + base64.b64encode(read(path)).decode('ascii')

    def css_inline(match):
        path = folder / match.group(1)
        css = read(path).decode('utf-8')

        def css_asset(url_match):
            relative = url_match.group(1).strip().strip('\"\'')
            if relative.startswith(('data:', 'blob:', '#')):
                return url_match.group(0)
            if re.match(r'^(?:[a-z]+:)?//', relative, re.I):
                raise ValueError(f'Remote CSS resource cannot be bundled offline: {relative}')
            return 'url("' + data_url((path.parent / relative).resolve()) + '")'

        if re.search(r'@import\s', css):
            raise ValueError(f'CSS imports must be local and flattened before bundling: {path}')
        css = re.sub(r'url\(([^)]+)\)', css_asset, css)
        return '<style>' + css.replace('</style', '<\\/style') + '</style>'

    source = re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+)"\s*/?>', css_inline, source)
    source = re.sub(r'(?:src|poster)="(assets/(?:img|audio)/[^"]+)"',
                    lambda m: m.group(0).split('=', 1)[0] + '="' + data_url(folder / m.group(1)) + '"', source)

    def js_inline(match):
        relative = match.group(1)
        body = read(folder / relative).decode('utf-8')
        if relative.endswith('/loader.js'):
            # Classic scripts keep the local file:// loader independent of fetch/CORS.
            body = '''window.__GLB={};window.__GLBP=function(n,k,N,s){(__GLB[n]=__GLB[n]||[])[k]=s;};
window.loadModels=async function(progress){const out={};for(const m of __GLB_MANIFEST){const str=atob(__GLB[m.name].join(''));const u=new Uint8Array(str.length);for(let i=0;i<str.length;i++)u[i]=str.charCodeAt(i);out[m.name]=u.buffer;delete __GLB[m.name];}if(progress)progress(1);return out;};'''
        if relative.endswith('/manifest.js'):
            manifest = json.loads(body.split('=', 1)[1].strip().rstrip(';'))
            body += '\n' + '\n'.join(read(folder / 'assets/models' / chunk[0]).decode('utf-8')
                                      for model in manifest for chunk in model['files'])
        return '<script>' + re.sub(r'</script', r'<\\/script', body, flags=re.I) + '</script>'

    source = re.sub(r'<script\s+src="([^"]+)"\s*></script>', js_inline, source)
    # Font licenses travel with the single file, including when only index.html is deployed.
    licenses = {}
    for path in sorted((folder / 'assets/fonts').glob('*.txt')):
        licenses[path.name] = read(path).decode('utf-8')
    if licenses:
        encoded = json.dumps(licenses, ensure_ascii=False).replace('</', '<\\/')
        source = source.replace('</body>', '<script type="application/json" id="embedded-font-licenses">' + encoded + '</script>\n</body>')
    if '韶初泌语' not in source:
        raise ValueError('The approved brand name 韶初泌语 is missing')
    for typo in ('韶初秘语', '韶初沁语', '韵初泌语'):
        if typo in source:
            raise ValueError(f'Unapproved brand spelling detected: {typo}')
    audit = ResourceAudit()
    audit.feed(source)
    if audit.external:
        raise ValueError(f'Non-embedded page resources remain: {audit.external}')
    if 'window.__advance' not in source or 'window.__scene' not in source:
        raise ValueError('The deterministic movie capture interface is missing')
    if re.search(r'\bau\.playbackRate\s*=', source):
        raise ValueError('The music must retain its original playback speed')
    output = ROOT / f'小鹿精华_聚焦叙事版_{layout}.html'
    payload = source.encode('utf-8')
    atomic_write(output, payload)
    report = {
        'layout': layout, 'source': str(folder / 'index.html'), 'output': str(output),
        'sha256': sha(payload), 'bytes': len(payload), 'offlineStaticAudit': True,
        'brand': '韶初泌语', 'assetCount': len(assets), 'assets': assets,
        'embeddedFontLicenses': list(licenses), 'packageCreated': False,
    }
    if package:
        stage = ROOT / '发布包' / layout
        index = stage / 'index.html'
        atomic_write(index, payload)
        orientation = '16:9，1920×1080' if layout == '横版' else '9:16，1080×1920'
        instructions = f'''韶初泌语 · 小鹿精华 · 聚焦叙事版 · {layout}

上线方法
将 index.html 上传到静态网站根目录或子目录，即可通过链接打开。
无需构建、后端或 CDN。图片、字体、三维模型、脚本和背景音乐已全部内嵌。
建议使用 HTTPS，服务器开启 gzip / Brotli 可缩短首次加载时间。
若网站配置了 Content-Security-Policy，需要允许内联脚本、内联样式及 data: / blob: 资源。

播放方式
本版为 {orientation}。模型加载完成后，画面自动播放。
在链接后添加 ?auto=1 可明确开启自动播放；?auto=0 使用手动切换。
浏览器通常要求首次点击或触摸后才能播放音乐。轻触画面开启音乐，不会跳场。
音乐按钮可以静音或恢复音乐，刷新页面可重新播放。

离线使用
直接双击 index.html，可通过现代浏览器的 file:// 地址离线打开。
建议使用支持 WebGL 2 的浏览器并开启硬件加速。

文件说明
index.html：完整离线 H5，也是上线入口。
上线说明.txt：本说明，无须上传。
字体许可已内嵌在 index.html 的 embedded-font-licenses 区块中。
'''
        atomic_write(stage / '上线说明.txt', instructions.encode('utf-8'))
        credit = REPO / 'docs/HDR环境素材来源.md'
        if credit.exists():
            atomic_write(stage / '素材来源与许可.txt', credit.read_bytes())
        zip_path = ROOT / f'小鹿精华_聚焦叙事版_{layout}_H5上线包.zip'
        zip_tmp = zip_path.with_name(zip_path.name + '.tmp')
        with zipfile.ZipFile(zip_tmp, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            archive.write(index, 'index.html')
            archive.write(stage / '上线说明.txt', '上线说明.txt')
            if credit.exists():
                archive.write(stage / '素材来源与许可.txt', '素材来源与许可.txt')
        with zipfile.ZipFile(zip_tmp) as archive:
            if archive.testzip() is not None or archive.read('index.html') != payload:
                raise ValueError('ZIP integrity verification failed')
        zip_tmp.replace(zip_path)
        report.update(packageCreated=True, zip=str(zip_path), zipBytes=zip_path.stat().st_size,
                      zipSha256=sha(zip_path.read_bytes()), entries=['index.html', '上线说明.txt'] + (['素材来源与许可.txt'] if credit.exists() else []))
    atomic_write(ROOT / '检查/离线打包' / f'{layout}.json', json.dumps(report, ensure_ascii=False, indent=2).encode('utf-8'))
    print(json.dumps({key: report[key] for key in ('layout', 'output', 'sha256', 'bytes', 'offlineStaticAudit', 'packageCreated')}, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('layouts', nargs='*', metavar='横版|竖版')
    parser.add_argument('--package', action='store_true', help='Create ZIP only after the bundled HTML passes its static offline audit')
    args = parser.parse_args()
    for name in args.layouts or VALID:
        if name not in VALID:
            parser.error('Choose 横版 or 竖版')
        build(name, args.package)
