"""Joins the recorded clips into one captioned video. Usage: python3 assemble.py <outDir> (the folder record.cjs wrote)."""
import subprocess, os, re, sys
os.chdir(sys.argv[1])
clips = ['01_menu', '02_toyfactory', '07_space', '03_depot', '04_training_course', '05_training_deck', '06_castle']
parts = []
for c in clips:
    lst = f'frames/{c}/list.ffconcat'
    durs = [float(x) for x in re.findall(r'^duration ([\d.]+)', open(lst).read(), re.M)]
    D = sum(durs)
    cap_out = min(3.8, D - 0.6)
    out = f'clip_{c}.mp4'
    fc = (f"[0:v]fps=30,scale=1920:1080,format=yuv420p[v];"
          f"[1:v]format=rgba,fade=t=in:st=0.25:d=0.35:alpha=1,fade=t=out:st={cap_out:.2f}:d=0.4:alpha=1[c];"
          f"[v][c]overlay=0:0:shortest=1,fade=t=in:st=0:d=0.3,fade=t=out:st={D-0.35:.2f}:d=0.35,format=yuv420p[o]")
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst,
                    '-loop', '1', '-t', f'{D:.2f}', '-i', f'cap_{c}.png',
                    '-filter_complex', fc, '-map', '[o]', '-t', f'{D:.2f}',
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-r', '30', out], check=True)
    parts.append(out)
    print(c, f'{D:.1f}s')
open('parts.txt', 'w').write(''.join(f"file '{p}'\n" for p in parts))
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'parts.txt', '-c', 'copy', '-movflags', '+faststart', 'tinfox-gameplay.mp4'], check=True)
print('done')
