(function(){
  const STORAGE_KEY = 'design3d:catalog';
  const CATEGORIES = ['Hall','Kitchen','Toilet','Bedroom','Puja Room','Others'];
  const ADMIN_PASSWORD = 'kiran123';

  let catalog = [];
  let placed = [];      // {id, name, w,h,d, color, shape, x, z, rotY}
  let nextPlacedId = 1;
  let selectedId = null;
  let roomDims = { w: 20, l: 15, h: 9 };

  // ---------------- default catalog ----------------
  function seedCatalog(){
    return [
      { id:'s1', category:'Hall', name:'Sofa', shape:'sofa', w:6, d:2.5, h:3, color:'#8a6142' },
      { id:'s2', category:'Hall', name:'Center Table', shape:'table', w:3, d:1.5, h:1.5, color:'#6b4a30' },
      { id:'s3', category:'Hall', name:'TV Unit', shape:'box', w:5, d:1.4, h:1.8, color:'#4a3220' },
      { id:'s4', category:'Kitchen', name:'Kitchen Counter (L)', shape:'counter', w:8, d:2, h:3, color:'#9c8a6f' },
      { id:'s5', category:'Kitchen', name:'Kitchen Island', shape:'counter', w:4, d:3, h:3, color:'#9c8a6f' },
      { id:'s6', category:'Toilet', name:'Wash Basin', shape:'box', w:2, d:1.5, h:2.8, color:'#e8e2d6' },
      { id:'s7', category:'Toilet', name:'Western Commode', shape:'box', w:1.4, d:2, h:1.4, color:'#f2efe8' },
      { id:'s8', category:'Toilet', name:'Shower Cubicle', shape:'box', w:3, d:3, h:7, color:'#bcd4d6' },
      { id:'s9', category:'Bedroom', name:'Bed — Queen', shape:'bed', w:5.2, d:6.5, h:2.6, color:'#7a4a26' },
      { id:'s10', category:'Bedroom', name:'Wardrobe', shape:'wardrobe', w:6, d:2, h:7, color:'#5c3b22' },
      { id:'s11', category:'Bedroom', name:'Dressing Table', shape:'table', w:3, d:1.5, h:5, color:'#6b4a30' },
      { id:'s12', category:'Bedroom', name:'Bedside Table', shape:'table', w:1.5, d:1.5, h:2, color:'#6b4a30' },
      { id:'s13', category:'Puja Room', name:'Puja Mandir', shape:'wardrobe', w:3, d:1.5, h:5.5, color:'#8a5a2e' },
      { id:'s14', category:'Others', name:'Dining Chair', shape:'chair', w:1.5, d:1.5, h:3, color:'#6b4a30' },
      { id:'s15', category:'Others', name:'Dining Table', shape:'table', w:5, d:3, h:2.5, color:'#6b4a30' },
      { id:'s16', category:'Others', name:'Bookshelf', shape:'wardrobe', w:3, d:1, h:6, color:'#4a3220' }
    ];
  }

  async function loadCatalog(){
    try{
      const res = await window.storage.get(STORAGE_KEY, true);
      catalog = res && res.value ? JSON.parse(res.value) : seedCatalog();
    }catch(e){
      catalog = seedCatalog();
    }
    if(!catalog.length) catalog = seedCatalog();
    renderCatalogSidebar();
    renderAdminList();
  }

  async function saveCatalog(){
    try{
      await window.storage.set(STORAGE_KEY, JSON.stringify(catalog), true);
    }catch(e){
      showToast('Could not save — please try again.');
    }
  }

  function showToast(msg){
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(()=>t.classList.remove('show'), 2200);
  }

  // ---------------- nav ----------------
  const nav = document.getElementById('mainNav');
  document.getElementById('hamburger').addEventListener('click', ()=> nav.classList.toggle('open'));
  document.querySelectorAll('nav button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
      document.getElementById('page-' + btn.dataset.page).classList.add('active');
      nav.classList.remove('open');
      onResize();
    });
  });

  // ================================================================
  // THREE.JS SCENE
  // ================================================================
  let scene, camera, renderer, controls, raycaster, mouse;
  let roomGroup, itemsGroup, floorMesh;
  let dragging = false, dragOffset = new THREE.Vector3();
  const dragPlane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);

  function initThree(){
    const stage = document.getElementById('stage');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xc9d3c4);

    camera = new THREE.PerspectiveCamera(50, stage.clientWidth / stage.clientHeight, 0.1, 500);

    renderer = new THREE.WebGLRenderer({ antialias:true, preserveDrawingBuffer:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(stage.clientWidth, stage.clientHeight);
    renderer.shadowMap.enabled = true;
    stage.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI/2 - 0.02;

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(15, 25, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024,1024);
    scene.add(sun);

    roomGroup = new THREE.Group(); scene.add(roomGroup);
    itemsGroup = new THREE.Group(); scene.add(itemsGroup);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('resize', onResize);

    buildRoom(roomDims.w, roomDims.l, roomDims.h);
    animate();
  }

  function onResize(){
    const stage = document.getElementById('stage');
    if(!stage || !renderer) return;
    const w = stage.clientWidth || 1, h = stage.clientHeight || 1;
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function animate(){
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }

  function clearGroup(g){
    while(g.children.length) g.remove(g.children[0]);
  }

  function buildRoom(w, l, h){
    clearGroup(roomGroup);
    roomDims = { w, l, h };

    // floor
    const floorGeo = new THREE.PlaneGeometry(w, l);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xe4d7bd, side: THREE.DoubleSide });
    floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI/2;
    floorMesh.receiveShadow = true;
    roomGroup.add(floorMesh);

    const grid = new THREE.GridHelper(Math.max(w,l), Math.max(w,l), 0xffffff, 0xbfae8c);
    grid.position.y = 0.01;
    roomGroup.add(grid);

    // walls (back + left + right), open front & top so the room can be viewed
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf3ecdd, side: THREE.DoubleSide, transparent:true, opacity:0.85 });

    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    backWall.position.set(0, h/2, -l/2);
    roomGroup.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(l, h), wallMat);
    leftWall.rotation.y = Math.PI/2;
    leftWall.position.set(-w/2, h/2, 0);
    roomGroup.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(l, h), wallMat);
    rightWall.rotation.y = Math.PI/2;
    rightWall.position.set(w/2, h/2, 0);
    roomGroup.add(rightWall);

    // camera framing
    const dist = Math.max(w, l, h) * 1.3 + 6;
    camera.position.set(dist*0.7, dist*0.6, dist*0.9);
    controls.target.set(0, h*0.3, 0);
    controls.update();
  }

  // ---------------- shape builders ----------------
  function shade(hex, amt){
    let c = parseInt(hex.replace('#',''), 16);
    let r = Math.min(255, Math.max(0, (c>>16) + amt));
    let g = Math.min(255, Math.max(0, ((c>>8)&0xff) + amt));
    let b = Math.min(255, Math.max(0, (c&0xff) + amt));
    return (r<<16) + (g<<8) + b;
  }
  function boxMesh(w,h,d,colorHex){
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(w,0.05), Math.max(h,0.05), Math.max(d,0.05)),
      new THREE.MeshStandardMaterial({ color: colorHex })
    );
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  function buildBox(item){
    const g = new THREE.Group();
    const m = boxMesh(item.w, item.h, item.d, item.color);
    m.position.y = item.h/2;
    g.add(m);
    return g;
  }

  function buildTableLike(item){
    const g = new THREE.Group();
    const topH = Math.min(0.15, item.h*0.12);
    const top = boxMesh(item.w, topH, item.d, item.color);
    top.position.y = item.h - topH/2;
    g.add(top);
    const legR = Math.max(0.05, Math.min(item.w, item.d) * 0.045);
    const legH = Math.max(0.1, item.h - topH);
    const cx = item.w/2 - legR, cz = item.d/2 - legR;
    [[-cx,-cz],[cx,-cz],[-cx,cz],[cx,cz]].forEach(([x,z])=>{
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(legR,legR,legH,8), new THREE.MeshStandardMaterial({color:item.color}));
      leg.position.set(x, legH/2, z);
      leg.castShadow = true;
      g.add(leg);
    });
    return g;
  }

  function buildChair(item){
    const g = new THREE.Group();
    const seatH = item.h*0.5;
    const seat = boxMesh(item.w, item.h*0.1, item.d, item.color);
    seat.position.y = seatH;
    g.add(seat);
    const legR = Math.max(0.04, Math.min(item.w,item.d)*0.05);
    const cx = item.w/2 - legR, cz = item.d/2 - legR;
    [[-cx,-cz],[cx,-cz],[-cx,cz],[cx,cz]].forEach(([x,z])=>{
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(legR,legR,seatH,8), new THREE.MeshStandardMaterial({color:item.color}));
      leg.position.set(x, seatH/2, z);
      leg.castShadow = true;
      g.add(leg);
    });
    const back = boxMesh(item.w, item.h-seatH, Math.max(0.1,item.d*0.15), item.color);
    back.position.set(0, seatH + (item.h-seatH)/2, -item.d/2 + item.d*0.075);
    g.add(back);
    return g;
  }

  function buildWardrobe(item){
    const g = new THREE.Group();
    const body = boxMesh(item.w, item.h, item.d, item.color);
    body.position.y = item.h/2;
    g.add(body);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), new THREE.LineBasicMaterial({ color: 0x241c12 }));
    edges.position.copy(body.position);
    g.add(edges);
    const divider = new THREE.Mesh(new THREE.BoxGeometry(0.03, item.h*0.96, item.d+0.02), new THREE.MeshBasicMaterial({ color: 0x241c12 }));
    divider.position.set(0, item.h/2, 0);
    g.add(divider);
    return g;
  }

  function buildBed(item){
    const g = new THREE.Group();
    const matH = item.h*0.45;
    const mattress = boxMesh(item.w, matH, item.d*0.85, item.color);
    mattress.position.set(0, matH/2, -item.d*0.075);
    g.add(mattress);
    const headboard = boxMesh(item.w, item.h, Math.max(0.1,item.d*0.1), shade(item.color.startsWith('#')?item.color:'#'+item.color, -30) ? item.color : item.color);
    headboard.material.color.set(shade(item.color, -30));
    headboard.position.set(0, item.h/2, -item.d/2 + item.d*0.05);
    g.add(headboard);
    return g;
  }

  function buildSofa(item){
    const g = new THREE.Group();
    const baseH = item.h*0.45;
    const base = boxMesh(item.w, baseH, item.d, item.color);
    base.position.y = baseH/2;
    g.add(base);
    const back = boxMesh(item.w, item.h-baseH, Math.max(0.1,item.d*0.25), item.color);
    back.material.color.set(shade(item.color, -20));
    back.position.set(0, baseH + (item.h-baseH)/2, -item.d/2 + item.d*0.125);
    g.add(back);
    const armW = Math.max(0.1, item.w*0.12);
    [-1,1].forEach(sign=>{
      const arm = boxMesh(armW, item.h*0.6, item.d, item.color);
      arm.material.color.set(shade(item.color, -12));
      arm.position.set(sign*(item.w/2 - armW/2), item.h*0.3, 0);
      g.add(arm);
    });
    return g;
  }

  function buildCounter(item){
    const g = new THREE.Group();
    const baseH = item.h*0.85;
    const base = boxMesh(item.w, baseH, item.d, item.color);
    base.position.y = baseH/2;
    g.add(base);
    const top = boxMesh(item.w+0.1, item.h*0.15, item.d+0.1, '#ffffff');
    top.position.y = baseH + item.h*0.075;
    g.add(top);
    return g;
  }

  function createShapeGroup(item){
    switch(item.shape){
      case 'wardrobe': return buildWardrobe(item);
      case 'bed': return buildBed(item);
      case 'sofa': return buildSofa(item);
      case 'table': return buildTableLike(item);
      case 'chair': return buildChair(item);
      case 'counter': return buildCounter(item);
      default: return buildBox(item);
    }
  }

  // ---------------- placing items ----------------
  function findSpawnSpot(w, d){
    // simple grid scan to find a free-ish spot inside the room
    const marginW = roomDims.w/2 - w/2 - 0.3;
    const marginL = roomDims.l/2 - d/2 - 0.3;
    for(let ring=0; ring<8; ring++){
      const x = (Math.random()*2-1) * Math.max(0.1, marginW * (0.3+ring*0.08));
      const z = (Math.random()*2-1) * Math.max(0.1, marginL * (0.3+ring*0.08));
      const overlap = placed.some(p => Math.abs(p.x-x) < (p.w+w)/2*0.7 && Math.abs(p.z-z) < (p.d+d)/2*0.7);
      if(!overlap) return {x, z};
    }
    return { x:0, z:0 };
  }

  function addPlacedItem(catalogItem){
    const spot = findSpawnSpot(catalogItem.w, catalogItem.d);
    const rec = {
      id: nextPlacedId++,
      name: catalogItem.name,
      shape: catalogItem.shape,
      w: catalogItem.w, d: catalogItem.d, h: catalogItem.h,
      color: catalogItem.color,
      x: spot.x, z: spot.z, rotY: 0
    };
    placed.push(rec);
    const group = createShapeGroup(rec);
    group.position.set(rec.x, 0, rec.z);
    group.userData.placedId = rec.id;
    itemsGroup.add(group);
    updateItemCount();
    selectItem(rec.id);
    showToast(catalogItem.name + ' added to room.');
  }

  function meshForPlacedId(id){
    return itemsGroup.children.find(g => g.userData.placedId === id);
  }

  function updateItemCount(){
    document.getElementById('itemCount').textContent = placed.length + (placed.length===1 ? ' item placed' : ' items placed');
  }

  function clearAllItems(){
    clearGroup(itemsGroup);
    placed = [];
    selectItem(null);
    updateItemCount();
  }

  // ---------------- selection & drag ----------------
  function selectItem(id){
    selectedId = id;
    const panel = document.getElementById('selectedPanel');
    if(id === null){
      panel.style.display = 'none';
      return;
    }
    const rec = placed.find(p=>p.id===id);
    if(!rec){ panel.style.display='none'; return; }
    panel.style.display = 'block';
    document.getElementById('spName').textContent = rec.name;
    document.getElementById('spDims').textContent =
      `${rec.w.toFixed(1)} × ${rec.h.toFixed(1)} × ${rec.d.toFixed(1)} ft (W×H×D)`;
  }

  document.getElementById('rotateBtn').addEventListener('click', ()=>{
    if(selectedId===null) return;
    const rec = placed.find(p=>p.id===selectedId);
    const mesh = meshForPlacedId(selectedId);
    if(!rec || !mesh) return;
    rec.rotY += Math.PI/2;
    mesh.rotation.y = rec.rotY;
  });

  document.getElementById('deleteBtn').addEventListener('click', ()=>{
    if(selectedId===null) return;
    const mesh = meshForPlacedId(selectedId);
    if(mesh) itemsGroup.remove(mesh);
    placed = placed.filter(p=>p.id!==selectedId);
    selectItem(null);
    updateItemCount();
  });

  document.getElementById('clearItemsBtn').addEventListener('click', ()=>{
    if(placed.length && !confirm('Remove all placed items?')) return;
    clearAllItems();
  });

  document.getElementById('resetCamBtn').addEventListener('click', ()=>{
    buildRoomKeepItems(false);
  });

  // ---------------- export: PDF + WhatsApp ----------------
  function captureStageImage(){
    // render one fresh frame so the buffer reflects the current camera/items before capture
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  }

  document.getElementById('downloadPdfBtn').addEventListener('click', ()=>{
    if(!placed.length){ showToast('Add at least one item to the room first.'); return; }
    const imgData = captureStageImage();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFillColor(122,74,38);
    doc.rect(0, 0, 210, 26, 'F');
    doc.setFontSize(20);
    doc.setTextColor(255,255,255);
    doc.text('Kiran Interior', 14, 16);
    doc.setFontSize(10);
    doc.setTextColor(231,207,162);
    doc.text('3D Room Design — ' + roomDims.w + ' x ' + roomDims.l + ' x ' + roomDims.h + ' ft (W x Br x H)', 14, 22);

    // fit the captured image to the page width, preserving aspect ratio
    const pageW = 210, margin = 14;
    const imgW = pageW - margin*2;
    const canvasAspect = renderer.domElement.height / renderer.domElement.width;
    const imgH = imgW * canvasAspect;
    doc.addImage(imgData, 'PNG', margin, 34, imgW, imgH);

    let y = 34 + imgH + 12;
    doc.setDrawColor(184,134,63);
    doc.line(margin, y-6, 210-margin, y-6);
    doc.setFontSize(11);
    doc.setTextColor(30,30,30);
    doc.setFont(undefined, 'bold');
    doc.text('Items in this design', margin, y);
    doc.setFont(undefined, 'normal');
    y += 7;
    doc.setFontSize(9.5);
    placed.forEach(rec=>{
      if(y > 275){ doc.addPage(); y = 20; }
      doc.text(`• ${rec.name} — ${rec.w.toFixed(1)} x ${rec.h.toFixed(1)} x ${rec.d.toFixed(1)} ft (W x H x D)`, margin, y);
      y += 6;
    });

    y += 6;
    if(y > 275){ doc.addPage(); y = 20; }
    doc.setDrawColor(220,220,220);
    doc.line(margin, y, 210-margin, y);
    y += 8;
    doc.setFont(undefined, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(63,79,58);
    doc.text('Contact Kiran Interior: 9966614471', margin, y);

    doc.save('Kiran-Interior-3D-Design.pdf');
    showToast('PDF downloaded.');
  });

  document.getElementById('whatsappBtn').addEventListener('click', ()=>{
    if(!placed.length){ showToast('Add at least one item to the room first.'); return; }
    let lines = [
      `*Kiran Interior — 3D Room Design*`,
      `Room: ${roomDims.w} x ${roomDims.l} x ${roomDims.h} ft (W x Br x H)`,
      ``
    ];
    placed.forEach(rec=>{
      lines.push(`• ${rec.name} — ${rec.w.toFixed(1)}x${rec.h.toFixed(1)}x${rec.d.toFixed(1)} ft`);
    });
    lines.push(``, `(Please attach the downloaded PDF/picture here)`);
    const text = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/919966614471?text=${text}`, '_blank');
  });

  function buildRoomKeepItems(){
    const dist = Math.max(roomDims.w, roomDims.l, roomDims.h) * 1.3 + 6;
    camera.position.set(dist*0.7, dist*0.6, dist*0.9);
    controls.target.set(0, roomDims.h*0.3, 0);
    controls.update();
  }

  function setMouseFromEvent(e){
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX-rect.left)/rect.width) * 2 - 1;
    mouse.y = -((e.clientY-rect.top)/rect.height) * 2 + 1;
  }

  function onPointerDown(e){
    setMouseFromEvent(e);
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(itemsGroup.children, true);
    if(hits.length){
      let obj = hits[0].object;
      while(obj && obj.userData.placedId===undefined) obj = obj.parent;
      if(obj){
        selectItem(obj.userData.placedId);
        dragging = true;
        controls.enabled = false;
        const hitPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(dragPlane, hitPoint);
        dragOffset.copy(obj.position).sub(hitPoint);
      }
    } else {
      selectItem(null);
    }
  }

  function onPointerMove(e){
    if(!dragging || selectedId===null) return;
    setMouseFromEvent(e);
    raycaster.setFromCamera(mouse, camera);
    const hitPoint = new THREE.Vector3();
    if(!raycaster.ray.intersectPlane(dragPlane, hitPoint)) return;
    const rec = placed.find(p=>p.id===selectedId);
    const mesh = meshForPlacedId(selectedId);
    if(!rec || !mesh) return;
    let x = hitPoint.x + dragOffset.x;
    let z = hitPoint.z + dragOffset.z;
    const maxX = roomDims.w/2 - rec.w/2;
    const maxZ = roomDims.l/2 - rec.d/2;
    x = Math.max(-maxX, Math.min(maxX, x));
    z = Math.max(-maxZ, Math.min(maxZ, z));
    rec.x = x; rec.z = z;
    mesh.position.set(x, 0, z);
  }

  function onPointerUp(){
    if(dragging){
      dragging = false;
      controls.enabled = true;
    }
  }

  // ---------------- build room button ----------------
  document.getElementById('buildRoomBtn').addEventListener('click', ()=>{
    const w = parseFloat(document.getElementById('roomWidth').value) || 20;
    const l = parseFloat(document.getElementById('roomBreadth').value) || 15;
    const h = parseFloat(document.getElementById('roomHeight').value) || 9;
    if(placed.length && !confirm('Rebuilding the room will remove all placed items. Continue?')) return;
    clearAllItems();
    buildRoom(w, l, h);
    showToast('Room built: ' + w + ' × ' + l + ' × ' + h + ' ft');
  });

  // ================================================================
  // CATALOG SIDEBAR (Designer page)
  // ================================================================
  function renderCatalogSidebar(){
    const container = document.getElementById('catalogList');
    container.innerHTML = CATEGORIES.map(cat=>{
      const items = catalog.filter(c=>c.category===cat);
      const rows = items.length
        ? items.map(item => `
            <div class="cat-item">
              <div>
                <span class="swatch" style="background:${item.color}"></span>${item.name}
                <div class="meta">${item.w}×${item.h}×${item.d} ft (W×H×D)</div>
              </div>
              <button data-add="${item.id}">+ Add</button>
            </div>`).join('')
        : '<p class="meta" style="padding:6px 0">No items yet.</p>';
      return `
        <div class="category" data-cat="${cat}">
          <button class="category-head"><span>${cat}</span><span class="chev">›</span></button>
          <div class="category-body">${rows}</div>
        </div>`;
    }).join('');

    container.querySelectorAll('.category-head').forEach(btn=>{
      btn.addEventListener('click', ()=> btn.parentElement.classList.toggle('open'));
    });
    container.querySelectorAll('[data-add]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const item = catalog.find(c=>c.id===btn.dataset.add);
        if(item) addPlacedItem(item);
      });
    });
    // open the first category by default
    const first = container.querySelector('.category');
    if(first) first.classList.add('open');
  }

  // ================================================================
  // ADMIN
  // ================================================================
  document.getElementById('adminLoginBtn').addEventListener('click', ()=>{
    const pass = document.getElementById('adminPass').value;
    if(pass === ADMIN_PASSWORD){
      document.getElementById('adminGate').style.display = 'none';
      document.getElementById('adminPanel').style.display = 'block';
    } else {
      showToast('Incorrect password.');
    }
  });
  document.getElementById('adminPass').addEventListener('keydown', e=>{
    if(e.key==='Enter') document.getElementById('adminLoginBtn').click();
  });

  document.getElementById('addCatalogBtn').addEventListener('click', async ()=>{
    const category = document.getElementById('newCategory').value;
    const name = document.getElementById('newName').value.trim();
    const shape = document.getElementById('newShape').value;
    const color = document.getElementById('newColor').value;
    const w = parseFloat(document.getElementById('newW').value);
    const d = parseFloat(document.getElementById('newD').value);
    const h = parseFloat(document.getElementById('newH').value);
    if(!name || !w || !d || !h){ showToast('Fill in name, width, depth and height.'); return; }

    catalog.push({ id:'item-'+Date.now(), category, name, shape, color, w, d, h });
    await saveCatalog();
    renderCatalogSidebar();
    renderAdminList();
    document.getElementById('newName').value = '';
    document.getElementById('newW').value = '';
    document.getElementById('newD').value = '';
    document.getElementById('newH').value = '';
    showToast('Item added.');
  });

  function renderAdminList(){
    const list = document.getElementById('adminList');
    if(!list) return;
    if(!catalog.length){
      list.innerHTML = '<p class="hint">No items yet — add your first one above.</p>';
      return;
    }
    list.innerHTML = catalog.map((item,i)=>`
      <div class="item-row">
        <span class="swatch" style="background:${item.color}"></span>
        <div>
          <div style="font-weight:600">${item.name}</div>
          <div class="hint">${item.category} · ${item.shape}</div>
        </div>
        <div class="hint">W/D/H ft</div>
        <input type="number" step="0.1" data-w="${i}" value="${item.w}">
        <input type="number" step="0.1" data-d="${i}" value="${item.d}">
        <input type="number" step="0.1" data-h="${i}" value="${item.h}">
        <button class="ghost" data-save="${i}">Save</button>
        <button class="ghost danger" data-del="${i}">Delete</button>
      </div>
    `).join('');
  }

  document.getElementById('adminList').addEventListener('click', async (e)=>{
    if(e.target.dataset.save !== undefined){
      const i = Number(e.target.dataset.save);
      const w = parseFloat(document.querySelector(`[data-w="${i}"]`).value);
      const d = parseFloat(document.querySelector(`[data-d="${i}"]`).value);
      const h = parseFloat(document.querySelector(`[data-h="${i}"]`).value);
      if(w) catalog[i].w = w;
      if(d) catalog[i].d = d;
      if(h) catalog[i].h = h;
      await saveCatalog();
      renderCatalogSidebar();
      showToast('Item updated.');
    }
    if(e.target.dataset.del !== undefined){
      const i = Number(e.target.dataset.del);
      catalog.splice(i,1);
      await saveCatalog();
      renderCatalogSidebar();
      renderAdminList();
      showToast('Item deleted.');
    }
  });

  // ---------------- boot ----------------
  loadCatalog();
  initThree();
})();
