from pathlib import Path
import base64, mimetypes, re, json, sys

ROOT = Path(__file__).resolve().parents[1]
def data(path):
    mime=mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
    return 'data:'+mime+';base64,'+base64.b64encode(path.read_bytes()).decode()

def build():
    folder = ROOT / 'grok'
    source=(folder/'index.html').read_text()
    def css(m):
        path=folder/m.group(1)
        body=path.read_text()
        body=re.sub(r'url\([\'"]?([^\)\'\"]+)[\'"]?\)',lambda u:'url("'+data((path.parent/u.group(1)).resolve())+'")',body)
        return '<style>'+body+'</style>'
    source=re.sub(r'<link rel="stylesheet" href="([^"]+)">',css,source)
    source=re.sub(r'src="(assets/(?:img|audio)/[^"]+)"',lambda m:'src="'+data(folder/m.group(1))+'"',source)
    def js(m):
        rel=m.group(1); body=(folder/rel).read_text()
        if rel.endswith('loader.js'):
            body='''window.__GLB={};window.__GLBP=function(n,k,N,s){(__GLB[n]=__GLB[n]||[])[k]=s;};
window.loadModels=async function(progress){const out={};for(const m of __GLB_MANIFEST){const str=atob(__GLB[m.name].join(''));const u=new Uint8Array(str.length);for(let i=0;i<str.length;i++)u[i]=str.charCodeAt(i);out[m.name]=u.buffer;delete __GLB[m.name];}if(progress)progress(1);return out;};'''
        if rel.endswith('manifest.js'):
            manifest=json.loads(body.split('=',1)[1].strip().rstrip(';'))
            body+='\n'+'\n'.join((folder/'assets/models'/f[0]).read_text() for model in manifest for f in model['files'])
        return '<script>'+body.replace('</script','<\\/script')+'</script>'
    source=re.sub(r'<script src="([^"]+)"></script>',js,source)
    output=ROOT/'build/grok.html'
    output.parent.mkdir(exist_ok=True)
    output.write_text(source)
    print(output.name,output.stat().st_size)

if __name__ == '__main__':
    build()
