#!/usr/bin/env python3
"""Build the offline demo with the official SDK, without Gradle or npm dependencies."""
from pathlib import Path
import argparse, hashlib, json, os, shutil, subprocess, zipfile

ROOT=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser()
parser.add_argument('--java',type=Path,required=True,help='JDK home containing bin/java and bin/javac')
parser.add_argument('--tools',type=Path,required=True,help='SDK build-tools directory, version 36.0.0')
parser.add_argument('--platform',type=Path,required=True,help='Android 36 platform directory containing android.jar')
args=parser.parse_args()
java_home=args.java.resolve(); tools=args.tools.resolve(); platform=args.platform.resolve()
for p in [java_home/'bin/java',java_home/'bin/javac',tools/'aapt2',tools/'lib/d8.jar',tools/'lib/apksigner.jar',platform/'android.jar']:
    if not p.is_file():parser.error(f'Missing required tool: {p}')
env=dict(os.environ)
env['JAVA_HOME']=str(java_home)
env['PATH']=str(java_home/'bin')+os.pathsep+env.get('PATH','')
def run(*cmd):
    subprocess.run([str(c) for c in cmd],env=env,cwd=ROOT,check=True)

build=ROOT/'android/build'
if build.exists():shutil.rmtree(build)
build.mkdir()
assets=build/'assets/www';shutil.copytree(ROOT/'dist',assets,ignore=shutil.ignore_patterns('downloads','*.apk','*.sha256'))
shutil.copy2(ROOT/'android/web/android.js',assets/'android.js')
index=assets/'index.html'
index.write_text(index.read_text().replace('</head>','  <script src="./android.js" defer></script>\n</head>'))
classes=build/'classes';classes.mkdir()
generated=build/'generated';generated.mkdir()
dex=build/'dex';dex.mkdir()
run(tools/'aapt2','compile','--dir',ROOT/'android/res','-o',build/'resources.zip')
run(tools/'aapt2','link','-o',build/'base.apk','-I',platform/'android.jar','--manifest',ROOT/'android/AndroidManifest.xml','-A',build/'assets','--java',generated,build/'resources.zip')
java_files=sorted((ROOT/'android/src').rglob('*.java'))+sorted(generated.rglob('*.java'))
run(java_home/'bin/javac','-encoding','UTF-8','-source','8','-target','8','-Xlint:-options','-bootclasspath',str(tools/'core-lambda-stubs.jar')+os.pathsep+str(platform/'android.jar'),'-d',classes,*java_files)
# D8 handles lambda desugaring for the Android runtime.
run(java_home/'bin/java','-cp',tools/'lib/d8.jar','com.android.tools.r8.D8','--min-api','26','--lib',platform/'android.jar','--output',dex,*sorted(classes.rglob('*.class')))
unsigned=build/'unsigned.apk';shutil.copy2(build/'base.apk',unsigned)
with zipfile.ZipFile(unsigned,'a',compression=zipfile.ZIP_DEFLATED) as apk:
    for p in sorted(dex.glob('*.dex')):apk.write(p,p.name)
run(tools/'zipalign','-P','16','-f','4',unsigned,build/'aligned.apk')
# One ignored local development key is reused, allowing later APKs to update in place.
signing=ROOT/'android/.signing';signing.mkdir(mode=0o700,exist_ok=True)
key=signing/'demo.jks'
if not key.exists():
    run(java_home/'bin/keytool','-genkeypair','-noprompt','-keystore',key,'-storetype','JKS','-storepass','android','-keypass','android','-alias','sift-demo','-keyalg','RSA','-keysize','2048','-validity','10000','-dname','CN=Sift Local Demo,O=Sift,C=CN')
    key.chmod(0o600)
release=ROOT/'releases';release.mkdir(exist_ok=True)
output=release/'Sift-Demo-0.2.0.apk'
run(java_home/'bin/java','-jar',tools/'lib/apksigner.jar','sign','--ks',key,'--ks-key-alias','sift-demo','--ks-pass','pass:android','--key-pass','pass:android','--v4-signing-enabled','false','--out',output,build/'aligned.apk')
run(java_home/'bin/java','-jar',tools/'lib/apksigner.jar','verify','--verbose','--print-certs',output)
run(tools/'zipalign','-c','-P','16','4',output)
sha=hashlib.sha256(output.read_bytes()).hexdigest()
(output.with_suffix('.apk.sha256')).write_text(f'{sha}  {output.name}\n')
print(json.dumps({'apk':str(output),'bytes':output.stat().st_size,'sha256':sha},ensure_ascii=False))
