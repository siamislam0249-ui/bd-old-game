/**
 * এক্কাদোক্কা (কুতকুত) 3D - Three.js আধুনিক থ্রিডি গেম ইঞ্জিন
 * - ৩ডি গ্রামীণ মাটির কোর্ট ও খড়িমাটির দাগ (রেফারেন্স ছবির মতো ১-৬ ঘর)
 * - ৩ডি পোড়ামাটির চাড়া ও রিয়েল-টাইম ৩ডি ফিজিক্স
 * - এক পায়ে লাফানো ৩ডি গ্রামীণ ছেলে অ্যানিমেশন
 * - টাচ রে-কাস্টিং, ৩ডি প্রজেক্টাইল ট্র্যাজেক্টরি ও লাইন কলিশন
 */

// Standalone Three.js UMD
const THREE = window.THREE;

class Ekkadokka3D {
  constructor(container) {
    this.container = container;
    this.width = container.clientWidth || window.innerWidth;
    this.height = container.clientHeight || window.innerHeight;

    // গেমের মোড ও স্কোর
    this.mode = 'p_vs_ai'; // 'p_vs_ai' or 'p_vs_p'
    this.activePlayerIdx = 0;
    this.playerTargets = [1, 1]; // [P1 target, P2/AI target]
    this.scores = [0, 0];
    this.playerNames = ['আপনি', 'বল্টু'];
    this.isAI = [false, true];

    // স্টেটসমূহ: 'MENU', 'THROW_AIM', 'THROW_FLIGHT', 'VALIDATE_THROW',
    // 'HOPPING', 'KICK_CHARA', 'RETURN_HOP', 'FOUL_PAUSE', 'ROUND_SUCCESS', 'GAME_OVER'
    this.state = 'MENU';
    this.cameraMode = 'iso'; // 'iso' or 'top'

    this.clock = new THREE.Clock();
    this.initScene();
    this.initCourtGeometry();
    this.init3DChara();
    this.init3DCharacter();
    this.initRaycaster();
    this.initEvents();

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  // ৩ডি সিন, ক্যামেরা ও লাইটিং
  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xb89868);
    this.scene.fog = new THREE.FogExp2(0xb89868, 0.018);

    // ক্যামেরা
    this.camera = new THREE.PerspectiveCamera(46, this.width / this.height, 0.1, 150);
    this.setCameraPosition('iso');

    // রেন্ডারার
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.container.appendChild(this.renderer.domElement);

