(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('canvas'), ctx = canvas.getContext('2d');
  const base = document.createElement('canvas'), baseCtx = base.getContext('2d');
  base.width = canvas.width; base.height = canvas.height;
  const framesEl = $('frames'), status = $('status');
  let frames = [], current = 0, photoImage = null, drawing = false, drawMode = false, drag = null, outputUrl = null;

  function newFrame() { return { background: base.toDataURL(), photo: null, caption: null, strokes: [] }; }
  function copyFrame(f) { return { background: f.background, photo: f.photo ? {...f.photo} : null, caption: f.caption ? {...f.caption} : null, strokes: f.strokes.map(s => ({...s, points: s.points.map(p => ({...p}))})) }; }
  function load(src) { return new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = reject; im.src = src; }); }
  function photoRect(p) { return {x:p.x-p.w*p.scale/2,y:p.y-p.h*p.scale/2,w:p.w*p.scale,h:p.h*p.scale}; }
  function paintPhoto(target, p, im) {
    if (!p || !im) return;
    const r = photoRect(p), zoom = p.zoom || 1, sw = im.naturalWidth / zoom, sh = im.naturalHeight / zoom;
    target.getContext('2d').drawImage(im,(im.naturalWidth-sw)/2,(im.naturalHeight-sh)/2,sw,sh,r.x,r.y,r.w,r.h);
  }
  function paintStrokes(target, strokes) {
    const c = target.getContext('2d');
    for (const s of strokes || []) {
      if (!s.points.length) continue;
      c.save(); c.strokeStyle = s.color; c.lineWidth = s.size; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(s.points[0].x,s.points[0].y);
      for (let i=1;i<s.points.length;i++) c.lineTo(s.points[i].x,s.points[i].y);
      if (s.points.length===1) { c.lineTo(s.points[0].x+0.01,s.points[0].y+0.01); }
      c.stroke(); c.restore();
    }
  }
  function paintCaption(target, cap) {
    if (!cap) return;
    const c=target.getContext('2d'); c.save(); c.fillStyle=cap.color; c.textAlign='center'; c.textBaseline='middle'; c.font=`900 ${cap.size}px system-ui,sans-serif`; c.shadowColor='#000a'; c.shadowBlur=7; c.fillText(cap.text,cap.x,cap.y,target.width-24); c.restore();
  }
  function redraw() {
    ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(base,0,0);
    const f=frames[current]; if (!f) return;
    paintPhoto(canvas,f.photo,photoImage); paintStrokes(canvas,f.strokes); paintCaption(canvas,f.caption);
  }
  function save() { if (frames.length) frames[current].background=base.toDataURL(); }
  async function showFrame(n) {
    if (!frames[n]) return;
    const f=frames[n], im=await load(f.background); baseCtx.clearRect(0,0,base.width,base.height); baseCtx.drawImage(im,0,0,base.width,base.height);
    photoImage=f.photo ? await load(f.photo.src) : null; current=n; redraw(); syncImageControls();
  }
  function syncImageControls() {
    const p=frames[current]?.photo; $('imageTools').hidden=!p;
    if(p){$('imageSize').value=Math.round(p.scale*100);$('imageZoom').value=Math.round(p.zoom*100);$('sizeValue').textContent=Math.round(p.scale*100)+'%';$('zoomValue').textContent=Math.round(p.zoom*100)+'%';}
  }
  async function renderThumbs() {
    framesEl.replaceChildren();
    frames.forEach((f,n)=>{
      const b=document.createElement('button'); b.type='button'; b.className='frame'+(n===current?' active':''); b.setAttribute('aria-label',`Edit frame ${n+1}`);
      const t=document.createElement('canvas'); t.width=t.height=76; b.append(t); framesEl.append(b);
      (async()=>{const bg=await load(f.background);const tmp=document.createElement('canvas');tmp.width=tmp.height=76;tmp.getContext('2d').drawImage(bg,0,0,76,76);const pi=f.photo?await load(f.photo.src):null;paintPhoto(tmp,f.photo,pi);paintStrokes(tmp,f.strokes);paintCaption(tmp,f.caption);t.getContext('2d').drawImage(tmp,0,0)})();
      b.onclick=async()=>{save();await showFrame(n);renderThumbs()};
    });
  }
  function addFrame() { save(); const f=frames[current] ? copyFrame(frames[current]) : newFrame(); frames.splice(current+1,0,f); current++; redraw(); syncImageControls(); renderThumbs(); }
  $('addFrame').onclick=addFrame; $('duplicate').onclick=addFrame;
  $('delete').onclick=async()=>{if(!frames.length)return;frames.splice(current,1);current=Math.max(0,Math.min(current,frames.length-1));if(frames.length)await showFrame(current);else{baseCtx.fillStyle=$('background').value;baseCtx.fillRect(0,0,base.width,base.height);photoImage=null;redraw();syncImageControls()}renderThumbs()};
  $('background').oninput=()=>{baseCtx.fillStyle=$('background').value;baseCtx.fillRect(0,0,base.width,base.height);save();redraw();renderThumbs()};
  $('upload').onchange=e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=async()=>{try{photoImage=await load(reader.result);if(!frames.length)frames.push(newFrame());const scale=Math.min(1,(canvas.width*.72)/photoImage.naturalWidth,(canvas.height*.72)/photoImage.naturalHeight);frames[current].photo={src:reader.result,x:canvas.width/2,y:canvas.height/2,w:photoImage.naturalWidth*scale,h:photoImage.naturalHeight*scale,scale:1,zoom:1};redraw();syncImageControls();renderThumbs();status.textContent='Image added. Drag it to move, or use Size and Crop / zoom.'}catch{status.textContent='Could not load that image.'}};reader.readAsDataURL(file);e.target.value=''};
  $('imageSize').oninput=()=>{const p=frames[current]?.photo;if(!p)return;p.scale=Number($('imageSize').value)/100;$('sizeValue').textContent=$('imageSize').value+'%';redraw();renderThumbs()};
  $('imageZoom').oninput=()=>{const p=frames[current]?.photo;if(!p)return;p.zoom=Number($('imageZoom').value)/100;$('zoomValue').textContent=$('imageZoom').value+'%';redraw();renderThumbs()};
  $('drawMode').onclick=()=>{drawMode=!drawMode;$('drawMode').textContent=drawMode?'✏️ Draw: On':'✏️ Draw: Off';$('drawMode').classList.toggle('active',drawMode);canvas.style.cursor=drawMode?'crosshair':'grab';status.textContent=drawMode?'Drag on the canvas to draw.':'Draw mode off. Drag images or captions to move them.'};
  $('undoStroke').onclick=()=>{const f=frames[current];if(f?.strokes.length){f.strokes.pop();redraw();renderThumbs()}};
  $('addText').onclick=()=>{const text=$('caption').value.trim();if(!text){status.textContent='Type a caption first.';return}if(!frames.length)frames.push(newFrame());frames[current].caption={text,x:canvas.width/2,y:canvas.height/2,color:$('textColor').value,size:Math.max(10,Math.min(180,Number($('textSize').value)||56))};redraw();renderThumbs();status.textContent='Caption added. Drag it on the canvas to move it.'};
  function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}}
  canvas.addEventListener('pointerdown',e=>{
    const f=frames[current];if(!f)return;const p=point(e);
    if(drawMode){f.strokes.push({color:$('brushColor').value,size:Math.max(1,Number($('brushSize').value)||8),points:[p]});drawing=true;canvas.setPointerCapture(e.pointerId);redraw();e.preventDefault();return}
    const r=f.photo&&photoImage?photoRect(f.photo):null;
    if(r&&p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h)drag={type:'photo',dx:f.photo.x-p.x,dy:f.photo.y-p.y};
    else if(f.caption){f.caption.x=p.x;f.caption.y=p.y;drag={type:'caption',dx:0,dy:0}}
    else return;
    canvas.setPointerCapture(e.pointerId);e.preventDefault();
  });
  canvas.addEventListener('pointermove',e=>{const p=point(e),f=frames[current];if(drawing){f.strokes.at(-1).points.push(p);redraw();return}if(!drag||!f)return;if(drag.type==='photo'){f.photo.x=p.x+drag.dx;f.photo.y=p.y+drag.dy}else{f.caption.x=p.x;f.caption.y=p.y}redraw()});
  function endPointer(){if(drawing){drawing=false;save();renderThumbs()}if(drag){drag=null;save();renderThumbs()}}canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);
  $('width').onchange=$('height').onchange=async()=>{save();const src=base.toDataURL(),w=Math.max(80,Math.min(800,Number($('width').value)||500)),h=Math.max(80,Math.min(800,Number($('height').value)||500));canvas.width=base.width=w;canvas.height=base.height=h;const im=await load(src);baseCtx.drawImage(im,0,0,w,h);if(frames[current]?.caption){frames[current].caption.x=w/2;frames[current].caption.y=h/2}if(frames[current]?.photo){frames[current].photo.x=w/2;frames[current].photo.y=h/2}save();redraw();renderThumbs()};
  $('render').onclick=async()=>{save();if(!frames.length)frames.push(newFrame());if(!window.GIF){status.textContent='GIF encoder failed to load. Reload the page.';return}const button=$('render');button.disabled=true;status.textContent='Rendering GIF…';try{if(outputUrl)URL.revokeObjectURL(outputUrl);const gif=new GIF({workers:2,quality:10,width:canvas.width,height:canvas.height,workerScript:'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js'});for(const f of frames){const bg=await load(f.background),pi=f.photo?await load(f.photo.src):null,tmp=document.createElement('canvas');tmp.width=canvas.width;tmp.height=canvas.height;tmp.getContext('2d').drawImage(bg,0,0);paintPhoto(tmp,f.photo,pi);paintStrokes(tmp,f.strokes);paintCaption(tmp,f.caption);gif.addFrame(tmp,{copy:true,delay:Math.max(50,Math.min(3000,Number($('delay').value)||250))})}gif.on('finished',blob=>{outputUrl=URL.createObjectURL(blob);const im=new Image();im.src=outputUrl;im.alt='Generated GIF';$('preview').replaceChildren(im);const link=$('download');link.href=outputUrl;link.style.pointerEvents='auto';link.style.opacity='1';status.textContent='GIF ready!';button.disabled=false});gif.on('abort',()=>{status.textContent='Rendering cancelled.';button.disabled=false});gif.render()}catch(error){status.textContent='Could not render GIF. Try smaller frames.';button.disabled=false}};
  baseCtx.fillStyle=$('background').value;baseCtx.fillRect(0,0,base.width,base.height);frames.push(newFrame());redraw();syncImageControls();renderThumbs();
})();
