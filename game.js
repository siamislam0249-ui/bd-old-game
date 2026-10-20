/**
 * এক্কাদোক্কা (কুতকুত) - মূল গেম লজিক ও স্টেট মেশিন
 * - একক খেলোয়াড় (বনাম কম্পিউটার AI) ও দুই খেলোয়াড় মোড
 * - সম্পূর্ণ বাংলা ইন্টারফেস ও ধারাভাষ্য
 * - ফাউল ডিটেকশন (দাগে পা, ভুল ঘর, দাগে চাড়া)
 * - টার্ন সুইচিং ও স্কোরবোর্ড
 */

class EkkadokkaGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.board = new Board();
    this.chara = new Chara();
    this.particles = new ParticleSystem();

    // গেমের মোড: 'p_vs_ai' (একক বনাম কম্পিউটার) অথবা 'p_vs_p' (দুই খেলোয়াড়)
    this.mode = 'p_vs_ai';
    this.difficulty = 'normal'; // normal, hard

    // খেলোয়াড়দের অবজেক্ট (কমপ্যাক্ট নাম)
    this.players = [
      new AnimatedPlayer('আপনি', '#1976d2', false),
      new AnimatedPlayer('বল্টু', '#e65100', true)
    ];

    this.activePlayerIdx = 0; // ০ বা ১
    // স্কোর ও বর্তমান লক্ষ্য ঘর (১ থেকে ৬)
    this.playerTargets = [1, 1]; // [Player 1 target, Player 2/AI target]
    this.scores = [0, 0];

    // গেমের স্টেটসমূহ:
    // 'MENU', 'THROW_AIM', 'THROW_FLIGHT', 'VALIDATE_THROW',
    // 'HOPPING', 'KICK_CHARA', 'RETURN_HOP', 'FOUL_PAUSE',
    // 'ROUND_SUCCESS', 'GAME_OVER', 'PAUSED'
    this.state = 'MENU';
    this.prevState = 'MENU';

    // ইনপুট স্টেট
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.dragCurrent = { x: 0, y: 0 };
    this.powerMeterVal = 0;
    this.powerMeterDir = 1;

    // টাইমার ও অ্যানিমেশন হ্যান্ডেল
    this.lastTime = performance.now();
    this.stateTimer = 0;
    this.touchedLine = null;
    this.message = 'স্বাগতম! খেলা শুরু করতে মোড বেছে নিন।';
    this.messageSub = '';

    // টিউটোরিয়াল ও সাহায্যকারী নির্দেশক
    this.showHints = true;

    // AI হ্যান্ডলার টাইমার
    this.aiActionTimer = null;

    this.initEvents();
    this.resizeCanvas();
  }

  // ক্যানভাস সাইজ স্ক্রিন সাইজের সাথে সমন্বয়
  resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();

    // ডিসপ্লে সাইজ ও ইন্টারনাল রেজোলিউশন
    const w = rect.width || window.innerWidth;
    const h = rect.height || (window.innerHeight - 80);

    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.cssWidth = w;
    this.cssHeight = h;

    this.board.updateDimensions(w, h);

    // খেলোয়াড় ও চাড়ার স্কেলিং সমন্বয়
    const charScale = Math.max(0.72, Math.min(1.05, this.board.squareSize / 260));
    this.players.forEach(p => p.scale = charScale);
    this.chara.radius = Math.max(11, Math.min(15, this.board.squareSize * 0.055));

    // খেলোয়াড় ও চাড়ার প্রারম্ভিক অবস্থান
    const baseArea = this.board.getBaselineArea();
    if (this.state === 'MENU' || this.state === 'THROW_AIM') {
      const activeP = this.getActivePlayer();
      activeP.setPos(baseArea.center.x - 26, baseArea.center.y);
      this.chara.reset(baseArea.center.x + 26, baseArea.center.y);
    }
  }

  getActivePlayer() {
    return this.players[this.activePlayerIdx];
  }

  getTargetBoxNum() {
    return this.playerTargets[this.activePlayerIdx];
  }

  // খেলা শুরু করা
  startNewGame(mode = 'p_vs_ai') {
    this.mode = mode;
    this.activePlayerIdx = 0;
    this.playerTargets = [1, 1];
    this.scores = [0, 0];

    if (mode === 'p_vs_p') {
      this.players[0] = new AnimatedPlayer('প্লেয়ার ১', '#1976d2', false);
      this.players[1] = new AnimatedPlayer('প্লেয়ার ২', '#c2185b', false);
    } else {
      this.players[0] = new AnimatedPlayer('আপনি', '#1976d2', false);
      this.players[1] = new AnimatedPlayer('বল্টু', '#e65100', true);
    }

    const p2Dot = document.querySelector('#p2-card .player-dot');
    if (p2Dot) {
      p2Dot.className = mode === 'p_vs_p' ? 'player-dot dot-p2' : 'player-dot dot-ai';
    }

    this.startTurn();
  }

  // নতুন দানের সূচনা
  startTurn() {
    const p = this.getActivePlayer();
    const targetBox = this.getTargetBoxNum();
    const baseArea = this.board.getBaselineArea();

    this.touchedLine = null;
    p.setPos(baseArea.center.x - 26, baseArea.center.y);
    p.currentBox = 0;
    p.state = 'idle';

    this.chara.reset(baseArea.center.x + 26, baseArea.center.y);
    this.state = 'THROW_AIM';

    const bnTarget = this.board.boxes[targetBox].bnNum;
    this.setMessage(
      `${p.name}-এর পালা! লক্ষ্য: ঘর ${bnTarget}`,
      p.isAI ? 'কম্পিউটার চাড়া ছোঁড়ার হিসাব করছে...' : 'চাড়াটি টেনে লক্ষ্য ঘরে নিক্ষেপ করুন'
    );

    this.updateHUD();

    if (p.isAI) {
      this.scheduleAITurn();
    }
  }

  setMessage(main, sub = '') {
    this.message = main;
    this.messageSub = sub;
    const msgEl = document.getElementById('status-msg');
    const subEl = document.getElementById('status-sub');
    if (msgEl) msgEl.innerText = main;
    if (subEl) subEl.innerText = sub;
  }

  // HUD স্কোর ও তথ্য আপডেট
  updateHUD() {
    const p1ScoreEl = document.getElementById('p1-score');
    const p2ScoreEl = document.getElementById('p2-score');
    const p1NameEl = document.getElementById('p1-name');
    const p2NameEl = document.getElementById('p2-name');
    const p1TargetEl = document.getElementById('p1-target');
    const p2TargetEl = document.getElementById('p2-target');
    const turnBadgeEl = document.getElementById('turn-badge');

    if (p1NameEl) p1NameEl.innerText = this.players[0].name;
    if (p2NameEl) p2NameEl.innerText = this.players[1].name;
    if (p1ScoreEl) p1ScoreEl.innerText = `${this.scores[0]} পঃ`;
    if (p2ScoreEl) p2ScoreEl.innerText = `${this.scores[1]} পঃ`;

    if (p1TargetEl) p1TargetEl.innerText = `ঘর: ${this.board.boxes[this.playerTargets[0]]?.bnNum || 'জয়'}`;
    if (p2TargetEl) p2TargetEl.innerText = `ঘর: ${this.board.boxes[this.playerTargets[1]]?.bnNum || 'জয়'}`;

    if (turnBadgeEl) {
      turnBadgeEl.innerText = `${this.getActivePlayer().name}-এর পালা`;
      turnBadgeEl.style.backgroundColor = this.activePlayerIdx === 0 ? '#1976d2' : (this.mode === 'p_vs_p' ? '#c2185b' : '#e65100');
    }

    const p1Card = document.getElementById('p1-card');
    const p2Card = document.getElementById('p2-card');
    if (p1Card) p1Card.classList.toggle('active', this.activePlayerIdx === 0);
    if (p2Card) p2Card.classList.toggle('active', this.activePlayerIdx === 1);

    // অ্যাকশন বাটন সক্রিয়/নিষ্ক্রিয়
    const throwBtn = document.getElementById('action-throw-btn');
    const kickBtn = document.getElementById('action-kick-btn');
    const hopBtn = document.getElementById('action-hop-btn');

    if (throwBtn) throwBtn.style.display = (this.state === 'THROW_AIM' && !this.getActivePlayer().isAI) ? 'inline-block' : 'none';
    if (kickBtn) kickBtn.style.display = (this.state === 'HOPPING' && this.isAdjacentToChara() && !this.getActivePlayer().isAI) ? 'inline-block' : 'none';
    if (hopBtn) hopBtn.style.display = ((this.state === 'HOPPING' || this.state === 'RETURN_HOP') && !this.getActivePlayer().isAI) ? 'inline-block' : 'none';
  }

  // ইনপুট ইভেন্ট হ্যান্ডলারসমূহ (টাচ ও মাউস)
  initEvents() {
    const c = this.canvas;

    const getPos = (e) => {
      const rect = c.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    };

    // পয়েন্টার / টাচ শুরু
    const handleStart = (pos) => {
      if (this.state === 'PAUSED' || this.getActivePlayer().isAI) return;
      window.soundEngine.init();

      if (this.state === 'THROW_AIM') {
        const baseArea = this.board.getBaselineArea();
        const distToChara = Math.hypot(pos.x - this.chara.x, pos.y - this.chara.y);
        const inLowerArea = pos.y >= baseArea.y - 25;

        // নিচে বা চাড়ার কাছাকাছি ট্যাপ করলে ড্র্যাগ শুরু
        if (distToChara < 65 || inLowerArea) {
          this.isDragging = true;
          this.dragStart = pos;
          this.dragCurrent = pos;
        } else {
          // সরাসরি কোনো ঘরে ট্যাপ করলে সেখানে নিক্ষেপ
          const clickedBox = this.board.getBoxAtPoint(pos.x, pos.y);
          if (clickedBox) {
            this.launchChara(pos.x, pos.y);
          }
        }
      } else if (this.state === 'HOPPING' || this.state === 'RETURN_HOP') {
        this.handlePlayerBoardClick(pos.x, pos.y);
      }
    };

    const handleMove = (pos) => {
      if (this.isDragging) {
        this.dragCurrent = pos;
      }
    };

    const handleEnd = () => {
      if (this.isDragging && this.state === 'THROW_AIM') {
        this.isDragging = false;
        this.executeCharaThrow();
      }
    };

    // মাউস ইভেন্ট
    c.addEventListener('mousedown', (e) => {
      e.preventDefault();
      handleStart(getPos(e));
    });
    window.addEventListener('mousemove', (e) => {
      handleMove(getPos(e));
    });
    window.addEventListener('mouseup', () => {
      handleEnd();
    });

    // টাচ ইভেন্ট (মোবাইল ও অ্যান্ড্রয়েড স্ক্রিনে নিখুঁত কাজ)
    c.addEventListener('touchstart', (e) => {
      e.preventDefault();
      handleStart(getPos(e));
    }, { passive: false });

    c.addEventListener('touchmove', (e) => {
      e.preventDefault();
      handleMove(getPos(e));
    }, { passive: false });

    c.addEventListener('touchend', (e) => {
      e.preventDefault();
      handleEnd();
    });
  }

  // ড্র্যাগ অনুযায়ী নিশানা নির্ধারণ (ফরওয়ার্ড ড্র্যাগ ও স্লিং শট দুটোই সাপোর্ট করে)
  getAimPoint() {
    const startX = this.chara.x;
    const startY = this.chara.y;
    const curX = this.dragCurrent.x;
    const curY = this.dragCurrent.y;
    const baseArea = this.board.getBaselineArea();

    // ১. ফরোয়ার্ড ড্র্যাগ (আঙুল উপরের দিকে বা কোর্টের ভেতর নিয়ে যাওয়া)
    if (curY < baseArea.y + 10) {
      return { x: curX, y: curY, mode: 'forward' };
    }

    // ২. ব্যাকওয়ার্ড ড্র্যাগ / স্লিং শট (আঙুল পিছনের দিকে বা ডানে-বামে টানা)
    const dx = this.dragStart.x - curX;
    const dy = this.dragStart.y - curY;
    const dist = Math.hypot(dx, dy);

    if (dist > 15) {
      const angle = Math.atan2(dy, dx);
      const power = Math.min(1.0, dist / 130);
      const throwDist = 80 + power * (this.board.totalHeight * 0.95);
      return {
        x: startX - Math.cos(angle) * throwDist,
        y: startY - Math.sin(angle) * throwDist,
        mode: 'slingshot'
      };
    }

    // ৩. ট্যাপ করলে লক্ষ্য ঘরের কেন্দ্রে
    const targetBox = this.board.boxes[this.getTargetBoxNum()];
    return {
      x: targetBox.center.x + (Math.random() - 0.5) * 12,
      y: targetBox.center.y + (Math.random() - 0.5) * 12,
      mode: 'tap'
    };
  }

  // মানুষের চাড়া নিক্ষেপ সম্পাদন
  executeCharaThrow() {
    const aim = this.getAimPoint();
    this.launchChara(aim.x, aim.y);
  }

  // সরাসরি বাটন থেকে টাইমিং নিক্ষেপ
  throwWithButton() {
    if (this.state !== 'THROW_AIM' || this.getActivePlayer().isAI) return;
    window.soundEngine.init();

    const targetBox = this.board.boxes[this.getTargetBoxNum()];
    // পাওয়ার মিটারের মানের উপর নির্ভর করে সঠিকতা
    const accuracy = 1 - Math.abs(this.powerMeterVal - 0.7); // ০.৭০ পারফেক্ট পাওয়ার
    const offsetX = (1 - accuracy) * (Math.random() - 0.5) * 60;
    const offsetY = (1 - accuracy) * (Math.random() - 0.5) * 60;

    this.launchChara(targetBox.center.x + offsetX, targetBox.center.y + offsetY);
  }

  launchChara(destX, destY) {
    this.state = 'THROW_FLIGHT';
    window.soundEngine.playThrow();
    this.chara.throwTo(this.chara.x, this.chara.y, destX, destY, 0.55);
    this.setMessage('চাড়া বাতাসে উড়ছে...');
    this.updateHUD();
  }

  // নিক্ষেপ শেষ হলে কলিশন ও নিয়ম যাচাইকরণ
  validateThrowResult() {
    this.state = 'VALIDATE_THROW';
    window.soundEngine.playCharaLand();

    const cx = this.chara.x;
    const cy = this.chara.y;
    const targetBoxNum = this.getTargetBoxNum();

    // ১. দাগে লেগেছে কিনা যাচাই
    const lineCollision = this.board.checkCharaLineCollision(cx, cy, this.chara.radius);
    if (lineCollision.touched) {
      this.touchedLine = lineCollision.line;
      this.triggerFoul('দাগে চাড়া লেগেছে! (রেফারেন্স নিয়ম ৩ অনুযায়ী ফাউল)');
      return;
    }

    // ২. কোন ঘরে পড়েছে তা দেখা
    const landedBox = this.board.getBoxAtPoint(cx, cy);

    if (!landedBox) {
      this.triggerFoul('চাড়া কোর্টের বাইরে চলে গেছে!');
      return;
    }

    if (landedBox !== targetBoxNum) {
      const bnLanded = this.board.boxes[landedBox].bnNum;
      const bnTarget = this.board.boxes[targetBoxNum].bnNum;
      this.triggerFoul(`ভুল ঘরে চাড়া পড়েছে! (পড়েছে ঘর ${bnLanded}-এ, লক্ষ্য ছিল ${bnTarget})`);
      return;
    }

    // সঠিক ঘরে চাড়া পড়েছে!
    this.chara.currentBox = landedBox;
    window.soundEngine.playSuccess();
    this.state = 'HOPPING';

    const p = this.getActivePlayer();
    this.setMessage(
      'সাবাশ! চাড়া সঠিক ঘরে পড়েছে!',
      p.isAI ? 'কম্পিউটার এবার এক পায়ে লাফ দিয়ে এগোচ্ছে...' : 'এক পায়ে লাফিয়ে সামনের ঘরে চলুন (দাগে পা দেওয়া যাবে না)'
    );

    this.updateHUD();

    if (p.isAI) {
      this.scheduleAIHop();
    }
  }

  // ফাউল হলে পালা পরিবর্তন
  triggerFoul(reason) {
    this.state = 'FOUL_PAUSE';
    window.soundEngine.playFoul();
    const p = this.getActivePlayer();
    p.triggerFoul();

    this.setMessage(`ফাউল! ${reason}`, 'পালা পরিবর্তন হচ্ছে...');
    this.updateHUD();

    setTimeout(() => {
      this.switchTurn();
    }, 2200);
  }

  switchTurn() {
    this.activePlayerIdx = (this.activePlayerIdx === 0) ? 1 : 0;
    this.startTurn();
  }

  // খেলোয়াড় কোর্টে ক্লিক বা ট্যাপ করলে যাচাই
  handlePlayerBoardClick(clickX, clickY) {
    if (this.state !== 'HOPPING' && this.state !== 'RETURN_HOP') return;
    const p = this.getActivePlayer();
    if (p.isHopping || p.isAI) return;

    // ১. চাড়ায় ট্যাপ করে বাইরে পাঠানো যাচাই
    const distToChara = Math.hypot(clickX - this.chara.x, clickY - this.chara.y);
    if (distToChara < 55 && this.isAdjacentToChara() && this.state === 'HOPPING') {
      this.executeCharaKick();
      return;
    }

    // ২. পা দাগে লেগেছে কিনা যাচাই
    const footCollision = this.board.checkFootLineCollision(clickX, clickY);
    if (footCollision.touched) {
      this.touchedLine = footCollision.line;
      this.triggerFoul('দাগে পা লেগেছে! (রেফারেন্স নিয়ম ৩ ও ৫ অনুযায়ী ফাউল)');
      return;
    }

    // ৩. কোন ঘরে পা রাখা হয়েছে
    const clickedBox = this.board.getBoxAtPoint(clickX, clickY);
    const baseArea = this.board.getBaselineArea();
    const isBaselineClick = clickY >= baseArea.y && clickY <= baseArea.y + baseArea.height;

    // ফেরত আসার সময় বেসলাইনে ক্লিক করলে দান সফল!
    if (this.state === 'RETURN_HOP' && (isBaselineClick || clickedBox === null && clickY > this.board.y + this.board.totalHeight)) {
      this.hopPlayerTo(baseArea.center.x, baseArea.center.y, 0, () => {
        this.completeRoundSuccess();
      });
      return;
    }

    if (!clickedBox) {
      return; // বাইরের এলোমেলো ক্লিকে কিছু হবে না
    }

    // ৪. চাড়া যে ঘরে আছে সে ঘরে পা দেওয়া নিষেধ!
    if (this.state === 'HOPPING' && clickedBox === this.chara.currentBox) {
      this.triggerFoul('চাড়ার ঘরে পা দেওয়া যাবে না! (নিয়ম অনুযায়ী চাড়ার ঘর বাদ দিয়ে লাফাতে হয়)');
      return;
    }

    // ৫. বৈধ সংলগ্ন ঘরে লাফানো হচ্ছে কিনা যাচাই
    const validMoves = this.getValidNextMoves();
    if (!validMoves.includes(clickedBox)) {
      this.triggerFoul('ভুল ঘরে ঝাঁপ! ঘর বাদ দেওয়া যাবে না, নিয়ম অনুযায়ী ক্রমানুসারে লাফান।');
      return;
    }

    // লাফ দেওয়া
    const box = this.board.boxes[clickedBox];
    this.hopPlayerTo(clickX, clickY, clickedBox, () => {
      this.checkHoppingMilestone();
    });
  }

  // খেলোয়াড়ের লাফ অ্যানিমেশন
  hopPlayerTo(destX, destY, boxNum, onComplete) {
    const p = this.getActivePlayer();
    window.soundEngine.playHop();
    p.hopTo(destX, destY, boxNum);
    this.onHopComplete = onComplete;
  }

  // খেলোয়াড় বর্তমানে চাড়ার ঘরের সংলগ্ন কিনা
  isAdjacentToChara() {
    const p = this.getActivePlayer();
    const cBox = this.chara.currentBox;
    if (!cBox) return false;

    const currentPBox = p.currentBox;
    const adjMap = {
      1: [4, 2],
      2: [1, 3],
      3: [4, 2],
      4: [5, 1, 3],
      5: [6, 4],
      6: [0, 5]
    };

    return adjMap[cBox]?.includes(currentPBox) || false;
  }

  // পরবর্তী সম্ভাব্য বৈধ ঘরসমূহ
  getValidNextMoves() {
    const p = this.getActivePlayer();
    const curr = p.currentBox;
    const cBox = this.chara.currentBox;

    if (this.state === 'HOPPING') {
      // প্রারম্ভিক অবস্থা: বেসলাইন থেকে কোর্টে প্রবেশ
      if (curr === 0) {
        if (cBox === 6) return [5]; // চাড়া ৬-এ থাকলে ৫-এ লাফ
        return [6];
      }
      if (curr === 6) {
        if (cBox === 5) return [4];
        return [5];
      }
      if (curr === 5) {
        if (cBox === 4) return [1, 3];
        return [4];
      }
      if (curr === 4) {
        const moves = [];
        if (cBox !== 1) moves.push(1);
        if (cBox !== 3) moves.push(3);
        if (cBox !== 2) moves.push(2);
        return moves;
      }
      if (curr === 1) {
        const moves = [4];
        if (cBox !== 2) moves.push(2);
        return moves;
      }
      if (curr === 3) {
        const moves = [4];
        if (cBox !== 2) moves.push(2);
        return moves;
      }
      if (curr === 2) {
        const moves = [];
        if (cBox !== 1) moves.push(1);
        if (cBox !== 3) moves.push(3);
        return moves;
      }
    } else if (this.state === 'RETURN_HOP') {
      // চাড়া বের করার পর নিরাপদে বাইরে ফিরে আসা
      if (curr === 2) return [1, 3];
      if (curr === 1 || curr === 3) return [4];
      if (curr === 4) return [5];
      if (curr === 5) return [6];
      if (curr === 6) return [0]; // বেসলাইন
    }

    return [];
  }

  // লাফের পর অবস্থা চেক
  checkHoppingMilestone() {
    const p = this.getActivePlayer();
    this.updateHUD();

    if (this.state === 'HOPPING') {
      if (this.isAdjacentToChara()) {
        this.setMessage(
          'আপনি চাড়ার কাছে পৌঁছেছেন!',
          p.isAI ? 'কম্পিউটার চাড়া কিক করছে...' : 'এবার চাড়ায় ট্যাপ করে কোর্টের বাইরে পাঠান!'
        );
        if (p.isAI) {
          setTimeout(() => this.executeCharaKick(), 900);
        }
      } else {
        this.setMessage('সুন্দর লাফ!', 'পরবর্তী ঘরে এক পায়ে লাফিয়ে চলুন...');
        if (p.isAI) {
          this.scheduleAIHop();
        }
      }
    } else if (this.state === 'RETURN_HOP') {
      if (p.currentBox === 0) {
        this.completeRoundSuccess();
      } else {
        this.setMessage('ফিরে আসছেন...', 'লাফিয়ে কোর্টের বাইরে বেসলাইনে আসুন');
        if (p.isAI) {
          this.scheduleAIReturnHop();
        }
      }
    }
  }

  // কিক বা ট্যাপ করে চাড়া বাইরে আনা (রেফারেন্স ছবির নিয়ম ৪)
  executeCharaKick() {
    window.soundEngine.playCharaKick();
    const baseArea = this.board.getBaselineArea();
    // চাড়াকে নিচের বেসলাইনের দিকে কিক করা
    const exitTargetX = baseArea.center.x + (Math.random() - 0.5) * 40;
    const exitTargetY = baseArea.center.y + 20;

    this.chara.kickTowards(exitTargetX, exitTargetY, 500);

    setTimeout(() => {
      this.state = 'RETURN_HOP';
      this.chara.currentBox = null; // চাড়া কোর্টের বাইরে
      window.soundEngine.playSuccess();
      const p = this.getActivePlayer();
      this.setMessage(
        'চাড়া সফলভাবে বাইরে এসেছে! (নিয়ম ৪ সম্পন্ন)',
        p.isAI ? 'কম্পিউটার এবার লাফিয়ে বাইরে আসছে...' : 'এবার এক পায়ে লাফিয়ে নিরাপদে বাইরে চলে আসুন'
      );
      this.updateHUD();

      if (p.isAI) {
        this.scheduleAIReturnHop();
      }
    }, 700);
  }

  // একটি ঘর সম্পূর্ণ সফল হওয়া
  completeRoundSuccess() {
    this.state = 'ROUND_SUCCESS';
    window.soundEngine.playSuccess();
    const p = this.getActivePlayer();
    p.triggerCelebrate();

    const currentTarget = this.getTargetBoxNum();
    const bnBox = this.board.boxes[currentTarget].bnNum;

    this.scores[this.activePlayerIdx] += 1;
    this.playerTargets[this.activePlayerIdx] += 1;

    this.setMessage(`অভিনন্দন! ${p.name} ${bnBox} নং ঘর জয় করেছেন!`, '+১ পয়েন্ট যোগ হয়েছে!');
    this.updateHUD();

    // জয় যাচাই (১ থেকে ৬ সব ঘর শেষ হয়েছে কিনা)
    if (this.playerTargets[this.activePlayerIdx] > 6) {
      setTimeout(() => this.triggerMatchWin(), 1200);
      return;
    }

    // ঐতিহ্যবাহী নিয়মে সফল হলে খেলোয়াড় তার পালা ধরে রাখে এবং পরের ঘরের চাড়া ছোঁড়ে
    setTimeout(() => {
      this.startTurn();
    }, 2400);
  }

  // পূর্ণ ম্যাচ বিজয়
  triggerMatchWin() {
    this.state = 'GAME_OVER';
    window.soundEngine.playVictory();
    this.particles.spawnConfetti(this.cssWidth, this.cssHeight, 90);

    const winner = this.getActivePlayer();
    const modal = document.getElementById('winner-modal');
    const title = document.getElementById('winner-title');
    const desc = document.getElementById('winner-desc');

    if (title) title.innerText = `🏆 ${winner.name} বিজয়ী! 🏆`;
    if (desc) desc.innerText = `অভিনন্দন! আপনি এক্কাদোক্কার ৬টি ঘরই সফলভাবে জয় করে চ্যাম্পিয়ন হয়েছেন!`;
    if (modal) modal.style.display = 'flex';
  }

  // --- স্মার্ট এআই (কম্পিউটার প্রতিপক্ষ) লজিক ---
  scheduleAITurn() {
    clearTimeout(this.aiActionTimer);
    this.aiActionTimer = setTimeout(() => {
      if (this.state !== 'THROW_AIM') return;

      const targetBox = this.board.boxes[this.getTargetBoxNum()];
      // এআই নির্ভুলতা (৮২% নির্ভুল, ১৮% ভুল/দাগ ছোঁয়া যাতে মানবীয় অনুভূতি থাকে)
      const isAccurate = Math.random() < 0.82;
      let destX, destY;

      if (isAccurate) {
        destX = targetBox.center.x + (Math.random() - 0.5) * 16;
        destY = targetBox.center.y + (Math.random() - 0.5) * 16;
      } else {
        // দাগের খুব কাছে অথবা ভুল ঘরে
        if (Math.random() < 0.6) {
          // দাগ স্পর্শ করার মতো
          destX = targetBox.poly[0].x + (Math.random() - 0.5) * 6;
          destY = targetBox.poly[0].y + (Math.random() - 0.5) * 6;
        } else {
          // পাশের ঘরে চলে যাওয়া
          const otherBox = (targetBox.num % 6) + 1;
          destX = this.board.boxes[otherBox].center.x;
          destY = this.board.boxes[otherBox].center.y;
        }
      }

      this.launchChara(destX, destY);
    }, 1300);
  }

  scheduleAIHop() {
    clearTimeout(this.aiActionTimer);
    this.aiActionTimer = setTimeout(() => {
      if (this.state !== 'HOPPING') return;

      const validMoves = this.getValidNextMoves();
      if (validMoves.length === 0) return;

      // একটি সংলগ্ন ঘর পছন্দ করা
      const nextBoxNum = validMoves[0];
      const box = this.board.boxes[nextBoxNum];

      // এআই সামান্য রিস্কে দাগ ছুঁতে পারে (৮% সম্ভাবনা)
      const touchesLine = Math.random() < 0.08;
      let jumpX = box.center.x;
      let jumpY = box.center.y;

      if (touchesLine) {
        jumpX = box.poly[0].x;
        jumpY = box.poly[0].y;
      }

      this.hopPlayerTo(jumpX, jumpY, nextBoxNum, () => {
        if (touchesLine) {
          this.triggerFoul('কম্পিউটারের পা দাগে লেগে গেছে!');
        } else {
          this.checkHoppingMilestone();
        }
      });
    }, 850);
  }

  scheduleAIReturnHop() {
    clearTimeout(this.aiActionTimer);
    this.aiActionTimer = setTimeout(() => {
      if (this.state !== 'RETURN_HOP') return;

      const validMoves = this.getValidNextMoves();
      if (validMoves.includes(0)) {
        // বেসলাইনে ফেরা
        const base = this.board.getBaselineArea();
        this.hopPlayerTo(base.center.x, base.center.y, 0, () => {
          this.completeRoundSuccess();
        });
      } else if (validMoves.length > 0) {
        const nextBox = validMoves[0];
        const box = this.board.boxes[nextBox];
        this.hopPlayerTo(box.center.x, box.center.y, nextBox, () => {
          this.checkHoppingMilestone();
        });
      }
    }, 800);
  }

  // মেইন গেম লুপ
  update(currentTime) {
    const dt = Math.min(0.1, (currentTime - this.lastTime) / 1000);
    this.lastTime = currentTime;

    // পাওয়ার মিটারের গতিশীল ওঠা-নামা
    this.powerMeterVal += this.powerMeterDir * dt * 1.5;
    if (this.powerMeterVal > 1) {
      this.powerMeterVal = 1;
      this.powerMeterDir = -1;
    } else if (this.powerMeterVal < 0) {
      this.powerMeterVal = 0;
      this.powerMeterDir = 1;
    }

    const p = this.getActivePlayer();
    const hopRes = p.update(dt, this.particles);
    if (hopRes === 'landed' && this.onHopComplete) {
      const cb = this.onHopComplete;
      this.onHopComplete = null;
      cb();
    }

    const charaRes = this.chara.update(dt, this.particles);
    if (charaRes === 'landed' && this.state === 'THROW_FLIGHT') {
      setTimeout(() => this.validateThrowResult(), 250);
    }

    this.particles.update(dt);

    this.render();
    requestAnimationFrame((t) => this.update(t));
  }

  // ক্যানভাস রেন্ডারিং
  render() {
    const ctx = this.ctx;
    const w = this.cssWidth;
    const h = this.cssHeight;

    ctx.clearRect(0, 0, w, h);

    // ১. গ্রামীণ উঠোনের প্রাকৃতিক টেক্সচার (মাটি ও হালকা সবুজ ঘাস)
    this.renderGround(ctx, w, h);

    // ২. এক্কাদোক্কার বোর্ড ও খড়িমাটির দাগ
    const targetBox = (this.state === 'THROW_AIM' || this.state === 'THROW_FLIGHT') ? this.getTargetBoxNum() : null;
    const activeBox = (this.state === 'HOPPING' || this.state === 'RETURN_HOP') ? this.getActivePlayer().currentBox : null;

    this.board.render(ctx, targetBox, activeBox, this.touchedLine);

    // ৩. সাহায্যকারী নির্দেশক (Valid moves footprint indicator)
    if (this.showHints && (this.state === 'HOPPING' || this.state === 'RETURN_HOP') && !this.getActivePlayer().isAI) {
      this.renderMoveHints(ctx);
    }

    // ৪. নিক্ষেপ ড্র্যাগ ট্র্যাজেক্টরি ও পাওয়ার নির্দেশিকা
    if (this.isDragging && this.state === 'THROW_AIM') {
      this.renderThrowGuide(ctx);
    }

    // ৫. চাড়ার প্রদর্শন
    this.chara.render(ctx);

    // ৬. খেলোয়াড়ের কার্টুন অ্যানিমেশন
    this.getActivePlayer().render(ctx);

    // ৭. ধুলো ও কনফেটি কণা
    this.particles.render(ctx);
  }

  // গ্রামীণ মাটির উঠোন ও ঘাসের বর্ডার
  renderGround(ctx, w, h) {
    // মাটির উঠোনের হালকা রঙের গ্রেডিয়েন্ট
    const groundGrad = ctx.createLinearGradient(0, 0, 0, h);
    groundGrad.addColorStop(0, '#ebd8b7');
    groundGrad.addColorStop(0.5, '#dfc49e');
    groundGrad.addColorStop(1, '#caa97e');

    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, 0, w, h);

    // মৃদু ঘাসের ছোঁয়া (কোণায় কোণায় সবুজ দুব্বা ঘাস)
    ctx.save();
    ctx.fillStyle = '#66bb6a';
    const tufts = [
      { x: 30, y: 70 },
      { x: w - 50, y: 90 },
      { x: 45, y: h * 0.45 },
      { x: w - 40, y: h * 0.5 },
      { x: 25, y: h - 60 },
      { x: w - 55, y: h - 50 }
    ];

    tufts.forEach(t => {
      ctx.beginPath();
      ctx.arc(t.x, t.y, 14, 0, Math.PI * 2);
      ctx.arc(t.x - 8, t.y + 4, 10, 0, Math.PI * 2);
      ctx.arc(t.x + 8, t.y + 3, 11, 0, Math.PI * 2);
      ctx.fill();

      // ঘাসের ব্লেড
      ctx.strokeStyle = '#388e3c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(t.x, t.y + 6);
      ctx.lineTo(t.x - 4, t.y - 12);
      ctx.moveTo(t.x, t.y + 6);
      ctx.lineTo(t.x + 6, t.y - 10);
      ctx.stroke();
    });
    ctx.restore();
  }

  // ড্র্যাগ করার সময় প্রজেক্টাইল গাইড, ক্রসহেয়ার ও রিয়েল-টাইম নির্দেশিকা
  renderThrowGuide(ctx) {
    const startX = this.chara.x;
    const startY = this.chara.y;
    const aim = this.getAimPoint();

    ctx.save();
    // চাড়া থেকে টার্গেট পর্যন্ত সুন্দর ট্র্যাজেক্টরি আর্ক
    ctx.beginPath();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = 'rgba(230, 81, 0, 0.85)';
    ctx.lineWidth = 3.5;
    ctx.moveTo(startX, startY);
    const midX = (startX + aim.x) / 2;
    const midY = Math.min(startY, aim.y) - 25;
    ctx.quadraticCurveTo(midX, midY, aim.x, aim.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // টার্গেট রেটিকল স্ট্যাটাস ও লাইন কলিশন টেস্ট
    const targetBoxNum = this.getTargetBoxNum();
    const hoveredBox = this.board.getBoxAtPoint(aim.x, aim.y);
    const lineCol = this.board.checkCharaLineCollision(aim.x, aim.y, this.chara.radius);

    let reticleColor = '#ff9800';
    let statusText = 'এখানে পড়বে';

    if (lineCol.touched) {
      reticleColor = '#e53935';
      statusText = 'সতর্কতা: দাগে লাগবে!';
    } else if (hoveredBox === targetBoxNum) {
      reticleColor = '#2e7d32';
      statusText = 'সঠিক ঘর!';
    } else if (hoveredBox) {
      reticleColor = '#f57c00';
      statusText = `ঘর ${this.board.boxes[hoveredBox].bnNum}`;
    } else {
      reticleColor = '#d32f2f';
      statusText = 'কোর্টের বাইরে!';
    }

    // লক্ষ্য গোলক
    ctx.fillStyle = reticleColor + '38';
    ctx.beginPath();
    ctx.arc(aim.x, aim.y, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = reticleColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // ভেতরের ক্রসহেয়ার
    ctx.beginPath();
    ctx.moveTo(aim.x - 10, aim.y);
    ctx.lineTo(aim.x + 10, aim.y);
    ctx.moveTo(aim.x, aim.y - 10);
    ctx.lineTo(aim.x, aim.y + 10);
    ctx.stroke();

    // টেক্সট ব্যাজ
    ctx.font = 'bold 13px "Hind Siliguri", sans-serif';
    ctx.fillStyle = reticleColor;
    ctx.textAlign = 'center';
    ctx.fillText(statusText, aim.x, aim.y - 28);

    ctx.restore();
  }

  // কোন ঘরে লাফ দেওয়া যাবে তার পদচিহ্ন নির্দেশিকা
  renderMoveHints(ctx) {
    const validMoves = this.getValidNextMoves();
    ctx.save();
    validMoves.forEach(boxNum => {
      let cx, cy;
      if (boxNum === 0) {
        const b = this.board.getBaselineArea();
        cx = b.center.x;
        cy = b.center.y;
      } else {
        const b = this.board.boxes[boxNum];
        cx = b.center.x;
        cy = b.center.y;
      }

      // স্পন্দিত সবুজ পদচিহ্ন বৃত্ত
      const pulse = Math.sin(performance.now() * 0.007) * 4;
      ctx.fillStyle = 'rgba(76, 175, 80, 0.35)';
      ctx.beginPath();
      ctx.arc(cx, cy, 18 + pulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#2e7d32';
      ctx.lineWidth = 2;
      ctx.stroke();

      // ছোট পায়ের ছাপ চিহ্ন
      ctx.fillStyle = '#1b5e20';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 6, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }
}

window.EkkadokkaGame = EkkadokkaGame;