    // লাইটিং (বাংলার মিষ্টি রোদ)
    const ambientLight = new THREE.AmbientLight(0xfff3e0, 0.75);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xfff8e1, 0x5d4037, 0.45);
    hemiLight.position.set(0, 25, 0);
    this.scene.add(hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff5d6, 1.35);
    this.sunLight.position.set(12, 24, 10);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 60;
    this.sunLight.shadow.camera.left = -15;
    this.sunLight.shadow.camera.right = 15;
    this.sunLight.shadow.camera.top = 15;
    this.sunLight.shadow.camera.bottom = -15;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    // গ্রামীণ মাটির উঠোন গ্রাউন্ড
    const groundGeo = new THREE.PlaneGeometry(60, 60);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xd2b280,
      roughness: 0.9,
      metalness: 0.05
    });
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // উঠোনের পাশে ছোট ছোট সবুজ ঘাসের স্তূপ (3D decorative tufts)
    this.createGrassTufts();
  }

  setCameraPosition(mode = 'iso') {
    this.cameraMode = mode;
    if (mode === 'iso') {
      // আইসোমেট্রিক ভিউ (সুন্দর ৩ডি দৃশ্য ও সামনে খোলামেলা জায়গা)
      this.camera.position.set(0, 16.5, 12.8);
      this.camera.lookAt(0, 0, -0.4);
    } else {
      // টপ-ডাউন ভিউ
      this.camera.position.set(0, 19.5, 0.01);
      this.camera.lookAt(0, 0, 0);
    }
  }

  toggleCamera() {
    this.setCameraPosition(this.cameraMode === 'iso' ? 'top' : 'iso');
  }

  createGrassTufts() {
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 0.7 });
    const tuftCoords = [
      [-5.5, -4], [5.5, -3], [-5.2, 1], [5.3, 2], [-5.6, 5], [5.5, 6]
    ];
    tuftCoords.forEach(([gx, gz]) => {
      const gGroup = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6 + Math.random() * 0.3, 4), grassMat);
        blade.position.set((Math.random() - 0.5) * 0.4, 0.3, (Math.random() - 0.5) * 0.4);
        blade.rotation.z = (Math.random() - 0.5) * 0.4;
        blade.castShadow = true;
        gGroup.add(blade);
      }
      gGroup.position.set(gx, 0, gz);
      this.scene.add(gGroup);
    });
  }

  // রেফারেন্স ছবির শতভাগ হুবহু ৩ডি কোর্ট জ্যামিতি
  initCourtGeometry() {
    // স্থানাঙ্ক:
    // Z: -5.0 (শীর্ষ) থেকে +2.0 (বর্গক্ষেত্রের শেষ)
    // Z: +2.0 থেকে +3.8 (ঘর ৫)
    // Z: +3.8 থেকে +5.6 (ঘর ৬)
    // Z: +5.8 থেকে +7.5 (বেসলাইন / দাঁড়ানোর জায়গা)
    // X: -3.5 (বাম) থেকে +3.5 (ডান)

    this.courtWidth = 7.0; // X: -3.5 to +3.5
    this.squareTopZ = -5.0;
    this.squareBotZ = 2.0; // বর্গ উচ্চতা 7.0
    this.rect5BotZ = 3.8;  // আয়তক্ষেত্র ৫ উচ্চতা 1.8
    this.rect6BotZ = 5.6;  // আয়তক্ষেত্র ৬ উচ্চতা 1.8
    this.baselineZ = 6.8;  // বেসলাইন কেন্দ্র

    const halfW = this.courtWidth / 2; // 3.5

    // ৬টি ঘরের বহুভুজ (Polygons)
    this.boxes = {
      1: {
        num: 1, bn: '১', name: 'ঘর ১ (বাম ত্রিভুজ)',
        poly: [ [-halfW, this.squareTopZ], [0, -1.5], [-halfW, this.squareBotZ] ],
        center: { x: -1.8, z: -1.5 }
      },
      2: {
        num: 2, bn: '২', name: 'ঘর ২ (উপরের ত্রিভুজ)',
        poly: [ [-halfW, this.squareTopZ], [halfW, this.squareTopZ], [0, -1.5] ],
        center: { x: 0, z: -3.3 }
      },
      3: {
        num: 3, bn: '৩', name: 'ঘর ৩ (ডান ত্রিভুজ)',
        poly: [ [halfW, this.squareTopZ], [halfW, this.squareBotZ], [0, -1.5] ],
        center: { x: 1.8, z: -1.5 }
      },
      4: {
        num: 4, bn: '৪', name: 'ঘর ৪ (নিচের ত্রিভুজ)',
        poly: [ [-halfW, this.squareBotZ], [0, -1.5], [halfW, this.squareBotZ] ],
        center: { x: 0, z: 0.3 }
      },
      5: {
        num: 5, bn: '৫', name: 'ঘর ৫ (মাঝের আয়তক্ষেত্র)',
        poly: [ [-halfW, this.squareBotZ], [halfW, this.squareBotZ], [halfW, this.rect5BotZ], [-halfW, this.rect5BotZ] ],
        center: { x: 0, z: 2.9 }
      },
      6: {
        num: 6, bn: '৬', name: 'ঘর ৬ (শুরুর আয়তক্ষেত্র)',
        poly: [ [-halfW, this.rect5BotZ], [halfW, this.rect5BotZ], [halfW, this.rect6BotZ], [-halfW, this.rect6BotZ] ],
        center: { x: 0, z: 4.7 }
      }
    };

    // দাগসমূহ (Line segments)
    this.lineSegments = [
      { id: 'top', p1: [-halfW, this.squareTopZ], p2: [halfW, this.squareTopZ] },
      { id: 'sq_left', p1: [-halfW, this.squareTopZ], p2: [-halfW, this.squareBotZ] },
      { id: 'sq_right', p1: [halfW, this.squareTopZ], p2: [halfW, this.squareBotZ] },
      { id: 'diag1', p1: [-halfW, this.squareTopZ], p2: [halfW, this.squareBotZ] },
      { id: 'diag2', p1: [halfW, this.squareTopZ], p2: [-halfW, this.squareBotZ] },
      { id: 'div_4_5', p1: [-halfW, this.squareBotZ], p2: [halfW, this.squareBotZ] },
      { id: 'div_5_6', p1: [-halfW, this.rect5BotZ], p2: [halfW, this.rect5BotZ] },
      { id: 'bot_6', p1: [-halfW, this.rect6BotZ], p2: [halfW, this.rect6BotZ] },
      { id: 'rect_l', p1: [-halfW, this.squareBotZ], p2: [-halfW, this.rect6BotZ] },
      { id: 'rect_r', p1: [halfW, this.squareBotZ], p2: [halfW, this.rect6BotZ] }
    ];

    // ৩ডি সাদা চক দাগ রেন্ডারিং
    this.chalkLinesGroup = new THREE.Group();
    this.lineMeshes = {};

    this.lineSegments.forEach(seg => {
      const p1 = new THREE.Vector3(seg.p1[0], 0.02, seg.p1[1]);
      const p2 = new THREE.Vector3(seg.p2[0], 0.02, seg.p2[1]);
      const dist = p1.distanceTo(p2);
      const center = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

      const lineGeo = new THREE.BoxGeometry(0.12, 0.03, dist);
      const lineMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.9,
        metalness: 0.1
      });
      const mesh = new THREE.Mesh(lineGeo, lineMat);
      mesh.position.copy(center);
      mesh.lookAt(p2);
      mesh.receiveShadow = true;

      this.lineMeshes[seg.id] = mesh;
      this.chalkLinesGroup.add(mesh);
    });
    this.scene.add(this.chalkLinesGroup);

    // ৩ডি বাংলা সংখ্যা টেক্সচার ১-৬
    this.createNumberDecals();

    // বেসলাইন ডটেড মার্কার ৩ডি
    this.createBaselineMarker();

    // টার্গেট হাইলাইটার রিং (৩ডি লক্ষ্য নির্দেশক)
    const ringGeo = new THREE.RingGeometry(0.7, 0.85, 32);
    this.targetRingMat = new THREE.MeshBasicMaterial({ color: 0xff9800, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
    this.targetRing = new THREE.Mesh(ringGeo, this.targetRingMat);
    this.targetRing.rotation.x = -Math.PI / 2;
    this.targetRing.position.set(0, 0.04, -1.5);
    this.scene.add(this.targetRing);
  }

  createNumberDecals() {
    for (let i = 1; i <= 6; i++) {
      const b = this.boxes[i];
      const cvs = document.createElement('canvas');
      cvs.width = 128;
      cvs.height = 128;
      const c = cvs.getContext('2d');
      c.font = 'bold 90px "Hind Siliguri", sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = '#0d47a1';
      c.fillText(b.bn, 64, 68);

      const tex = new THREE.CanvasTexture(cvs);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), mat);
      plane.rotation.x = -Math.PI / 2;
      plane.position.set(b.center.x, 0.025, b.center.z);
      this.scene.add(plane);
    }
  }

  createBaselineMarker() {
    const geo = new THREE.PlaneGeometry(this.courtWidth + 0.6, 1.2);
    const cvs = document.createElement('canvas');
    cvs.width = 512;
    cvs.height = 128;
    const c = cvs.getContext('2d');
    c.fillStyle = 'rgba(255, 248, 225, 0.35)';
    c.fillRect(0, 0, 512, 128);
    c.strokeStyle = '#5d4037';
    c.lineWidth = 6;
    c.setLineDash([16, 12]);
    c.strokeRect(4, 4, 504, 120);
    c.fillStyle = '#4e342e';
    c.font = 'bold 36px "Hind Siliguri", sans-serif';
    c.textAlign = 'center';
    c.fillText('দাঁড়ানোর জায়গা (সূচনা রেখা)', 256, 75);

    const tex = new THREE.CanvasTexture(cvs);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, 0.02, this.baselineZ);
    this.scene.add(mesh);
  }

  // ৩ডি খাঁটি পোড়ামাটির চাড়া (Terracotta pottery piece)
  init3DChara() {
    this.charaGroup = new THREE.Group();

    // মাটির হাঁড়ির ভাঙা টুকরোর মতো খাঁজকাটা ৩ডি জিওমেট্রি
    const charaShape = new THREE.Shape();
    const r = 0.38;
    charaShape.moveTo(-r * 0.9, -r * 0.7);
    charaShape.lineTo(r * 0.4, -r * 1.0);
    charaShape.lineTo(r * 1.0, -r * 0.3);
    charaShape.lineTo(r * 0.8, r * 0.8);
    charaShape.lineTo(-r * 0.3, r * 1.0);
    charaShape.lineTo(-r * 1.0, r * 0.2);
    charaShape.closePath();

    const extrudeSettings = { depth: 0.1, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.04, bevelThickness: 0.04 };
    const charaGeo = new THREE.ExtrudeGeometry(charaShape, extrudeSettings);
    charaGeo.center();

    const charaMat = new THREE.MeshStandardMaterial({
      color: 0xbf491f, // পোড়ামাটি লালচে বাদামি
      roughness: 0.85,
      metalness: 0.05
    });

    this.charaMesh = new THREE.Mesh(charaGeo, charaMat);
    this.charaMesh.rotation.x = Math.PI / 2;
    this.charaMesh.castShadow = true;
    this.charaMesh.receiveShadow = true;
    this.charaGroup.add(this.charaMesh);

    this.charaGroup.position.set(0.6, 0.06, this.baselineZ);
    this.scene.add(this.charaGroup);

    // ফিজিক্স স্টেট
    this.charaState = {
      isAirborne: false,
      isSliding: false,
      flightProgress: 0,
      flightDuration: 0.6,
      start: new THREE.Vector3(),
      target: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      boxNum: null
    };
  }

  // ৩ডি গ্রামীণ ছেলে কার্টুন মডেল (এক পায়ে লাফানো ভঙ্গি)
  init3DCharacter() {
    this.playerGroup = new THREE.Group();

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xdf9a68, roughness: 0.8 });
    this.shirtMatP1 = new THREE.MeshStandardMaterial({ color: 0x1976d2, roughness: 0.6 });
    this.shirtMatAI = new THREE.MeshStandardMaterial({ color: 0xe65100, roughness: 0.6 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1a237e, roughness: 0.7 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x212121, roughness: 0.9 });

    // ১. মাথা
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 16), skinMat);
    head.position.y = 2.1;
    head.castShadow = true;
    this.playerGroup.add(head);

    // চুল
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), hairMat);
    hair.position.set(0, 2.18, -0.05);
    hair.scale.set(1, 0.95, 1);
    this.playerGroup.add(hair);

    // ২. জামা / বুক
    this.shirtMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.75, 12), this.shirtMatP1);
    this.shirtMesh.position.y = 1.45;
    this.shirtMesh.castShadow = true;
    this.playerGroup.add(this.shirtMesh);

    // ৩. হাফপ্যান্ট
    const pants = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.44, 0.45, 12), pantsMat);
    pants.position.y = 0.98;
    pants.castShadow = true;
    this.playerGroup.add(pants);

    // ৪. বাম পা (ল্যাংচা দিয়ে দাঁড়ানোর পা - সোজা)
    const legStand = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.75, 8), skinMat);
    legStand.position.set(-0.16, 0.42, 0);
    legStand.castShadow = true;
    this.playerGroup.add(legStand);

    const footStand = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.3), skinMat);
    footStand.position.set(-0.16, 0.05, 0.08);
    footStand.castShadow = true;
    this.playerGroup.add(footStand);

    // ৫. ডান পা (হাঁটু মুড়ে পিছনে ভাঁজ করা - এক পায়ে লাফানোর স্টাইল)
    const thighBent = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.11, 0.45, 8), skinMat);
    thighBent.position.set(0.2, 0.62, -0.15);
    thighBent.rotation.x = Math.PI / 3.5; // পিছনে বাঁকা
    thighBent.castShadow = true;
    this.playerGroup.add(thighBent);

    const calfBent = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.45, 8), skinMat);
    calfBent.position.set(0.2, 0.35, -0.32);
    calfBent.rotation.x = -Math.PI / 4;
    calfBent.castShadow = true;
    this.playerGroup.add(calfBent);

    // ৬. দুই হাত (ভারসাম্য রক্ষার জন্য প্রসারিত)
    this.armL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.65, 8), skinMat);
    this.armL.position.set(-0.55, 1.42, 0);
    this.armL.rotation.z = Math.PI / 3.8;
    this.armL.castShadow = true;
    this.playerGroup.add(this.armL);

    this.armR = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.65, 8), skinMat);
    this.armR.position.set(0.55, 1.42, 0);
    this.armR.rotation.z = -Math.PI / 3.8;
    this.armR.castShadow = true;
    this.playerGroup.add(this.armR);

    // স্কেল ও প্রারম্ভিক অবস্থান
    this.playerGroup.scale.set(0.9, 0.9, 0.9);
    this.playerGroup.position.set(-0.7, 0, this.baselineZ);
    this.scene.add(this.playerGroup);

    // লাফের অ্যানিমেশন স্টেট
    this.hopState = {
      isHopping: false,
      progress: 0,
      duration: 0.4,
      start: new THREE.Vector3(),
      target: new THREE.Vector3(),
      targetBox: 0
    };
  }

  // ৩ডি রে-কাস্টার (টাচ ও মাউস অবস্থানকে ৩ডি গ্রাউন্ডে রূপান্তর)
  initRaycaster() {
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.dragTargetPoint = new THREE.Vector3();
    this.isDragging = false;

    // ট্র্যাজেক্টরি আর্কের জন্য ৩ডি লাইন
    const arcGeo = new THREE.BufferGeometry();
    const arcMat = new THREE.LineDashedMaterial({ color: 0xff9800, dashSize: 0.4, gapSize: 0.2, linewidth: 3 });
    this.trajectoryLine = new THREE.Line(arcGeo, arcMat);
    this.trajectoryLine.visible = false;
    this.scene.add(this.trajectoryLine);
  }

  // ইনপুট হ্যান্ডলিং
  initEvents() {
    const dom = this.renderer.domElement;

    const getRayGroundPoint = (clientX, clientY) => {
      const rect = dom.getBoundingClientRect();
      this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersectPoint = new THREE.Vector3();
      this.raycaster.ray.intersectPlane(this.groundPlane, intersectPoint);
      return intersectPoint;
    };

    const onPointerDown = (clientX, clientY) => {
      if (this.state === 'PAUSED' || this.isAI[this.activePlayerIdx]) return;
      window.soundEngine.init();

      const pt = getRayGroundPoint(clientX, clientY);
      if (!pt) return;

      if (this.state === 'THROW_AIM') {
        this.isDragging = true;
        this.dragTargetPoint.copy(pt);
        this.updateThrowAimIndicator();
      } else if (this.state === 'HOPPING' || this.state === 'RETURN_HOP') {
        this.handle3DBoardClick(pt.x, pt.z);
      }
    };

    const onPointerMove = (clientX, clientY) => {
      if (this.isDragging && this.state === 'THROW_AIM') {
        const pt = getRayGroundPoint(clientX, clientY);
        if (pt) {
          this.dragTargetPoint.copy(pt);
          this.updateThrowAimIndicator();
        }
      }
    };

    const onPointerUp = () => {
      if (this.isDragging && this.state === 'THROW_AIM') {
        this.isDragging = false;
        this.trajectoryLine.visible = false;
        this.executeCharaThrow3D(this.dragTargetPoint.x, this.dragTargetPoint.z);
      }
    };

    dom.addEventListener('pointerdown', (e) => onPointerDown(e.clientX, e.clientY));
    window.addEventListener('pointermove', (e) => onPointerMove(e.clientX, e.clientY));
    window.addEventListener('pointerup', onPointerUp);

    window.addEventListener('resize', () => {
      this.width = this.container.clientWidth || window.innerWidth;
      this.height = this.container.clientHeight || window.innerHeight;
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.width, this.height);
    });
  }

  // নিশানা রিয়েল-টাইম আপডেট (৩ডি আর্ক ও কালার কোডেড লক্ষ্য গোলক)
  updateThrowAimIndicator() {
    const start = this.charaGroup.position;
    const end = this.dragTargetPoint;

    // ৩ডি প্যারাবোলিক কার্ভ
    const points = [];
    const count = 25;
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const x = start.x + (end.x - start.x) * t;
      const z = start.z + (end.z - start.z) * t;
      const y = Math.sin(t * Math.PI) * 2.8;
      points.push(new THREE.Vector3(x, y, z));
    }
    this.trajectoryLine.geometry.setFromPoints(points);
    this.trajectoryLine.computeLineDistances();
    this.trajectoryLine.visible = true;

    // টার্গেট রিং অবস্থান ও রঙ
    this.targetRing.position.set(end.x, 0.04, end.z);
    this.targetRing.visible = true;

    const targetBoxNum = this.playerTargets[this.activePlayerIdx];
    const hoveredBox = this.getBoxAt3D(end.x, end.z);
    const lineCol = this.checkLineCollision3D(end.x, end.z, 0.35);

    if (lineCol.touched) {
      this.targetRingMat.color.setHex(0xe53935); // লাল (দাগ)
      this.setSubMessage('সতর্কতা: চাড়া দাগে লাগবে!');
    } else if (hoveredBox === targetBoxNum) {
      this.targetRingMat.color.setHex(0x43a047); // সবুজ (সঠিক ঘর)
      this.setSubMessage('লক্ষ্য ঘরে নিশানা হয়েছে! ছেড়ে দিন।');
    } else if (hoveredBox) {
      this.targetRingMat.color.setHex(0xf57c00);
      this.setSubMessage(`ঘর ${this.boxes[hoveredBox].bn}`);
    } else {
      this.targetRingMat.color.setHex(0xd32f2f);
      this.setSubMessage('কোর্টের বাইরে পড়েছে!');
    }
  }

  // ৩ডি চাড়া নিক্ষেপ সম্পাদন
  executeCharaThrow3D(destX, destZ) {
    this.state = 'THROW_FLIGHT';
    this.targetRing.visible = false;
    window.soundEngine.playThrow();

    this.charaState.isAirborne = true;
    this.charaState.flightProgress = 0;
    this.charaState.start.copy(this.charaGroup.position);
    this.charaState.target.set(destX, 0.06, destZ);

    this.setMessage('চাড়া বাতাসে উড়ছে...');
    this.updateHUD();
  }

  // নিক্ষেপ শেষ হলে ৩ডি কলিশন ও নিয়ম যাচাই
  validateThrowResult3D() {
    this.state = 'VALIDATE_THROW';
    window.soundEngine.playCharaLand();

    const cx = this.charaGroup.position.x;
    const cz = this.charaGroup.position.z;
    const targetBoxNum = this.playerTargets[this.activePlayerIdx];

    // ১. দাগে লেগেছে কিনা যাচাই
    const lineCol = this.checkLineCollision3D(cx, cz, 0.35);
    if (lineCol.touched) {
      this.highlightTouchedLine(lineCol.lineId);
      this.triggerFoul('দাগে চাড়া লেগেছে! (নিয়ম ৩ অনুযায়ী ফাউল)');
      return;
    }

    // ২. কোন ঘরে পড়েছে
    const landedBox = this.getBoxAt3D(cx, cz);
    if (!landedBox) {
      this.triggerFoul('চাড়া কোর্টের বাইরে চলে গেছে!');
      return;
    }

    if (landedBox !== targetBoxNum) {
      this.triggerFoul(`ভুল ঘরে পড়েছে! (পড়েছে ঘর ${this.boxes[landedBox].bn}-এ, লক্ষ্য ছিল ঘর ${this.boxes[targetBoxNum].bn})`);
      return;
    }

    // সঠিক ঘরে পড়েছে!
    this.charaState.boxNum = landedBox;
    window.soundEngine.playSuccess();
    this.state = 'HOPPING';

    const pName = this.playerNames[this.activePlayerIdx];
    this.setMessage('সাবাশ! চাড়া সঠিক ঘরে পড়েছে!', 'এবার এক পায়ে লাফিয়ে চলুন (দাগে পা দেওয়া যাবে না)');
    this.updateHUD();

    if (this.isAI[this.activePlayerIdx]) {
      this.scheduleAIHop3D();
    }
  }

  // গাণিতিক লাইন কলিশন ৩ডি
  checkLineCollision3D(px, pz, radius) {
    let closestDist = Infinity;
    let touchedLine = null;

    for (const line of this.lineSegments) {
      const d = this.distToSegment2D(px, pz, line.p1[0], line.p1[1], line.p2[0], line.p2[1]);
      if (d < closestDist) {
        closestDist = d;
        touchedLine = line;
      }
    }

    return { touched: closestDist <= radius, distance: closestDist, lineId: touchedLine?.id };
  }

  distToSegment2D(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  // কোন ঘরে পড়েছে (পলিগন টেস্ট)
  getBoxAt3D(px, pz) {
    for (let i = 1; i <= 6; i++) {
      if (this.pointInPoly2D(px, pz, this.boxes[i].poly)) {
        return i;
      }
    }
    return null;
  }

  pointInPoly2D(px, py, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1];
      const xj = poly[j][0], yj = poly[j][1];
      const intersect = ((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  highlightTouchedLine(lineId) {
    const mesh = this.lineMeshes[lineId];
    if (mesh) {
      mesh.material.color.setHex(0xe53935);
      setTimeout(() => mesh.material.color.setHex(0xffffff), 2000);
    }
  }

  // ৩ডি কোর্টে ক্লিক বা ট্যাপ করে লাফানো
  handle3DBoardClick(clickX, clickZ) {
    if (this.state !== 'HOPPING' && this.state !== 'RETURN_HOP') return;
    if (this.hopState.isHopping || this.isAI[this.activePlayerIdx]) return;

    // ১. চাড়ায় ট্যাপ করে বাইরে পাঠানো
    const distToChara = Math.hypot(clickX - this.charaGroup.position.x, clickZ - this.charaGroup.position.z);
    if (distToChara < 1.1 && this.isAdjacentToChara() && this.state === 'HOPPING') {
      this.executeCharaKick3D();
      return;
    }

    // ২. পা দাগে লেগেছে কিনা
    const lineCol = this.checkLineCollision3D(clickX, clickZ, 0.22);
    if (lineCol.touched) {
      this.highlightTouchedLine(lineCol.lineId);
      this.triggerFoul('দাগে পা লেগেছে! (নিয়ম ৩ ও ৫ অনুযায়ী ফাউল)');
      return;
    }

    // ৩. কোন ঘরে পা রাখা হয়েছে
    const clickedBox = this.getBoxAt3D(clickX, clickZ);
    const isBaselineClick = clickZ >= this.rect6BotZ + 0.2;

    if (this.state === 'RETURN_HOP' && isBaselineClick) {
      this.hopPlayerTo3D(0, this.baselineZ, 0, () => {
        this.completeRoundSuccess();
      });
      return;
    }

    if (!clickedBox) return;

    // ৪. চাড়ার ঘরে পা দেওয়া নিষেধ
    if (this.state === 'HOPPING' && clickedBox === this.charaState.boxNum) {
      this.triggerFoul('চাড়ার ঘরে পা দেওয়া নিষেধ! চাড়ার ঘর বাদ দিয়ে লাফান।');
      return;
    }

    // ৫. বৈধ ঘরে লাফ
    const validMoves = this.getValidNextMoves();
    if (!validMoves.includes(clickedBox)) {
      this.triggerFoul('ভুল ঘরে ঝাঁপ! নিয়ম অনুযায়ী ধারাবাহিকভাবে লাফ দিন।');
      return;
    }

    const box = this.boxes[clickedBox];
    this.hopPlayerTo3D(clickX, clickZ, clickedBox, () => {
      this.checkHoppingMilestone();
    });
  }

  // খেলোয়াড়ের ৩ডি জাম্প অ্যানিমেশন
  hopPlayerTo3D(destX, destZ, boxNum, onComplete) {
    window.soundEngine.playHop();
    this.hopState.isHopping = true;
    this.hopState.progress = 0;
    this.hopState.start.copy(this.playerGroup.position);
    this.hopState.target.set(destX, 0, destZ);
    this.hopState.targetBox = boxNum;
    this.onHopComplete = onComplete;
  }

  isAdjacentToChara() {
    const cBox = this.charaState.boxNum;
    if (!cBox) return false;
    const currBox = this.playerCurrentBox || 0;
    const adjMap = {
      1: [4, 2], 2: [1, 3], 3: [4, 2], 4: [5, 1, 3], 5: [6, 4], 6: [0, 5]
    };
    return adjMap[cBox]?.includes(currBox) || false;
  }

  getValidNextMoves() {
    const curr = this.playerCurrentBox || 0;
    const cBox = this.charaState.boxNum;

    if (this.state === 'HOPPING') {
      if (curr === 0) return cBox === 6 ? [5] : [6];
      if (curr === 6) return cBox === 5 ? [4] : [5];
      if (curr === 5) return cBox === 4 ? [1, 3] : [4];
      if (curr === 4) {
        const m = [];
        if (cBox !== 1) m.push(1);
        if (cBox !== 3) m.push(3);
        if (cBox !== 2) m.push(2);
        return m;
      }
      if (curr === 1) return cBox !== 2 ? [4, 2] : [4];
      if (curr === 3) return cBox !== 2 ? [4, 2] : [4];
      if (curr === 2) {
        const m = [];
        if (cBox !== 1) m.push(1);
        if (cBox !== 3) m.push(3);
        return m;
      }
    } else if (this.state === 'RETURN_HOP') {
      if (curr === 2) return [1, 3];
      if (curr === 1 || curr === 3) return [4];
      if (curr === 4) return [5];
      if (curr === 5) return [6];
      if (curr === 6) return [0]; // বেসলাইন
    }
    return [];
  }

  checkHoppingMilestone() {
    this.updateHUD();

    if (this.state === 'HOPPING') {
      if (this.isAdjacentToChara()) {
        this.setMessage('আপনি চাড়ার কাছে পৌঁছেছেন!', 'চাড়ায় ট্যাপ করে কোর্টের বাইরে পাঠান!');
        if (this.isAI[this.activePlayerIdx]) {
          setTimeout(() => this.executeCharaKick3D(), 900);
        }
      } else {
        this.setMessage('সুন্দর লাফ!', 'পরবর্তী ঘরে এক পায়ে লাফিয়ে চলুন...');
        if (this.isAI[this.activePlayerIdx]) {
          this.scheduleAIHop3D();
        }
      }
    } else if (this.state === 'RETURN_HOP') {
      if (this.playerCurrentBox === 0) {
        this.completeRoundSuccess();
      } else {
        this.setMessage('ফিরে আসছেন...', 'লাফিয়ে কোর্টের বাইরে বেসলাইনে আসুন');
        if (this.isAI[this.activePlayerIdx]) {
          this.scheduleAIReturnHop3D();
        }
      }
    }
  }

  // চাড়ায় লাথি দেওয়া বা বাইরে পাঠানো ৩ডি
  executeCharaKick3D() {
    window.soundEngine.playCharaKick();
    this.charaState.isSliding = true;
    this.charaState.target.set((Math.random() - 0.5) * 1.5, 0.06, this.baselineZ + 0.5);

    setTimeout(() => {
      this.state = 'RETURN_HOP';
      this.charaState.boxNum = null;
      window.soundEngine.playSuccess();
      this.setMessage('চাড়া বাইরে এসেছে! (নিয়ম ৪ সম্পন্ন)', 'এবার লাফিয়ে নিরাপদে বাইরে চলে আসুন');
      this.updateHUD();

      if (this.isAI[this.activePlayerIdx]) {
        this.scheduleAIReturnHop3D();
      }
    }, 700);
  }

  completeRoundSuccess() {
    this.state = 'ROUND_SUCCESS';
    window.soundEngine.playSuccess();

    this.scores[this.activePlayerIdx] += 1;
    this.playerTargets[this.activePlayerIdx] += 1;

    const pName = this.playerNames[this.activePlayerIdx];
    this.setMessage(`অভিনন্দন! ${pName} এই ঘর জয় করেছেন!`, '+১ পয়েন্ট যোগ হয়েছে!');
    this.updateHUD();

    if (this.playerTargets[this.activePlayerIdx] > 6) {
      setTimeout(() => this.triggerMatchWin(), 1200);
      return;
    }

    setTimeout(() => this.startTurn(), 2200);
  }

  triggerMatchWin() {
    this.state = 'GAME_OVER';
    window.soundEngine.playVictory();

    const winnerName = this.playerNames[this.activePlayerIdx];
    const modal = document.getElementById('winner-modal');
    const title = document.getElementById('winner-title');
    const desc = document.getElementById('winner-desc');

    if (title) title.innerText = `🏆 ${winnerName} চ্যাম্পিয়ন! 🏆`;
    if (desc) desc.innerText = `অভিনন্দন! আপনি এক্কাদোক্কার সব ঘর জয় করে বিজয়ী হয়েছেন!`;
    if (modal) modal.style.display = 'flex';
  }

  triggerFoul(reason) {
    this.state = 'FOUL_PAUSE';
    window.soundEngine.playFoul();

    this.setMessage(`ফাউল! ${reason}`, 'পালা পরিবর্তন হচ্ছে...');
    this.updateHUD();

    setTimeout(() => this.switchTurn(), 2200);
  }

  switchTurn() {
    this.activePlayerIdx = this.activePlayerIdx === 0 ? 1 : 0;
    this.startTurn();
  }

  startTurn() {
    this.state = 'THROW_AIM';
    this.playerCurrentBox = 0;
    const isAiTurn = this.isAI[this.activePlayerIdx];

    // পোশাক আপডেট
    this.shirtMesh.material = isAiTurn ? this.shirtMatAI : this.shirtMatP1;

    // অবস্থান রিসেট
    this.playerGroup.position.set(-0.7, 0, this.baselineZ);
    this.charaGroup.position.set(0.6, 0.06, this.baselineZ);
    this.charaState.boxNum = null;

    const targetBox = this.playerTargets[this.activePlayerIdx];
    const bnTarget = this.boxes[targetBox].bn;
    const pName = this.playerNames[this.activePlayerIdx];

    this.setMessage(`${pName}-এর পালা! লক্ষ্য: ঘর ${bnTarget}`, isAiTurn ? 'কম্পিউটার হিসাব করছে...' : 'চাড়া টেনে লক্ষ্য ঘরে ছুড়ে দিন');
    this.updateHUD();

    if (isAiTurn) {
      this.scheduleAITurn3D();
    }
  }

  startNewGame(mode = 'p_vs_ai') {
    this.mode = mode;
    this.activePlayerIdx = 0;
    this.playerTargets = [1, 1];
    this.scores = [0, 0];

    if (mode === 'p_vs_p') {
      this.playerNames = ['প্লেয়ার ১', 'প্লেয়ার ২'];
      this.isAI = [false, false];
    } else {
      this.playerNames = ['আপনি', 'বল্টু'];
      this.isAI = [false, true];
    }

    this.startTurn();
  }

  // এআই ৩ডি লজিক
  scheduleAITurn3D() {
    setTimeout(() => {
      if (this.state !== 'THROW_AIM') return;
      const tBox = this.boxes[this.playerTargets[this.activePlayerIdx]];
      const isAccurate = Math.random() < 0.85;
      let dx = tBox.center.x + (Math.random() - 0.5) * 0.35;
      let dz = tBox.center.z + (Math.random() - 0.5) * 0.35;

      if (!isAccurate) {
        dx += (Math.random() - 0.5) * 1.5;
        dz += (Math.random() - 0.5) * 1.5;
      }

      this.executeCharaThrow3D(dx, dz);
    }, 1200);
  }

  scheduleAIHop3D() {
    setTimeout(() => {
      if (this.state !== 'HOPPING') return;
      const valid = this.getValidNextMoves();
      if (valid.length === 0) return;
      const nextBoxNum = valid[0];
      const box = this.boxes[nextBoxNum];

      this.hopPlayerTo3D(box.center.x, box.center.z, nextBoxNum, () => {
        this.checkHoppingMilestone();
      });
    }, 850);
  }

  scheduleAIReturnHop3D() {
    setTimeout(() => {
      if (this.state !== 'RETURN_HOP') return;
      const valid = this.getValidNextMoves();
      if (valid.includes(0)) {
        this.hopPlayerTo3D(0, this.baselineZ, 0, () => {
          this.completeRoundSuccess();
        });
      } else if (valid.length > 0) {
        const nextBox = valid[0];
        const box = this.boxes[nextBox];
        this.hopPlayerTo3D(box.center.x, box.center.z, nextBox, () => {
          this.checkHoppingMilestone();
        });
      }
    }, 800);
  }

  setMessage(main, sub = '') {
    const m = document.getElementById('status-msg');
    const s = document.getElementById('status-sub');
    if (m) m.innerText = main;
    if (s) s.innerText = sub;
  }

  setSubMessage(sub) {
    const s = document.getElementById('status-sub');
    if (s) s.innerText = sub;
  }

  updateHUD() {
    const p1Name = document.getElementById('p1-name');
    const p2Name = document.getElementById('p2-name');
    const p1Score = document.getElementById('p1-score');
    const p2Score = document.getElementById('p2-score');
    const turnBadge = document.getElementById('turn-badge');

    if (p1Name) p1Name.innerText = this.playerNames[0];
    if (p2Name) p2Name.innerText = this.playerNames[1];
    if (p1Score) p1Score.innerText = `${this.scores[0]} পঃ (ঘর ${this.boxes[this.playerTargets[0]]?.bn || 'জয়'})`;
    if (p2Score) p2Score.innerText = `${this.scores[1]} পঃ (ঘর ${this.boxes[this.playerTargets[1]]?.bn || 'জয়'})`;

    if (turnBadge) {
      turnBadge.innerText = `${this.playerNames[this.activePlayerIdx]}-এর পালা`;
    }

    const throwBtn = document.getElementById('action-throw-btn');
    const kickBtn = document.getElementById('action-kick-btn');
    const hopBtn = document.getElementById('action-hop-btn');

    const isHuman = !this.isAI[this.activePlayerIdx];
    if (throwBtn) throwBtn.style.display = (this.state === 'THROW_AIM' && isHuman) ? 'inline-flex' : 'none';
    if (kickBtn) kickBtn.style.display = (this.state === 'HOPPING' && this.isAdjacentToChara() && isHuman) ? 'inline-flex' : 'none';
    if (hopBtn) hopBtn.style.display = ((this.state === 'HOPPING' || this.state === 'RETURN_HOP') && isHuman) ? 'inline-flex' : 'none';
  }

  // মূল ৩ডি অ্যানিমেশন লুপ
  animate() {
    requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();

    // ১. চাড়ার ৩ডি ফ্লাইট ফিজিক্স
    if (this.charaState.isAirborne) {
      this.charaState.flightProgress += dt / this.charaState.flightDuration;
      const t = Math.min(1, this.charaState.flightProgress);

      this.charaGroup.position.lerpVectors(this.charaState.start, this.charaState.target, t);
      this.charaGroup.position.y = 0.06 + Math.sin(t * Math.PI) * 2.8;

      // বাতাসে ঘূর্ণন
      this.charaMesh.rotation.z += dt * 8;
      this.charaMesh.rotation.y += dt * 4;

      if (t >= 1) {
        this.charaState.isAirborne = false;
        this.charaGroup.position.copy(this.charaState.target);
        this.validateThrowResult3D();
      }
    } else if (this.charaState.isSliding) {
      this.charaGroup.position.lerp(this.charaState.target, dt * 5);
      if (this.charaGroup.position.distanceTo(this.charaState.target) < 0.1) {
        this.charaState.isSliding = false;
      }
    }

    // ২. খেলোয়াড়ের ৩ডি লাফ অ্যানিমেশন
    if (this.hopState.isHopping) {
      this.hopState.progress += dt / this.hopState.duration;
      const t = Math.min(1, this.hopState.progress);

      this.playerGroup.position.lerpVectors(this.hopState.start, this.hopState.target, t);
      this.playerGroup.position.y = Math.sin(t * Math.PI) * 1.4; // লাফ উচ্চতা

      // হাত ও দেহের ভারসাম্য দুলুনি
      this.armL.rotation.z = Math.PI / 3.8 + Math.sin(t * Math.PI * 2) * 0.25;
      this.armR.rotation.z = -Math.PI / 3.8 - Math.sin(t * Math.PI * 2) * 0.25;

      if (t >= 1) {
        this.hopState.isHopping = false;
        this.playerGroup.position.copy(this.hopState.target);
        this.playerCurrentBox = this.hopState.targetBox;
        if (this.onHopComplete) {
          const cb = this.onHopComplete;
          this.onHopComplete = null;
          cb();
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.Ekkadokka3D = Ekkadokka3D;
