import subprocess, sys, os
S='/private/tmp/claude-501/-Users-hou-Desktop-Projects-profile/e8aafc1a-1641-482b-bd0d-325517b91737/scratchpad'
P='/Users/hou/Desktop/Projects/profile'
G='eq=saturation=0.88:contrast=1.04'
B='eq=saturation=0.85:contrast=1.05:brightness=-0.04'
clips=[(f'{S}/uhd/4366.mp4',2,5,B),(f'{S}/uhd/5012.mp4',1,5,G),(f'{S}/uhd/3365.mp4',3,5,B),
 (f'{S}/uhd/51455.mp4',6,5,G),(f'{S}/uhd/51447.mp4',3,5,G),
 (f'{P}/assets/past_projects/honor_takeover_demo.mp4',5,4,'eq=saturation=0.6:contrast=1.08:brightness=-0.14'),
 (f'{S}/uhd/4283.mp4',3,5,B),(f'{S}/uhd/5363.mp4',1,5,G),(f'{S}/uhd/4366.mp4',0,2,B)]
def master(w,h,out):
    d=1.0; inputs=[]; fc=[]
    for i,(f,s,l,g) in enumerate(clips):
        inputs+=['-ss',str(s),'-t',str(l),'-i',f]
        fc.append(f'[{i}:v]scale={w}:{h}:force_original_aspect_ratio=increase:flags=lanczos,crop={w}:{h},fps=24,setsar=1,{g},unsharp=5:5:0.4:5:5:0,format=yuv420p,setpts=PTS-STARTPTS[v{i}]')
    prev='v0'; off=0
    for i in range(1,len(clips)):
        off+=clips[i-1][2]-d; fc.append(f'[{prev}][v{i}]xfade=transition=fade:duration={d}:offset={off:.3f}[x{i}]'); prev=f'x{i}'
    cmd=['ffmpeg','-v','error','-y']+inputs+['-filter_complex',';'.join(fc),'-map',f'[{prev}]','-an','-c:v','libx264','-preset','medium','-crf','14','-pix_fmt','yuv420p',out]
    r=subprocess.run(cmd,capture_output=True,text=True); print('master',out,r.returncode,r.stderr[-200:],flush=True)
def enc(src,codec,out,maxrate,buf):
    base=['ffmpeg','-v','error','-y','-i',src,'-an']
    if codec=='h264': v=['-c:v','libx264','-preset','slow','-profile:v','high','-crf','23','-maxrate',maxrate,'-bufsize',buf,'-pix_fmt','yuv420p','-movflags','+faststart']
    if codec=='hevc': v=['-c:v','libx265','-preset','medium','-crf','26','-maxrate',maxrate,'-bufsize',buf,'-pix_fmt','yuv420p','-tag:v','hvc1','-x265-params','log-level=error','-movflags','+faststart']
    if codec=='av1':  v=['-c:v','libsvtav1','-preset','6','-crf','34','-maxrate',maxrate,'-bufsize',buf,'-svtav1-params','tune=0','-pix_fmt','yuv420p','-movflags','+faststart']
    r=subprocess.run(base+v+[out],capture_output=True,text=True); print(codec,out,r.returncode,os.path.getsize(out) if r.returncode==0 else r.stderr[-300:],flush=True)
job=sys.argv[1]
if job=='master':
    master(1920,1080,f'{S}/m1080.mp4'); master(1280,720,f'{S}/m720.mp4')
else:
    res,codec=job.split('-')
    rate={'1080':('5M','10M'),'720':('2.5M','5M')}[res]
    enc(f'{S}/m{res}.mp4',codec,f'{S}/out_{res}_{codec}.mp4',*rate)
