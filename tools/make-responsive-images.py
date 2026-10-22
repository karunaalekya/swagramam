#!/usr/bin/env python3
"""Swagramam: builds the responsive image variants used by srcset / <picture>.
Run from the site folder:  python3 tools/make-responsive-images.py
Needs Pillow (pip install pillow). Originals are never modified; variants are
written next to them as  name-480w.webp, name-p.webp (portrait phone crop), etc."""
import os,glob
from PIL import Image
A='assets/'
def rs(im,w): return im.resize((w,round(im.height*w/im.width)),Image.LANCZOS)
def save(im,p,q=80):
    im.save(p,'WEBP',quality=q,method=6); print(f'{p:52}{im.width}x{im.height} {os.path.getsize(p)//1024}KB')
def load(p): 
    im=Image.open(p); return im.convert('RGBA') if 'A' in im.getbands() or im.mode=='P' else im.convert('RGB')
def widths(src,ws,full=None):
    im=load(A+src); base=os.path.splitext(A+src)[0]
    for w in ws:
        if w<im.width: save(rs(im,w),f'{base}-{w}w.webp')
def pcrop(src,ratio=.58,cx=.5):
    """portrait crop for phones (hero slider): full height, centred on cx"""
    im=load(A+src); w=round(im.height*ratio); x=max(0,min(im.width-w,round(im.width*cx-w/2)))
    save(im.crop((x,0,x+w,im.height)),os.path.splitext(A+src)[0]+'-p.webp',78)
# hero slider + specialties (square dishes and the sunset hero)
for s in ['6183ce3156','870f501e7d','25811f3fb4','bab7fb66b0','232e813d10']:
    widths(s+'.webp',[160,480,800]); pcrop(s+'.webp')
# other photos
for s,ws in {'32902c862f':[400,800],'2f371c7543':[400,800],'catering-back':[480,800],'amma-uttaram':[480,800],
             '4ad16b9389':[140,212],'00331ec7de':[320]}.items(): widths(s+'.webp',ws)
# jpg -> webp (same picture, much smaller) + variants
for s,ws,q in [('5ab762719e',[800,1400],76),('5d5c6f8459',[320],80),('9957f2317f',[320],80)]:
    im=load(A+s+'.jpg'); save(im,A+s+'.webp',q); widths(s+'.webp',ws)
# menu printed pages: tiny thumb for the page strip, 1100w for the phone lightbox
for s in ['9da8e61155','0657a333de','3a87031808','dc2b99670c','a0b1a97f09','d3c2e568b4']: widths(s+'.webp',[320,1100])
# dish photos used in menu rows (shown ~165-240px wide)
for p in glob.glob(A+'dishes/*.webp'):
    n=os.path.basename(p)
    if n.endswith('-t.webp') or n=='hero-thali.webp' or '-480w' in n: continue
    widths('dishes/'+n,[480])
# thali banner: phone crop (centred on the thali) + mid size
im=load(A+'dishes/hero-thali.webp'); w=1150; x=round(im.width*.62-w/2)
save(rs(im.crop((x,0,x+w,im.height)),800),A+'dishes/hero-thali-m.webp',78)
widths('dishes/hero-thali.webp',[1200])
# CSS backgrounds: phone versions
widths('village-reviews.webp',[900]); widths('rewards-bg.webp',[900]); widths('fbd2217782.webp',[700])
# intro images (first visit only): phone-sized versions
widths('4734bbe90a.webp',[960]); widths('5ae21f2aa1.webp',[320,600])
# PNG illustrations -> WebP (alpha kept); the PNG originals stay as fallback files
for p in glob.glob(A+'*.png'):
    n=os.path.basename(p)
    if n.startswith(('icon','favicon','apple')): continue
    im=Image.open(p).convert('RGBA'); out=p[:-4]+'.webp'
    im.save(out,'WEBP',quality=90,method=6,alpha_quality=95)
    if os.path.getsize(out)>os.path.getsize(p)*.8: os.remove(out); continue
    print(f'{out:52}{os.path.getsize(p)//1024}KB -> {os.path.getsize(out)//1024}KB')
