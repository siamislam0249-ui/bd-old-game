/**
 * এক্কাদোক্কা (কুতকুত) - চরিত্র ও চাড়া ইঞ্জিন (Character & Chara Physics)
 * - রেফারেন্স ছবির মতো এক পায়ে লাফানো গ্রামীণ ছেলে
 * - খাঁটি পোড়ামাটির বা ভাঙা হাঁড়ির চাড়া (Earthenware pottery piece)
 * - নিখুঁত অ্যানিমেশন ও পার্টিকেল এফেক্টস (ধুলো ও আনন্দ উদযাপন)
 */

class Chara {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.vx = 0;
    this.vy = 0;
    this.radius = 14;
    this.isAirborne = false;
    this.isSliding = false;
    this.flightTime = 0;
    this.flightDuration = 0.5;
    this.rotation = 0.2;
    this.height = 0; // বাতাসে উচ্চতা
    this.visible = true;
    this.currentBox = null;
    this.isTapped = false;
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    this.vx = 0;
    this.vy = 0;
    this.isAirborne = false;
    this.isSliding = false;
    this.height = 0;
    this.visible = true;
    this.currentBox = null;
  }

  // চাড়া ছোঁড়ার পরিক্রমা শুরু
  throwTo(startX, startY, destX, destY, duration = 0.6) {
    this.x = startX;
    this.y = startY;
    this.startX = startX;
    this.startY = startY;
    this.targetX = destX;
    this.targetY = destY;
    this.isAirborne = true;
    this.isSliding = false;
    this.flightTime = 0;
    this.flightDuration = duration;
    this.height = 0;
    this.visible = true;
  }

  // কিক বা ট্যাপ করে বাইরে পাঠানো
  kickTowards(targetX, targetY, speed = 800) {
    this.isSliding = true;
    this.isAirborne = false;
    this.height = 0;
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0) {
      this.vx = (dx / dist) * speed;
      this.vy = (dy / dist) * speed;
    }
  }

  update(dt, particles) {
    if (this.isAirborne) {
      this.flightTime += dt;
      const progress = Math.min(1, this.flightTime / this.flightDuration);

      // মসৃণ পরাবৃত্তাকার পথ (Parabolic arc)
      this.x = this.startX + (this.targetX - this.startX) * progress;
      this.y = this.startY + (this.targetY - this.startY) * progress;

      // বাতাসে উচ্চতা (উড়ন্ত অবস্থা)
      this.height = Math.sin(progress * Math.PI) * 70;
      this.rotation += dt * 5;

      if (progress >= 1) {
        this.isAirborne = false;
        this.height = 0;
        this.x = this.targetX;
        this.y = this.targetY;
        // সামান্য স্লাইড
        this.isSliding = true;
        this.vx = (this.targetX - this.startX) * 0.15;
        this.vy = (this.targetY - this.startY) * 0.15;

        // অবতরণের ধুলো
        if (particles) {
          particles.spawnDust(this.x, this.y, 8);
        }
        return 'landed';
      }
    } else if (this.isSliding) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vx *= Math.pow(0.04, dt); // ঘর্ষণ
      this.vy *= Math.pow(0.04, dt);

      // ধুলো কণা
      if (particles && Math.hypot(this.vx, this.vy) > 60 && Math.random() < 0.4) {
        particles.spawnDust(this.x, this.y, 2);
      }

      if (Math.hypot(this.vx, this.vy) < 15) {
        this.vx = 0;
        this.vy = 0;
        this.isSliding = false;
        return 'stopped';
      }
    }
    return null;
  }

  render(ctx) {
    if (!this.visible) return;

    ctx.save();
    // মাটিতে ছায়া
    const shadowDist = 6 + this.height * 0.35;
    const shadowScale = Math.max(0.6, 1 - this.height * 0.006);

    ctx.fillStyle = 'rgba(40, 20, 10, 0.35)';
    ctx.beginPath();
    ctx.ellipse(
      this.x,
      this.y + shadowDist,
      this.radius * shadowScale * 1.1,
      this.radius * shadowScale * 0.65,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // পোড়ামাটির চাড়া আঁকা (রেফারেন্স ছবির মতো বহুভুজীয় খাপরা)
    ctx.translate(this.x, this.y - this.height);
    ctx.rotate(this.rotation);

    // মাটির হাঁড়ির ভাঙা টুকরোর মতো খাঁজকাটা রূপ
    ctx.beginPath();
    const r = this.radius;
    const pts = [
      { x: -r * 0.9, y: -r * 0.7 },
      { x: r * 0.3, y: -r * 1.0 },
      { x: r * 1.0, y: -r * 0.4 },
      { x: r * 0.9, y: r * 0.7 },
      { x: -r * 0.2, y: r * 1.0 },
      { x: -r * 1.0, y: r * 0.3 }
    ];

    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();

    // পোড়ামাটি / টেরাকোটা গ্রেডিয়েন্ট
    const grad = ctx.createLinearGradient(-r, -r, r, r);
    grad.addColorStop(0, '#d87040');
    grad.addColorStop(0.5, '#b94e24');
    grad.addColorStop(1, '#872f10');
    ctx.fillStyle = grad;
    ctx.fill();

    // চারপাশের রুক্ষ বর্ডার
    ctx.strokeStyle = '#5a1d08';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // মাটির হালকা খাঁজ ও টেক্সচার দাগ
    ctx.strokeStyle = 'rgba(255, 200, 160, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, -r * 0.3);
    ctx.lineTo(r * 0.4, r * 0.2);
    ctx.stroke();

    ctx.restore();
  }
}

