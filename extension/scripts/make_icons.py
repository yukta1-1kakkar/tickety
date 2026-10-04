"""Static Chrome icon matching the Tickety aircraft SVG (Pillow, dev only)."""
from pathlib import Path
from PIL import Image, ImageDraw
folder=Path(__file__).resolve().parents[1]/'icons'
folder.mkdir(exist_ok=True)
scale=8
image=Image.new('RGBA',(64*scale,64*scale))
draw=ImageDraw.Draw(image)
points=[(32,7),(30,8),(28,15),(27,27),(10,37),(10,42),(27,36),(28,48),(21,53),(21,56),(32,53),(43,56),(43,53),(36,48),(37,36),(54,42),(54,37),(37,27),(36,15),(34,8)]
draw.polygon([(x*scale,y*scale) for x,y in points],fill='#226653')
for y in (17,21):draw.line((30*scale,y*scale,34*scale,y*scale),fill='#f8f9f4',width=2*scale)
image=image.rotate(-38,resample=Image.Resampling.BICUBIC)
for size in (16,32,48,128):image.resize((size,size),Image.Resampling.LANCZOS).save(folder/f'tickety-{size}.png')
