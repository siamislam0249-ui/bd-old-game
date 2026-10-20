/**
 * এক্কাদোক্কা (কুতকুত) - বোর্ড জিওমেট্রি ও কলিশন ইঞ্জিন
 * রেফারেন্স ছবির সাথে শতভাগ সামঞ্জস্যপূর্ণ:
 * - উপরে একটি বড় বর্গক্ষেত্র (কর্ণ দিয়ে ৪টি ত্রিভুজ: ১, ২, ৩, ৪)
 * - নিচে দুটি আয়তক্ষেত্র (৫ এবং ৬)
 */

class Board {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.squareSize = 300;
    this.rectHeight = 90;
    this.totalHeight = 480;
    this.scale = 1;
    this.padding = 30;

    // বাক্সের তথ্য ও বহুভুজ (Polygons)
    this.boxes = {};
    // দাগসমূহ (Line segments)
    this.lines = [];
    // দাগে পা বা চাড়া ছোঁয়ার সীমানা মার্জিন (পিক্সেল)
    this.lineTolerance = 7;
    this.footTolerance = 10;
  }

  // ক্যানভাস সাইজ অনুযায়ী বোর্ডের আকার ও অবস্থান নির্ধারণ
  // ক্যারেক্টারকে নিশ্চিতভাবে স্ক্রিনের মাঝামাঝি/সামনে (Upper-Middle, 50-52% উচ্চতায়) রাখা
  updateDimensions(canvasWidth, canvasHeight) {
    const availableWidth = canvasWidth - this.padding * 2;
    const topSafeMargin = 8;

    // ক্যারেক্টার ও বেসলাইন থাকবে স্ক্রিনের প্রায় ৫০%-৫২% উচ্চতায়
    // ফলে নিচে প্রায় অর্ধেক স্ক্রিন সম্পূর্ণ ফাঁকা ও উন্মুক্ত থাকবে
    const targetBaselineCenterY = Math.floor(canvasHeight * 0.52);
    const bHeight = 44;
    const baseY = targetBaselineCenterY - Math.floor(bHeight / 2);

    // কোর্টের মোট উচ্চতা নির্ধারণ (বেসলাইনের ঠিক উপরে)
    const availableCourtHeight = Math.max(160, baseY - topSafeMargin - 6);

    // কোর্টের অনুপাত: বর্গক্ষেত্র + ২টি আয়তক্ষেত্র = ১.৪৮ গুণ
    let s = availableCourtHeight / 1.48;
    if (s > availableWidth * 0.85) {
      s = availableWidth * 0.85;
    }
    s = Math.min(s, 240); // খুব বেশি বড় হবে না যাতে ক্যারেক্টার নিচে না নামে

    this.squareSize = Math.max(120, Math.floor(s));
    this.rectHeight = Math.floor(this.squareSize * 0.24);
    this.totalHeight = this.squareSize + this.rectHeight * 2;

    this.x = Math.floor((canvasWidth - this.squareSize) / 2);
    // কোর্টের শীর্ষ ওয়াই অবস্থান
    this.y = topSafeMargin;

    this.calculatePolygons();
    this.calculateLineSegments();
  }

  // রেফারেন্স ছবি অনুযায়ী ৬টি ঘরের জ্যামিতি নির্ধারণ
  calculatePolygons() {
    const x = this.x;
    const y = this.y;
    const s = this.squareSize;
    const rh = this.rectHeight;
    const cx = x + s / 2;
    const cy = y + s / 2;

    // ১ নং ঘর: বাম ত্রিভুজ
    const poly1 = [
      { x: x, y: y },
      { x: cx, y: cy },
      { x: x, y: y + s }
    ];

    // ২ নং ঘর: উপরের ত্রিভুজ
    const poly2 = [
      { x: x, y: y },
      { x: x + s, y: y },
      { x: cx, y: cy }
    ];

    // ৩ নং ঘর: ডান ত্রিভুজ
    const poly3 = [
      { x: x + s, y: y },
      { x: x + s, y: y + s },
      { x: cx, y: cy }
    ];

    // ৪ নং ঘর: নিচের ত্রিভুজ
    const poly4 = [
      { x: x, y: y + s },
      { x: cx, y: cy },
      { x: x + s, y: y + s }
    ];

    // ৫ নং ঘর: উপরের আয়তক্ষেত্র
    const poly5 = [
      { x: x, y: y + s },
      { x: x + s, y: y + s },
      { x: x + s, y: y + s + rh },
      { x: x, y: y + s + rh }
    ];

    // ৬ নং ঘর: নিচের আয়তক্ষেত্র (প্রবেশদ্বার / শুরুর ঘর)
    const poly6 = [
      { x: x, y: y + s + rh },
      { x: x + s, y: y + s + rh },
      { x: x + s, y: y + s + rh * 2 },
      { x: x, y: y + s + rh * 2 }
    ];

    this.boxes = {
      1: {
        num: 1,
        bnNum: '১',
        name: 'ঘর ১ (বাম ত্রিভুজ)',
        poly: poly1,
        center: { x: x + s * 0.22, y: y + s * 0.5 },
        color: 'rgba(255, 138, 128, 0.12)'
      },
      2: {
        num: 2,
        bnNum: '২',
        name: 'ঘর ২ (উপরের ত্রিভুজ)',
        poly: poly2,
        center: { x: cx, y: y + s * 0.22 },
        color: 'rgba(128, 216, 255, 0.12)'
      },
      3: {
        num: 3,
        bnNum: '৩',
        name: 'ঘর ৩ (ডান ত্রিভুজ)',
        poly: poly3,
        center: { x: x + s * 0.78, y: y + s * 0.5 },
        color: 'rgba(185, 246, 202, 0.12)'
      },
      4: {
        num: 4,
        bnNum: '৪',
        name: 'ঘর ৪ (নিচের ত্রিভুজ)',
        poly: poly4,
        center: { x: cx, y: y + s * 0.78 },
        color: 'rgba(255, 209, 128, 0.12)'
      },
      5: {
        num: 5,
        bnNum: '৫',
        name: 'ঘর ৫ (মাঝের আয়তক্ষেত্র)',
        poly: poly5,
        center: { x: cx, y: y + s + rh * 0.5 },
        color: 'rgba(207, 216, 220, 0.12)'
      },
      6: {
        num: 6,
        bnNum: '৬',
        name: 'ঘর ৬ (প্রবেশ আয়তক্ষেত্র)',
        poly: poly6,
        center: { x: cx, y: y + s + rh * 1.5 },
        color: 'rgba(255, 236, 179, 0.12)'
      }
    };
  }

  // দাগগুলো লাইন সেগমেন্ট হিসেবে সংরক্ষণ করা (দাগ ছোঁয়া শনাক্তকরণে)
  calculateLineSegments() {
    const x = this.x;
    const y = this.y;
    const s = this.squareSize;
    const rh = this.rectHeight;
    const cx = x + s / 2;
    const cy = y + s / 2;

    this.lines = [
      // শীর্ষ রেখা
      { id: 'top', p1: { x: x, y: y }, p2: { x: x + s, y: y } },
      // বর্গের বাম রেখা
      { id: 'sq_left', p1: { x: x, y: y }, p2: { x: x, y: y + s } },
      // বর্গের ডান রেখা
      { id: 'sq_right', p1: { x: x + s, y: y }, p2: { x: x + s, y: y + s } },
      // কর্ণ ১: উপর-বাম থেকে নিচ-ডান
      { id: 'diag1', p1: { x: x, y: y }, p2: { x: x + s, y: y + s } },
      // কর্ণ ২: উপর-ডান থেকে নিচ-বাম
      { id: 'diag2', p1: { x: x + s, y: y }, p2: { x: x, y: y + s } },
      // ঘর ৪ এবং ৫ এর মধ্যবর্তী রেখা
      { id: 'div_4_5', p1: { x: x, y: y + s }, p2: { x: x + s, y: y + s } },
      // ঘর ৫ এবং ৬ এর মধ্যবর্তী রেখা
      { id: 'div_5_6', p1: { x: x, y: y + s + rh }, p2: { x: x + s, y: y + s + rh } },
      // ঘর ৬ এর শেষ রেখা (বেসলাইন দাগ)
      { id: 'bot_6', p1: { x: x, y: y + s + rh * 2 }, p2: { x: x + s, y: y + s + rh * 2 } },
      // আয়তক্ষেত্রের বাম পাশ
      { id: 'rect_left', p1: { x: x, y: y + s }, p2: { x: x, y: y + s + rh * 2 } },
      // আয়তক্ষেত্রের ডান পাশ
      { id: 'rect_right', p1: { x: x + s, y: y + s }, p2: { x: x + s, y: y + s + rh * 2 } }
    ];
  }

  // বিন্দু থেকে লাইন সেগমেন্টের দূরত্ব নির্ণয়
  distToSegment(px, py, l) {
    const x1 = l.p1.x, y1 = l.p1.y;
    const x2 = l.p2.x, y2 = l.p2.y;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);

    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
  }

  // বিন্দুটি কোনো বহুভুজের (Polygon) ভিতরে আছে কিনা
  pointInPoly(px, py, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      const intersect = ((yi > py) !== (yj > py)) &&
        (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // একটি বিন্দু কোন ঘরে পড়েছে তা খুঁজে বের করা
  getBoxAtPoint(px, py) {
    for (let i = 1; i <= 6; i++) {
      if (this.pointInPoly(px, py, this.boxes[i].poly)) {
        return i;
      }
    }
    return null;
  }

  // চাড়া কোনো দাগে লেগেছে কিনা যাচাই করা
  checkCharaLineCollision(cx, cy, charaRadius) {
    const threshold = charaRadius + this.lineTolerance;
    let closestDist = Infinity;
    let touchedLine = null;

    for (const line of this.lines) {
      const d = this.distToSegment(cx, cy, line);
      if (d < closestDist) {
        closestDist = d;
        touchedLine = line;
      }
    }

    if (closestDist <= threshold) {
      return { touched: true, distance: closestDist, line: touchedLine };
    }
    return { touched: false, distance: closestDist, line: null };
  }

  // পা দাগে পড়েছে কিনা যাচাই করা
  checkFootLineCollision(fx, fy) {
    const threshold = this.footTolerance;
    let closestDist = Infinity;
    let touchedLine = null;

    for (const line of this.lines) {
      const d = this.distToSegment(fx, fy, line);
      if (d < closestDist) {
        closestDist = d;
        touchedLine = line;
      }
    }

    if (closestDist <= threshold) {
      return { touched: true, distance: closestDist, line: touchedLine };
    }
    return { touched: false, distance: closestDist, line: null };
  }

  // বেসলাইন এলাকা (যেখান থেকে খেলোয়াড় দাঁড়ায় ও চাড়া ছোঁড়ে)
  getBaselineArea() {
    const rh = this.rectHeight;
    const baseY = this.y + this.squareSize + rh * 2;
    const bHeight = Math.max(45, Math.floor(rh * 0.9));
    return {
      x: this.x - 10,
      y: baseY + 5,
      width: this.squareSize + 20,
      height: bHeight,
      center: {
        x: this.x + this.squareSize / 2,
        y: baseY + 5 + bHeight * 0.5
      }
    };
  }

  // গ্রামীণ মাটির উঠোন ও খড়িমাটির দাগ আঁকা
  render(ctx, targetBoxNum = null, activeBoxNum = null, touchedLine = null) {
    ctx.save();

    // বোর্ডের নিচে হালকা ছায়া
    ctx.shadowColor = 'rgba(74, 46, 20, 0.25)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 6;

    // প্রতিটি ঘরের ব্যাকগ্রাউন্ড রঙ
    for (let i = 1; i <= 6; i++) {
      const b = this.boxes[i];
      ctx.beginPath();
      ctx.moveTo(b.poly[0].x, b.poly[0].y);
      for (let k = 1; k < b.poly.length; k++) {
        ctx.lineTo(b.poly[k].x, b.poly[k].y);
      }
      ctx.closePath();

      // লক্ষ্য ঘর হলে সোনালী আভা
      if (targetBoxNum === i) {
        ctx.fillStyle = 'rgba(255, 215, 0, 0.28)';
      } else if (activeBoxNum === i) {
        ctx.fillStyle = 'rgba(102, 187, 106, 0.28)';
      } else {
        ctx.fillStyle = b.color;
      }
      ctx.fill();
    }
    ctx.restore();

    // খড়িমাটির মূল দাগসমূহ আঁকা (সাদা চক লাইন গ্রামীণ টেক্সচার সহ)
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    this.lines.forEach(l => {
      // দাগ স্পর্শ করলে লাল হয়ে জ্বলবে
      const isTouched = touchedLine && touchedLine.id === l.id;

      ctx.beginPath();
      ctx.moveTo(l.p1.x, l.p1.y);
      ctx.lineTo(l.p2.x, l.p2.y);

      if (isTouched) {
        ctx.strokeStyle = '#e53935';
        ctx.lineWidth = 8;
        ctx.shadowColor = '#d32f2f';
        ctx.shadowBlur = 15;
      } else {
        // খড়িমাটির মতো ন্যাচারাল সাদা দাগ
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.lineWidth = 5.5;
        ctx.shadowColor = 'rgba(40, 30, 20, 0.2)';
        ctx.shadowBlur = 3;
      }
      ctx.stroke();

      // ডাবল স্ট্রোক দিয়ে মাটির দাগের মতো বাস্তব রূপ দেওয়া
      if (!isTouched) {
        ctx.strokeStyle = 'rgba(240, 235, 220, 0.4)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    });
    ctx.restore();

    // সংখ্যাগুলো আঁকা (বাংলা হরফ ১, ২, ৩, ৪, ৫, ৬)
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 1; i <= 6; i++) {
      const b = this.boxes[i];
      const isTarget = targetBoxNum === i;
      const fontSize = Math.floor(this.squareSize * 0.16);

      ctx.font = `bold ${fontSize}px 'Hind Siliguri', 'SolaimanLipi', sans-serif`;

      if (isTarget) {
        // লক্ষ্য ঘরে উজ্জ্বল সোনালী ফন্ট ও আভা
        ctx.shadowColor = 'rgba(255, 193, 7, 0.9)';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#b71c1c';
      } else {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 4;
        ctx.fillStyle = '#1a237e';
      }

      ctx.fillText(b.bnNum, b.center.x, b.center.y);
    }
    ctx.restore();

    // শুরুর বেসলাইন রেখা ও নির্দেশিকা (বোর্ডের নিচে)
    const baseArea = this.getBaselineArea();
    ctx.save();
    ctx.fillStyle = 'rgba(255, 248, 225, 0.45)';
    ctx.fillRect(baseArea.x, baseArea.y, baseArea.width, baseArea.height);

    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = 'rgba(121, 85, 72, 0.7)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(baseArea.x, baseArea.y, baseArea.width, baseArea.height);
    ctx.setLineDash([]);

    ctx.font = `600 ${Math.max(11, Math.floor(baseArea.height * 0.26))}px 'Hind Siliguri', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#4e342e';
    ctx.fillText('দাঁড়ানোর জায়গা (সূচনা দাগ)', baseArea.center.x, baseArea.y + baseArea.height * 0.82);
    ctx.restore();
  }
}

window.Board = Board;