class AnimatedPlayer {
  constructor(name = 'খেলোয়াড় ১', shirtColor = '#1976d2', isAI = false) {
    this.name = name;
    this.shirtColor = shirtColor;
    this.isAI = isAI;
    this.x = 0;
    this.y = 0;
    this.startX = 0;
    this.startY = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.isHopping = false;
    this.hopProgress = 0;
    this.hopDuration = 0.42;
    this.currentBox = 0; // ০ মানে বেসলাইনে বাইরে
    this.scale = 1;
    this.direction = 1; // ডানে বা বামে মুখ
    this.state = 'idle'; // idle, hopping, kicking, foul, celebrating
    this.expressionTimer = 0;
  }

  setPos(x, y) {
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
  }

  // এক পায়ে লাফ দিয়ে নির্দিষ্ট ঘরে যাওয়া
  hopTo(targetX, targetY, targetBoxNum) {
    this.startX = this.x;
    this.startY = this.y;
    this.targetX = targetX;
    this.targetY = targetY;
    this.isHopping = true;
    this.hopProgress = 0;
    this.nextBox = targetBoxNum;
    this.state = 'hopping';
    this.direction = targetX >= this.x ? 1 : -1;
  }

  update(dt, particles) {
    if (this.expressionTimer > 0) {
      this.expressionTimer -= dt;
      if (this.expressionTimer <= 0) {
        this.state = 'idle';
      }
    }

    if (this.isHopping) {
      this.hopProgress += dt / this.hopDuration;
      const t = Math.min(1, this.hopProgress);

      // মসৃণ লিনিয়ার ইন্টারপোলেশন
      this.x = this.startX + (this.targetX - this.startX) * t;
      this.y = this.startY + (this.targetY - this.startY) * t;

      if (t >= 1) {
        this.isHopping = false;
        this.x = this.targetX;
        this.y = this.targetY;
        this.currentBox = this.nextBox;
        this.state = 'idle';

        // অবতরণের সময় মাটির ধুলো তৈরি
        if (particles) {
          particles.spawnDust(this.x, this.y + 24, 7);
        }
        return 'landed';
      }
    }
    return null;
  }

  triggerFoul() {
    this.state = 'foul';
    this.expressionTimer = 1.6;
  }

  triggerCelebrate() {
    this.state = 'celebrating';
    this.expressionTimer = 2.0;
  }

  // রেফারেন্স ছবির মতো এক পায়ে লাফানো গ্রামীণ ছেলের ক্যানভাস রেন্ডারিং
  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // লাফানোর উচ্চতা (Jump arc)
    let jumpOffsetY = 0;
    if (this.isHopping) {
      jumpOffsetY = -Math.sin(this.hopProgress * Math.PI) * 45;
    }

    // মাটিতে পদছাপ ছায়া
    const shadowScale = this.isHopping ? 0.65 : 1.0;
    ctx.fillStyle = 'rgba(50, 30, 15, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 24, 18 * shadowScale, 9 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(0, jumpOffsetY);
    ctx.scale(this.direction * this.scale, this.scale);

    // ১. পা আঁকা (রেফারেন্স ছবি অনুযায়ী এক পা ভাঁজ করা, অন্য পা মাটিতে ল্যাংচা)
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#d79468'; // ত্বকের রঙ

    // বাম পা (মাটিতে ভর দেওয়া বা ল্যাংচার পা)
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(-4, 16);
    ctx.lineTo(2, 22); // পায়ের পাতা
    ctx.stroke();

    // ডান পা (হাঁটু মুড়ে পিছনে ভাঁজ করা - এক পায়ে লাফানোর স্টাইল)
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(16, 8); // হাঁটু পিছনে
    ctx.lineTo(12, 18); // পা পিছন দিকে বাঁকা
    ctx.stroke();
    ctx.restore();

