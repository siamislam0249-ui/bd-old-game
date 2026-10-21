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

    // চরিত্র ও অনলাইন মাল্টিপ্লেয়ার স্টেট
    this.playerGenders = ['male', 'female']; // P1 & P2 জেন্ডার ('male' বা 'female')
    this.onlineRole = null; // null, 'host', 'guest'
    this.myPlayerIdx = 0;
    this.onOnlineAction = null;
    this.lastAimSent = 0;

    // রোলিং চালের সীমা ও ৫০ পয়েন্ট টার্গেট
    this.maxStreak = 5;      // একটানা সর্বোচ্চ ৫টি সফল চাল
    this.currentStreak = 0;  // বর্তমান একটানা সফল চাল সংখ্যা
    this.targetScore = 50;   // ৫০ পয়েন্টে ম্যাচ জয়

    // স্টেটসমূহ: 'MENU', 'THROW_AIM', 'THROW_FLIGHT', 'VALIDATE_THROW',
    // 'HOPPING', 'KICK_CHARA', 'RETURN_HOP', 'FOUL_PAUSE', 'ROUND_SUCCESS', 'GAME_OVER'
    this.state = 'MENU';
    this.cameraMode = 'iso'; // 'iso' or 'top'
    this.foulTimeout = null;

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
    const aspect = this.width / this.height;
    const isMobilePortrait = aspect < 0.85;

    if (mode === 'iso') {
      if (isMobilePortrait) {
        // মোবাইল স্ক্রিনে পুরো কোর্ট ও ক্যারেক্টার সুন্দরভাবে দেখানোর জন্য
        this.camera.fov = 54;
        this.camera.position.set(0, 18.5, 14.5);
        this.camera.lookAt(0, 0, 0.3);
      } else {
        this.camera.fov = 46;
        this.camera.position.set(0, 16.5, 12.8);
        this.camera.lookAt(0, 0, -0.4);
      }
    } else {
      // টপ-ডাউন ভিউ
      if (isMobilePortrait) {
        this.camera.fov = 56;
        this.camera.position.set(0, 22.0, 0.5);
      } else {
        this.camera.fov = 46;
        this.camera.position.set(0, 19.5, 0.01);
      }
      this.camera.lookAt(0, 0, 0);
    }
    this.camera.updateProjectionMatrix();
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

  // ৩ডি চরিত্র ইনিট (ছেলে ও মেয়ে উভয় মডেল সমর্থন করে)
  init3DCharacter() {
    this.playerGroup = new THREE.Group();
    this.charVisualGroup = new THREE.Group();
    this.playerGroup.add(this.charVisualGroup);

    // প্রাথমিক চরিত্র বিল্ড
    this.buildCharacterVisuals(this.playerGenders[this.activePlayerIdx] || 'male', this.activePlayerIdx);

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

  // ৩ডি ছেলে ও মেয়ে চরিত্র নির্মাণ
  buildCharacterVisuals(gender, playerIdx) {
    while (this.charVisualGroup.children.length > 0) {
      const child = this.charVisualGroup.children[0];
      this.charVisualGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
    }

    const isP1 = (playerIdx === 0);
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xdf9a68, roughness: 0.8 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x1f1f1f, roughness: 0.9 });
    const ribbonMat = new THREE.MeshStandardMaterial({ color: 0xff1744, roughness: 0.5 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffb300, metalness: 0.3, roughness: 0.4 });

    const primaryColor = isP1 ? 0x1976d2 : 0xe65100;
    const femaleColor = isP1 ? 0xe91e63 : 0x8e24aa;

    // ১. মাথা
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 16), skinMat);
    head.position.y = 2.1;
    head.castShadow = true;
    this.charVisualGroup.add(head);

    if (gender === 'female') {
      // --- ঐতিহ্যবাহী গ্রামীণ মেয়ে মডেল (বেণী, কপালে লাল টিপ, রঙিন ফ্রক ও কাঁচের চুড়ি) ---
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), hairMat);
      hair.position.set(0, 2.18, -0.05);
      hair.scale.set(1.02, 0.98, 1.05);
      this.charVisualGroup.add(hair);

      // কপালে সুন্দর লাল টিপ
      const bindi = new THREE.Mesh(
        new THREE.CircleGeometry(0.045, 16),
        new THREE.MeshBasicMaterial({ color: 0xd50000, side: THREE.DoubleSide })
      );
      bindi.position.set(0, 2.15, 0.365);
      this.charVisualGroup.add(bindi);

      // দুই পাশে ফিতা বাঁধা সুদৃশ্য বেণী
      [-0.34, 0.34].forEach(xOffset => {
        const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.03, 8, 16), ribbonMat);
        ribbon.rotation.x = Math.PI / 2;
        ribbon.position.set(xOffset, 2.05, 0.02);
        this.charVisualGroup.add(ribbon);

        for (let b = 0; b < 3; b++) {
          const bBall = new THREE.Mesh(new THREE.SphereGeometry(0.08 - b * 0.012, 12, 12), hairMat);
          bBall.position.set(xOffset * 1.05, 1.95 - b * 0.12, 0.02 - b * 0.02);
          bBall.castShadow = true;
          this.charVisualGroup.add(bBall);
        }
      });

      // ফ্রকের উপরিভাগ (Bodice)
      const bodiceMat = new THREE.MeshStandardMaterial({ color: femaleColor, roughness: 0.6 });
      this.shirtMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.62, 16), bodiceMat);
      this.shirtMesh.position.y = 1.5;
      this.shirtMesh.castShadow = true;
      this.charVisualGroup.add(this.shirtMesh);

      // চমৎকার ঘেরওয়ালা ফ্রক (Flared Frock)
      const frockMat = new THREE.MeshStandardMaterial({ color: femaleColor, roughness: 0.6 });
      const frock = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.66, 0.72, 16), frockMat);
      frock.position.y = 0.95;
      frock.castShadow = true;
      this.charVisualGroup.add(frock);

      // ফ্রকের নিচের সোনালী লেস/পাড়
      const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.655, 0.67, 0.08, 16), goldMat);
      hem.position.y = 0.61;
      this.charVisualGroup.add(hem);

      // হাতে কাঁচের রেশমি চুড়ি
      [-0.55, 0.55].forEach(xPos => {
        const bangle = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.025, 8, 16), goldMat);
        bangle.rotation.x = Math.PI / 2;
        bangle.position.set(xPos, 1.3, 0);
        this.charVisualGroup.add(bangle);
      });

    } else {
      // --- ঐতিহ্যবাহী গ্রামীণ ছেলে মডেল (টি-শার্ট ও হাফপ্যান্ট) ---
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), hairMat);
      hair.position.set(0, 2.18, -0.05);
      hair.scale.set(1, 0.95, 1);
      this.charVisualGroup.add(hair);

      const shirtMat = new THREE.MeshStandardMaterial({ color: primaryColor, roughness: 0.6 });
      this.shirtMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.75, 12), shirtMat);
      this.shirtMesh.position.y = 1.45;
      this.shirtMesh.castShadow = true;
      this.charVisualGroup.add(this.shirtMesh);

      const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1a237e, roughness: 0.7 });
      const pants = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.44, 0.45, 12), pantsMat);
      pants.position.y = 0.98;
      pants.castShadow = true;
      this.charVisualGroup.add(pants);
    }

    // ৪. বাম পা (ল্যাংচা দিয়ে দাঁড়ানোর পা - সোজা)
    const legStand = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.75, 8), skinMat);
    legStand.position.set(-0.16, 0.42, 0);
    legStand.castShadow = true;
    this.charVisualGroup.add(legStand);

    const footStand = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.3), skinMat);
    footStand.position.set(-0.16, 0.05, 0.08);
    footStand.castShadow = true;
    this.charVisualGroup.add(footStand);

    // ৫. ডান পা (হাঁটু মুড়ে পিছনে ভাঁজ করা - এক পায়ে লাফানোর স্টাইল)
    const thighBent = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.11, 0.45, 8), skinMat);
    thighBent.position.set(0.2, 0.62, -0.15);
    thighBent.rotation.x = Math.PI / 3.5;
    thighBent.castShadow = true;
    this.charVisualGroup.add(thighBent);

    const calfBent = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.45, 8), skinMat);
    calfBent.position.set(0.2, 0.35, -0.32);
    calfBent.rotation.x = -Math.PI / 4;
    calfBent.castShadow = true;
    this.charVisualGroup.add(calfBent);

    // ৬. দুই হাত (ভারসাম্য রক্ষার জন্য প্রসারিত)
    this.armL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.65, 8), skinMat);
    this.armL.position.set(-0.55, 1.42, 0);
    this.armL.rotation.z = Math.PI / 3.8;
    this.armL.castShadow = true;
    this.charVisualGroup.add(this.armL);

    this.armR = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.65, 8), skinMat);
    this.armR.position.set(0.55, 1.42, 0);
    this.armR.rotation.z = -Math.PI / 3.8;
    this.armR.castShadow = true;
    this.charVisualGroup.add(this.armR);
  }

  // চরিত্র জেন্ডার পরিবর্তন
  setPlayerGender(playerIdx, gender) {
    this.playerGenders[playerIdx] = gender;
    if (this.activePlayerIdx === playerIdx) {
      this.buildCharacterVisuals(gender, playerIdx);
    }
    this.updateCharacterUI();
  }

  toggleActivePlayerGender() {
    const curr = this.playerGenders[this.activePlayerIdx] || 'male';
    const next = curr === 'male' ? 'female' : 'male';
    this.setPlayerGender(this.activePlayerIdx, next);
    if (this.mode === 'online' && this.onOnlineAction) {
      this.onOnlineAction({ type: 'CHAR_CHANGE', playerIdx: this.myPlayerIdx, gender: next });
    }
    return next;
  }

  updateCharacterUI() {
    const curr = this.playerGenders[this.activePlayerIdx] || 'male';
    const btn = document.getElementById('btn-character');
    if (btn) {
      btn.innerText = curr === 'female' ? '👧' : '👦';
      btn.title = `বর্তমান চরিত্র: ${curr === 'female' ? 'মেয়ে' : 'ছেলে'} (ক্লিক করে পরিবর্তন করুন)`;
    }
  }

  isMyTurn() {
    if (this.mode !== 'online') return true;
    return this.activePlayerIdx === this.myPlayerIdx;
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
    dom.style.touchAction = 'none';

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
      if (this.state === 'PAUSED' || this.state === 'FOUL_PAUSE' || this.isAI[this.activePlayerIdx]) return;
      if (this.mode === 'online' && !this.isMyTurn()) return;
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
      if (this.mode === 'online' && !this.isMyTurn()) return;
      if (this.isDragging && this.state === 'THROW_AIM') {
        const pt = getRayGroundPoint(clientX, clientY);
        if (pt) {
          this.dragTargetPoint.copy(pt);
          this.updateThrowAimIndicator();

          if (this.mode === 'online' && this.onOnlineAction && (!this.lastAimSent || Date.now() - this.lastAimSent > 60)) {
            this.lastAimSent = Date.now();
            this.onOnlineAction({ type: 'AIM', x: pt.x, z: pt.z });
          }
        }
      }
    };

    const onPointerUp = () => {
      if (this.mode === 'online' && !this.isMyTurn()) {
        this.isDragging = false;
        if (this.trajectoryLine) this.trajectoryLine.visible = false;
        if (this.targetRing) this.targetRing.visible = false;
        return;
      }
      if (this.isDragging && this.state === 'THROW_AIM') {
        this.isDragging = false;
        if (this.trajectoryLine) this.trajectoryLine.visible = false;
        if (this.targetRing) this.targetRing.visible = false;
        this.executeCharaThrow3D(this.dragTargetPoint.x, this.dragTargetPoint.z);
      } else {
        this.isDragging = false;
        if (this.trajectoryLine) this.trajectoryLine.visible = false;
        if (this.targetRing) this.targetRing.visible = false;
      }
    };

    const onPointerCancel = () => {
      this.isDragging = false;
      if (this.trajectoryLine) this.trajectoryLine.visible = false;
      if (this.targetRing) this.targetRing.visible = false;
    };

    dom.addEventListener('pointerdown', (e) => onPointerDown(e.clientX, e.clientY));
    window.addEventListener('pointermove', (e) => onPointerMove(e.clientX, e.clientY));
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);

    window.addEventListener('resize', () => {
      this.width = this.container.clientWidth || window.innerWidth;
      this.height = this.container.clientHeight || window.innerHeight;
      this.camera.aspect = this.width / this.height;
      this.setCameraPosition(this.cameraMode);
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
  executeCharaThrow3D(destX, destZ, isRemote = false) {
    if (this.state !== 'THROW_AIM' && !isRemote) return;
    if (this.mode === 'online' && !isRemote && !this.isMyTurn()) return;

    if (this.mode === 'online' && !isRemote && this.isMyTurn() && this.onOnlineAction) {
      this.onOnlineAction({ type: 'THROW', x: destX, z: destZ });
    }
    this.state = 'THROW_FLIGHT';
    this.isDragging = false;
    if (this.targetRing) this.targetRing.visible = false;
    if (this.trajectoryLine) this.trajectoryLine.visible = false;
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
    // অনলাইন মোডে শুধুমাত্র সক্রিয় নিক্ষেপকারী খেলোয়াড় সিদ্ধান্ত নিবে
    if (this.mode === 'online' && !this.isMyTurn()) {
      return;
    }

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

    if (this.mode === 'online' && this.isMyTurn() && this.onOnlineAction) {
      this.onOnlineAction({
        type: 'THROW_LANDED',
        boxNum: landedBox,
        x: cx,
        z: cz
      });
    }

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
    if (this.mode === 'online' && !this.isMyTurn()) return;

    // ১. চাড়ায় ট্যাপ করে বাইরে পাঠানো
    const distToChara = Math.hypot(clickX - this.charaGroup.position.x, clickZ - this.charaGroup.position.z);
    if (distToChara < 1.1 && this.isAdjacentToChara() && this.state === 'HOPPING') {
      this.executeCharaKick3D();
      return;
    }

    // ২. রিটার্ন হপে বেসলাইনে ফেরা (দাগের চেকের আগেই পরীক্ষা করা যেন ফলস ফাউল না হয়)
    const isBaselineClick = clickZ >= (this.rect6BotZ - 0.1);
    if (this.state === 'RETURN_HOP' && isBaselineClick) {
      this.hopPlayerTo3D(0, this.baselineZ, 0, () => {
        this.completeRoundSuccess();
      });
      return;
    }

    // ৩. পা দাগে লেগেছে কিনা
    const lineCol = this.checkLineCollision3D(clickX, clickZ, 0.22);
    if (lineCol.touched) {
      this.highlightTouchedLine(lineCol.lineId);
      this.triggerFoul('দাগে পা লেগেছে! (নিয়ম ৩ ও ৫ অনুযায়ী ফাউল)');
      return;
    }

    // ৪. কোন ঘরে পা রাখা হয়েছে
    const clickedBox = this.getBoxAt3D(clickX, clickZ);
    if (!clickedBox) return;

    // ৫. চাড়ার ঘরে পা দেওয়া নিষেধ
    if (this.state === 'HOPPING' && clickedBox === this.charaState.boxNum) {
      this.triggerFoul('চাড়ার ঘরে পা দেওয়া নিষেধ! চাড়ার ঘর বাদ দিয়ে লাফান।');
      return;
    }

    // ৬. বৈধ ঘরে লাফ
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
  hopPlayerTo3D(destX, destZ, boxNum, onComplete, isRemote = false) {
    if (this.mode === 'online' && !isRemote && this.isMyTurn() && this.onOnlineAction) {
      this.onOnlineAction({ type: 'HOP', x: destX, z: destZ, box: boxNum });
    }
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
      1: [4, 2], 2: [1, 3], 3: [4, 2], 4: [5, 1, 3], 5: [6, 4], 6: [5]
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
      if (curr === 5) return [6, 0];
      if (curr === 6) return [0]; // বেসলাইন
      if (curr === 0) return [0];
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
  executeCharaKick3D(targetX = null, targetZ = null, isRemote = false) {
    if (this.charaState.isSliding) return;

    const kickX = (typeof targetX === 'number') ? targetX : (Math.random() - 0.5) * 1.5;
    const kickZ = (typeof targetZ === 'number') ? targetZ : (this.baselineZ + 0.5);

    if (this.mode === 'online' && !isRemote && this.isMyTurn() && this.onOnlineAction) {
      this.onOnlineAction({ type: 'KICK', targetX: kickX, targetZ: kickZ });
    }
    window.soundEngine.playCharaKick();
    this.charaState.isSliding = true;
    this.charaState.target.set(kickX, 0.06, kickZ);

    setTimeout(() => {
      this.state = 'RETURN_HOP';
      this.charaState.isSliding = false;
      this.charaState.boxNum = null;
      window.soundEngine.playSuccess();
      this.setMessage('চাড়া বাইরে এসেছে! (নিয়ম ৪ সম্পন্ন)', 'এবার লাফিয়ে নিরাপদে বাইরে চলে আসুন');
      this.updateHUD();

      if (this.isAI[this.activePlayerIdx]) {
        this.scheduleAIReturnHop3D();
      }
    }, 700);
  }

  completeRoundSuccess(isRemote = false) {
    if (this.mode === 'online' && !isRemote && !this.isMyTurn()) return;

    this.state = 'ROUND_SUCCESS';
    window.soundEngine.playSuccess();

    this.scores[this.activePlayerIdx] += 10;
    this.currentStreak += 1;

    // ঘর সাইকেলিং (১-৬ ঘুরে আবার ১)
    if (this.playerTargets[this.activePlayerIdx] >= 6) {
      this.playerTargets[this.activePlayerIdx] = 1;
    } else {
      this.playerTargets[this.activePlayerIdx] += 1;
    }

    const pName = this.playerNames[this.activePlayerIdx];
    this.setMessage(`দারুণ! ${pName} সফল চাল সম্পন্ন করেছেন (+১০ পঃ)`, `চাল: ${this.currentStreak}/${this.maxStreak} • স্কোর: ${this.scores[this.activePlayerIdx]}/${this.targetScore}`);
    this.updateHUD();

    if (this.mode === 'online' && !isRemote && this.isMyTurn() && this.onOnlineAction) {
      this.onOnlineAction({
        type: 'ROUND_WIN',
        scores: this.scores,
        targets: this.playerTargets,
        streak: this.currentStreak
      });
    }

    // ১. ৫০ পয়েন্ট পূর্ণ হলে বিজয়ী
    if (this.scores[this.activePlayerIdx] >= this.targetScore) {
      setTimeout(() => this.triggerMatchWin(false), 1200);
      return;
    }

    // ২. একটানা সর্বোচ্চ ৫টি চাল পূর্ণ হলে নিয়ম অনুযায়ী পালা পরিবর্তন
    if (this.currentStreak >= this.maxStreak) {
      setTimeout(() => {
        this.setMessage(`চমৎকার! একটানা ৫টি চাল পূর্ণ হয়েছে!`, 'রোলিং নিয়ম অনুযায়ী এবার প্রতিপক্ষের পালা...');
        setTimeout(() => {
          if (this.mode === 'online') {
            this.switchTurnOnline();
          } else {
            this.switchTurn();
          }
        }, 2000);
      }, 1200);
      return;
    }

    // চাল বাকি থাকলে পরবর্তী চাল শুরু
    if (this.mode === 'online') {
      setTimeout(() => {
        this.startTurn();
        if (this.onOnlineAction) {
          this.onOnlineAction({
            type: 'START_NEXT_ROUND',
            activeIdx: this.activePlayerIdx,
            streak: this.currentStreak,
            scores: this.scores,
            targets: this.playerTargets
          });
        }
      }, 2200);
    } else {
      setTimeout(() => this.startTurn(), 2200);
    }
  }

  triggerMatchWin(isRemote = false) {
    this.state = 'GAME_OVER';
    window.soundEngine.playVictory();

    const winnerName = this.playerNames[this.activePlayerIdx];
    const modal = document.getElementById('winner-modal');
    const title = document.getElementById('winner-title');
    const desc = document.getElementById('winner-desc');

    if (title) title.innerText = `🏆 ${winnerName} ৫০ পয়েন্টে চ্যাম্পিয়ন! 🏆`;
    if (desc) {
      if (this.mode === 'online') {
        if (this.activePlayerIdx === this.myPlayerIdx) {
          desc.innerText = `অভিনন্দন! আপনি ৫০ পয়েন্ট লক্ষ্য অর্জন করে ম্যাচ জয় করেছেন! 🥇`;
        } else {
          desc.innerText = `খেলা শেষ! আপনার বন্ধু ${winnerName} ৫০ পয়েন্ট পেয়ে জয়ী হয়েছেন! ভালো খেলেছেন!`;
        }
      } else {
        desc.innerText = `অভিনন্দন! ${winnerName} ৫০ পয়েন্ট লক্ষ্য অর্জন করে এক্কাদোক্কার ম্যাচ জয় করেছেন!`;
      }
    }
    if (modal) modal.style.display = 'flex';

    if (this.mode === 'online' && !isRemote && this.isMyTurn() && this.onOnlineAction) {
      this.onOnlineAction({ type: 'MATCH_WIN', winnerIdx: this.activePlayerIdx });
    }
  }

  triggerFoul(reason, isRemote = false) {
    // অনলাইন মোডে শুধুমাত্র সক্রিয় খেলোয়াড় লোকাল ফাউল শুরু করতে পারে
    if (this.mode === 'online' && !isRemote && !this.isMyTurn()) {
      return;
    }

    if (this.mode === 'online' && !isRemote && this.isMyTurn() && this.onOnlineAction) {
      this.onOnlineAction({ type: 'FOUL', reason: reason });
    }

    this.state = 'FOUL_PAUSE';
    this.currentStreak = 0; // ফাউল হলে স্ট্রিক ০ হয়
    this.isDragging = false;
    if (this.targetRing) this.targetRing.visible = false;
    if (this.trajectoryLine) this.trajectoryLine.visible = false;
    window.soundEngine.playFoul();

    this.setMessage(`ফাউল! ${reason}`, 'পালা পরিবর্তন হচ্ছে...');
    this.updateHUD();

    if (this.foulTimeout) {
      clearTimeout(this.foulTimeout);
      this.foulTimeout = null;
    }

    if (this.mode === 'online') {
      if (this.isMyTurn()) {
        // ফাউলকারী খেলোয়াড় নির্ধারিত বিরতির পর পালা পরিবর্তন করবে ও রিমোটকে জানাবে
        this.foulTimeout = setTimeout(() => {
          this.switchTurnOnline();
        }, 2200);
      } else {
        // রিমোট খেলোয়াড় ফাউল মেসেজ পেলে সক্রিয় খেলোয়াড়ের TURN_SWITCH বার্তার জন্য অপেক্ষা করবে
        // প্যাকেট ড্রপ হলে সেফটি ফলব্যাক টাইমার (৩৮০০মি.সে.)
        this.foulTimeout = setTimeout(() => {
          if (this.state === 'FOUL_PAUSE') {
            this.activePlayerIdx = this.myPlayerIdx;
            this.currentStreak = 0;
            this.startTurn();
          }
        }, 3800);
      }
    } else {
      // অফলাইন লোকাল মোড (বনাম বল্টু বা পাশাপাশি ২ জন)
      this.foulTimeout = setTimeout(() => this.switchTurn(), 2200);
    }
  }

  // অফলাইন / লোকাল মোডে পালা পরিবর্তন
  switchTurn() {
    this.activePlayerIdx = this.activePlayerIdx === 0 ? 1 : 0;
    this.currentStreak = 0;
    this.startTurn();
  }

  // অনলাইন মোডে একমাত্র সক্রিয় পক্ষ পালা পরিবর্তন করে ব্রডকাস্ট করবে
  switchTurnOnline() {
    const nextIdx = this.activePlayerIdx === 0 ? 1 : 0;
    this.activePlayerIdx = nextIdx;
    this.currentStreak = 0;

    if (this.onOnlineAction) {
      this.onOnlineAction({
        type: 'TURN_SWITCH',
        activeIdx: nextIdx,
        scores: this.scores,
        targets: this.playerTargets,
        streak: 0
      });
    }

    this.startTurn();
  }

  startTurn() {
    if (this.foulTimeout) {
      clearTimeout(this.foulTimeout);
      this.foulTimeout = null;
    }

    this.state = 'THROW_AIM';
    this.playerCurrentBox = 0;
    this.isDragging = false;
    this.charaState.isAirborne = false;
    this.charaState.isSliding = false;
    this.charaState.flightProgress = 0;
    this.hopState.isHopping = false;
    this.hopState.progress = 0;
    this.onHopComplete = null;
    if (this.targetRing) this.targetRing.visible = false;
    if (this.trajectoryLine) this.trajectoryLine.visible = false;

    const isAiTurn = this.isAI[this.activePlayerIdx];

    // পোশাক ও জেন্ডার মডেল আপডেট
    const currentGender = this.playerGenders[this.activePlayerIdx] || 'male';
    this.buildCharacterVisuals(currentGender, this.activePlayerIdx);
    this.updateCharacterUI();

    // অবস্থান রিসেট
    this.playerGroup.position.set(-0.7, 0, this.baselineZ);
    this.charaGroup.position.set(0.6, 0.06, this.baselineZ);
    this.charaState.boxNum = null;

    const targetBox = this.playerTargets[this.activePlayerIdx];
    const bnTarget = this.boxes[targetBox]?.bn || '১';
    const pName = this.playerNames[this.activePlayerIdx];
    const streakInfo = `চাল: ${this.currentStreak + 1}/${this.maxStreak}`;

    if (this.mode === 'online') {
      if (this.isMyTurn()) {
        this.setMessage(`আপনার পালা (${streakInfo})! লক্ষ্য: ঘর ${bnTarget}`, 'চাড়া টেনে লক্ষ্য ঘরে ছুড়ে দিন বা বাটন চাপুন');
      } else {
        this.setMessage(`বন্ধুর পালা (${streakInfo})! লক্ষ্য: ঘর ${bnTarget}`, 'বন্ধুর নিক্ষেপ দেখার অপেক্ষায়...');
      }
    } else {
      this.setMessage(`${pName}-এর পালা (${streakInfo})! লক্ষ্য: ঘর ${bnTarget}`, isAiTurn ? 'কম্পিউটার হিসাব করছে...' : 'চাড়া টেনে লক্ষ্য ঘরে ছুড়ে দিন বা বাটন চাপুন');
    }
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
    this.currentStreak = 0;

    if (mode === 'p_vs_p') {
      this.playerNames = ['প্লেয়ার ১', 'প্লেয়ার ২'];
      this.isAI = [false, false];
    } else if (mode === 'online') {
      this.isAI = [false, false];
    } else {
      this.playerNames = ['আপনি', 'বল্টু'];
      this.isAI = [false, true];
    }

    this.startTurn();
  }

  // খেলা সম্পূর্ণ রিসেট করে মেনু/বেসলাইনে ফেরত নেওয়া
  resetGame() {
    if (this.foulTimeout) {
      clearTimeout(this.foulTimeout);
      this.foulTimeout = null;
    }
    this.state = 'MENU';
    this.playerCurrentBox = 0;
    this.isDragging = false;
    this.charaState.isAirborne = false;
    this.charaState.isSliding = false;
    this.charaState.flightProgress = 0;
    this.hopState.isHopping = false;
    this.hopState.progress = 0;
    this.onHopComplete = null;
    if (this.targetRing) this.targetRing.visible = false;
    if (this.trajectoryLine) this.trajectoryLine.visible = false;

    // অবস্থান বেসলাইনে রিসেট
    this.playerGroup.position.set(-0.7, 0, this.baselineZ);
    this.charaGroup.position.set(0.6, 0.06, this.baselineZ);
    this.charaState.boxNum = null;

    this.setMessage('খেলা শুরু করতে মোড নির্বাচন করুন', 'এক্কাদোক্কা ৩ডি-তে আপনাকে স্বাগতম!');
    this.updateHUD();
  }

  // রিমোট অনলাইন অ্যাকশন হ্যান্ডলিং
  handleRemoteOnlineAction(action) {
    if (!action || !action.type) return;

    switch (action.type) {
      case 'AIM':
        this.dragTargetPoint.set(action.x, 0, action.z);
        this.updateThrowAimIndicator();
        break;

      case 'THROW':
        if (this.targetRing) this.targetRing.visible = false;
        if (this.trajectoryLine) this.trajectoryLine.visible = false;
        this.executeCharaThrow3D(action.x, action.z, true);
        break;

      case 'THROW_LANDED':
        this.charaState.isAirborne = false;
        this.charaState.boxNum = action.boxNum;
        if (typeof action.x === 'number' && typeof action.z === 'number') {
          this.charaGroup.position.set(action.x, 0.06, action.z);
        }
        window.soundEngine.playSuccess();
        this.state = 'HOPPING';
        this.setMessage('বন্ধুর চাড়া সঠিক ঘরে পড়েছে!', 'বন্ধুর লাফ দেখার অপেক্ষায়...');
        this.updateHUD();
        break;

      case 'HOP':
        this.hopPlayerTo3D(action.x, action.z, action.box, () => {
          this.checkHoppingMilestone();
        }, true);
        break;

      case 'KICK':
        this.executeCharaKick3D(action.targetX, action.targetZ, true);
        break;

      case 'FOUL':
        this.triggerFoul(action.reason, true);
        break;

      case 'TURN_SWITCH':
        if (this.foulTimeout) {
          clearTimeout(this.foulTimeout);
          this.foulTimeout = null;
        }
        this.activePlayerIdx = action.activeIdx;
        this.currentStreak = action.streak || 0;
        if (action.scores) this.scores = action.scores;
        if (action.targets) this.playerTargets = action.targets;
        this.startTurn();
        break;

      case 'START_NEXT_ROUND':
        if (this.foulTimeout) {
          clearTimeout(this.foulTimeout);
          this.foulTimeout = null;
        }
        if (action.scores) this.scores = action.scores;
        if (action.targets) this.playerTargets = action.targets;
        this.currentStreak = action.streak || 0;
        this.activePlayerIdx = action.activeIdx;
        this.startTurn();
        break;

      case 'ROUND_WIN':
        if (action.scores) this.scores = action.scores;
        if (action.targets) this.playerTargets = action.targets;
        this.currentStreak = action.streak || 0;
        window.soundEngine.playRoundWin();
        this.updateHUD();
        break;

      case 'MATCH_WIN':
        this.triggerMatchWin(true);
        break;

      case 'CHAR_CHANGE':
        if (typeof action.playerIdx === 'number' && action.gender) {
          this.setPlayerGender(action.playerIdx, action.gender);
        }
        break;
    }
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
    if (p1Score) p1Score.innerText = `${this.scores[0]}/${this.targetScore} পঃ (ঘর ${this.boxes[this.playerTargets[0]]?.bn || '১'})`;
    if (p2Score) p2Score.innerText = `${this.scores[1]}/${this.targetScore} পঃ (ঘর ${this.boxes[this.playerTargets[1]]?.bn || '১'})`;

    // সক্রিয় খেলোয়াড়ের কার্ড হাইলাইট
    const p1Card = document.getElementById('p1-card');
    const p2Card = document.getElementById('p2-card');
    if (p1Card) p1Card.classList.toggle('active', this.activePlayerIdx === 0);
    if (p2Card) p2Card.classList.toggle('active', this.activePlayerIdx === 1);

    if (turnBadge) {
      const activeStreak = `চাল ${Math.min(this.maxStreak, this.currentStreak + 1)}/৫`;
      if (this.mode === 'online') {
        const who = this.isMyTurn() ? 'আপনার পালা' : 'বন্ধুর পালা';
        turnBadge.innerText = `🟢 ${who} (${activeStreak})`;
      } else {
        turnBadge.innerText = `${this.playerNames[this.activePlayerIdx]}-এর পালা (${activeStreak})`;
      }
    }

    const throwBtn = document.getElementById('action-throw-btn');
    const kickBtn = document.getElementById('action-kick-btn');
    const hopBtn = document.getElementById('action-hop-btn');

    const isHuman = !this.isAI[this.activePlayerIdx] && (this.mode !== 'online' || this.isMyTurn());
    if (throwBtn) throwBtn.style.display = (this.state === 'THROW_AIM' && isHuman) ? 'inline-flex' : 'none';
    if (kickBtn) kickBtn.style.display = (this.state === 'HOPPING' && this.isAdjacentToChara() && isHuman) ? 'inline-flex' : 'none';
    if (hopBtn) {
      const showHop = (this.state === 'HOPPING' || this.state === 'RETURN_HOP') && isHuman;
      hopBtn.style.display = showHop ? 'inline-flex' : 'none';
      if (showHop) {
        if (this.state === 'RETURN_HOP') {
          const valid = this.getValidNextMoves();
          if (valid.includes(0)) {
            hopBtn.innerHTML = '<span>🦵</span> কোর্টের বাইরে লাফাও';
          } else {
            hopBtn.innerHTML = '<span>🦵</span> পিছনের ঘরে লাফাও';
          }
        } else {
          hopBtn.innerHTML = '<span>🦵</span> সামনের ঘরে লাফাও';
        }
      }
    }
  }

  // মূল ৩ডি অ্যানিমেশন লুপ
  animate() {
    requestAnimationFrame(this.animate);
    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.1);

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