    // ২. হাফ প্যান্ট (গাঢ় নীল বা কালো)
    ctx.fillStyle = '#1a237e';
    ctx.beginPath();
    ctx.moveTo(-10, -8);
    ctx.lineTo(12, -8);
    ctx.lineTo(14, 2);
    ctx.lineTo(2, 2);
    ctx.lineTo(0, -3);
    ctx.lineTo(-2, 2);
    ctx.lineTo(-12, 2);
    ctx.closePath();
    ctx.fill();

    // ৩. টি-শার্ট / জামা
    ctx.fillStyle = this.shirtColor;
    ctx.beginPath();
    ctx.roundRect(-12, -26, 24, 20, [4, 4, 2, 2]);
    ctx.fill();

    // ৪. হাত আঁকা (ভারসাম্য রক্ষার জন্য দুই হাত ছড়িয়ে থাকা)
    ctx.save();
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = '#d79468';
    ctx.lineCap = 'round';

    if (this.state === 'celebrating') {
      // আনন্দে দুই হাত উপরে
      ctx.beginPath();
      ctx.moveTo(-10, -22);
      ctx.lineTo(-20, -36);
      ctx.moveTo(10, -22);
      ctx.lineTo(20, -36);
      ctx.stroke();
    } else if (this.state === 'foul') {
      // মাথায় হাত
      ctx.beginPath();
      ctx.moveTo(-10, -22);
      ctx.lineTo(-8, -34);
      ctx.moveTo(10, -22);
      ctx.lineTo(8, -34);
      ctx.stroke();
    } else {
      // এক পায়ে ভারসাম্য রক্ষার স্বাভাবিক ভঙ্গি (রেফারেন্স ছবির মতো)
      ctx.beginPath();
      ctx.moveTo(-10, -20);
      ctx.lineTo(-22, -14);
      ctx.moveTo(10, -20);
      ctx.lineTo(22, -10);
      ctx.stroke();
    }
    ctx.restore();

    // ৫. মাথা ও মুখাবয়ব
    ctx.fillStyle = '#e8a77a'; // মুখ
    ctx.beginPath();
    ctx.arc(0, -36, 12, 0, Math.PI * 2);
    ctx.fill();

    // চুল (কালো কুঁচকানো গ্রামীণ চুল)
    ctx.fillStyle = '#212121';
    ctx.beginPath();
    ctx.arc(0, -38, 12.5, Math.PI * 0.9, Math.PI * 2.1);
    ctx.fill();

    // চোখ ও হাসি
    ctx.fillStyle = '#111';
    if (this.state === 'foul') {
      // আঁতকে ওঠার চোখ (X বা গোল)
      ctx.fillText('x', -5, -34);
      ctx.fillText('x', 3, -34);
    } else {
      ctx.beginPath();
      ctx.arc(-4, -36, 1.8, 0, Math.PI * 2);
      ctx.arc(4, -36, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // হাসিমুখ
      ctx.strokeStyle = '#993333';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, -33, 4, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }

    // ফাউল হলে মাথার উপর বিস্ময়সূচক লাল চিহ্ন
    if (this.state === 'foul') {
      ctx.fillStyle = '#d32f2f';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', 0, -52);
    }

    ctx.restore();
  }
}

// ধুলো ও উদযাপনের কণা ইঞ্জিন (Particle System)
class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  spawnDust(x, y, count = 6) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 25 + Math.random() * 45;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.4 - 15,
        radius: 3 + Math.random() * 4,
        alpha: 0.7,
        decay: 1.6 + Math.random() * 1.2,
        color: 'rgba(180, 140, 100,'
      });
    }
  }

  spawnConfetti(canvasWidth, canvasHeight, count = 70) {
    const colors = ['#e91e63', '#9c27b0', '#2196f3', '#4caf50', '#ffeb3b', '#ff9800'];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * canvasWidth,
        y: -10,
        vx: (Math.random() - 0.5) * 120,
        vy: 120 + Math.random() * 180,
        radius: 5 + Math.random() * 5,
        alpha: 1.0,
        decay: 0.35 + Math.random() * 0.25,
        color: colors[Math.floor(Math.random() * colors.length)],
        isConfetti: true,
        rot: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 8
      });
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= p.decay * dt;

      if (p.isConfetti) {
        p.rot += p.vRot * dt;
      }

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  render(ctx) {
    ctx.save();
    for (const p of this.particles) {
      if (p.isConfetti) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillRect(-p.radius, -p.radius / 2, p.radius * 2, p.radius);
        ctx.restore();
      } else {
        ctx.fillStyle = `${p.color}${Math.max(0, p.alpha)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

window.Chara = Chara;
window.AnimatedPlayer = AnimatedPlayer;
window.ParticleSystem = ParticleSystem;
