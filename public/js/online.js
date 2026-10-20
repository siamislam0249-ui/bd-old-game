/**
 * এক্কাদোক্কা (কুতকুত) 3D - রিয়েল-টাইম অনলাইন মাল্টিপ্লেয়ার (WebRTC / PeerJS)
 * - Vercel / Render / যে কোনো স্ট্যাটিক হোস্টিংয়ে ১০০% ফ্রিতে চলে
 * - ৪-ডিজিট পিন ও ইনভাইট লিংক দিয়ে পৃথিবীর যেকোনো প্রান্ত থেকে খেলা যায়
 * - সম্পূর্ণ ব্রাউজার-টু-ব্রাউজার (P2P) লো-ল্যাটেন্সি ৩ডি সিঙ্ক
 */

class EkkadokkaOnlineManager {
  constructor(game) {
    this.game = game;
    this.peer = null;
    this.conn = null;
    this.isHost = false;
    this.roomPin = null;
    this.isConnected = false;
    this.pingInterval = null;

    // পিয়ার প্রিফিক্স (ইউনিক রুম নেমস্পেস)
    this.PEER_PREFIX = 'ekka-bd-v3-';

    this.initUI();
    this.checkUrlRoomParam();
  }

  initUI() {
    // ট্যাব সুইচ
    const tabCreate = document.getElementById('tab-create-room');
    const tabJoin = document.getElementById('tab-join-room');
    const panelCreate = document.getElementById('panel-create-room');
    const panelJoin = document.getElementById('panel-join-room');

    if (tabCreate && tabJoin) {
      tabCreate.addEventListener('click', () => {
        window.soundEngine?.playClick();
        tabCreate.classList.add('active');
        tabJoin.classList.remove('active');
        panelCreate.style.display = 'block';
        panelJoin.style.display = 'none';
      });

      tabJoin.addEventListener('click', () => {
        window.soundEngine?.playClick();
        tabJoin.classList.add('active');
        tabCreate.classList.remove('active');
        panelJoin.style.display = 'block';
        panelCreate.style.display = 'none';
      });
    }

    // পিন তৈরি বাটন
    const btnGenPin = document.getElementById('btn-gen-pin');
    if (btnGenPin) {
      btnGenPin.addEventListener('click', () => {
        window.soundEngine?.playClick();
        this.createHostRoom();
      });
    }

    // ইনভাইট লিংক কপি বাটন
    const btnCopyLink = document.getElementById('btn-copy-link');
    if (btnCopyLink) {
      btnCopyLink.addEventListener('click', () => {
        window.soundEngine?.playClick();
        this.copyInviteLink();
      });
    }

    // রুমে যোগ দিন বাটন
    const btnConnect = document.getElementById('btn-connect-room');
    if (btnConnect) {
      btnConnect.addEventListener('click', () => {
        window.soundEngine?.playClick();
        const pinInput = document.getElementById('input-join-pin');
        const pin = pinInput ? pinInput.value.trim() : '';
        if (pin.length < 4) {
          this.setJoinStatus('⚠️ সঠিক ৪ ডিজিটের পিন লিখুন!', '#d32f2f');
          return;
        }
        this.joinGuestRoom(pin);
      });
    }

    // অনলাইন মডাল ক্লোজ বাটন
    const btnClose = document.getElementById('btn-close-online');
    if (btnClose) {
      btnClose.addEventListener('click', () => {
        window.soundEngine?.playClick();
        document.getElementById('online-modal').style.display = 'none';
        document.getElementById('mode-modal').style.display = 'flex';
        this.cleanup();
      });
    }

    // রিঅ্যাকশন ইমোজি বাটনসমূহ
    document.querySelectorAll('.btn-reaction').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const emoji = btn.getAttribute('data-emoji');
        this.sendEmoji(emoji);
      });
    });

    // লাইভ চ্যাট / কমেন্ট বাটন
    const btnOpenChat = document.getElementById('btn-open-chat');
    const chatModal = document.getElementById('chat-modal');
    const btnCloseChat = document.getElementById('btn-close-chat');
    const btnSendChat = document.getElementById('btn-send-chat');
    const chatInput = document.getElementById('chat-input-text');

    if (btnOpenChat && chatModal) {
      btnOpenChat.addEventListener('click', () => {
        window.soundEngine?.playClick();
        chatModal.style.display = 'flex';
        setTimeout(() => chatInput?.focus(), 150);
      });
    }

    if (btnCloseChat && chatModal) {
      btnCloseChat.addEventListener('click', () => {
        window.soundEngine?.playClick();
        chatModal.style.display = 'none';
      });
    }

    const doSendChat = () => {
      const val = chatInput ? chatInput.value.trim() : '';
      if (!val) return;
      this.sendChatMessage(val);
      if (chatInput) chatInput.value = '';
      if (chatModal) chatModal.style.display = 'none';
    };

    if (btnSendChat) {
      btnSendChat.addEventListener('click', doSendChat);
    }

    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          doSendChat();
        }
      });
    }

    // কুইক কমেন্ট চিপস
    document.querySelectorAll('.chat-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const text = chip.innerText.trim();
        this.sendChatMessage(text);
        if (chatModal) chatModal.style.display = 'none';
      });
    });

    // গেম থেকে অনলাইন অ্যাকশন হুক
    this.game.onOnlineAction = (action) => {
      this.sendData(action);
    };
  }

  checkUrlRoomParam() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const roomParam = urlParams.get('room');
      if (roomParam && roomParam.length >= 4) {
        // অটো ফিল এবং ট্যাব সুইচ
        setTimeout(() => {
          const modeModal = document.getElementById('mode-modal');
          const onlineModal = document.getElementById('online-modal');
          if (modeModal) modeModal.style.display = 'none';
          if (onlineModal) onlineModal.style.display = 'flex';

          const tabJoin = document.getElementById('tab-join-room');
          if (tabJoin) tabJoin.click();

          const pinInput = document.getElementById('input-join-pin');
          if (pinInput) {
            pinInput.value = roomParam;
            this.setJoinStatus(`ইনভাইট পিন ${roomParam} পাওয়া গেছে! 'যোগ দিন' চাপুন।`, '#2e7d32');
          }
        }, 500);
      }
    } catch (e) {
      console.warn('URL param parse error:', e);
    }
  }

  // ৪ ডিজিট পিন তৈরি
  generatePin() {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  // ১. হোস্ট রুম তৈরি
  createHostRoom() {
    this.cleanup();
    this.isHost = true;
    this.roomPin = this.generatePin();

    const pinDisplay = document.getElementById('display-pin-code');
    const statusText = document.getElementById('create-status');
    const waitingIndicator = document.getElementById('host-waiting-indicator');
    const btnCopy = document.getElementById('btn-copy-link');

    if (pinDisplay) pinDisplay.innerText = this.roomPin;
    if (statusText) statusText.innerText = 'পিয়ার সার্ভারের সাথে যুক্ত হচ্ছে... ⏳';

    const peerId = this.PEER_PREFIX + this.roomPin;
    this.initPeer(peerId, () => {
      if (statusText) statusText.innerText = 'রুম তৈরি সম্পন্ন! বন্ধুকে এই পিনটি দিন:';
      if (waitingIndicator) waitingIndicator.style.display = 'block';
      if (btnCopy) btnCopy.disabled = false;

      // গেস্ট কানেকশন লিসেন করা
      this.peer.on('connection', (conn) => {
        if (this.conn) {
          // অলরেডি ১ জন গেস্ট আছে (২ জনের গেম)
          conn.close();
          return;
        }
        this.conn = conn;
        this.setupConnectionHandlers();

        // গেস্টকে ওয়েলকাম ও ইনিশিয়াল স্টেট পাঠানো
        setTimeout(() => {
          const myGender = this.game.playerGenders[0] || 'male';
          this.sendData({
            type: 'INIT_START',
            hostGender: myGender,
            roomPin: this.roomPin
          });
          this.startOnlineMatch(true);
        }, 500);
      });
    }, (err) => {
      if (statusText) statusText.innerText = '⚠️ রুম তৈরিতে সমস্যা হয়েছে। আবার চেষ্টা করুন।';
      console.error('Peer host error:', err);
    });
  }

  // ২. গেস্ট হিসেবে রুমে জয়েন
  joinGuestRoom(pin) {
    this.cleanup();
    this.isHost = false;
    this.roomPin = pin;

    this.setJoinStatus('রুমে সংযোগ স্থাপন করা হচ্ছে... ⏳', '#e65100');

    const guestPeerId = this.PEER_PREFIX + 'guest-' + Math.floor(Math.random() * 100000);
    this.initPeer(guestPeerId, () => {
      const hostPeerId = this.PEER_PREFIX + pin;
      this.conn = this.peer.connect(hostPeerId, {
        reliable: true
      });

      this.setupConnectionHandlers();

      this.conn.on('open', () => {
        this.setJoinStatus('সংযুক্ত হয়েছে! খেলা প্রস্তুত হচ্ছে... 🚀', '#2e7d32');
        const myGender = this.game.playerGenders[1] || 'female';
        this.sendData({
          type: 'GUEST_JOINED',
          guestGender: myGender
        });
        this.startOnlineMatch(false);
      });
    }, (err) => {
      this.setJoinStatus('⚠️ সংযোগ ব্যর্থ! পিন সঠিক কিনা ও ইন্টারনেট চেক করুন।', '#d32f2f');
      console.error('Peer guest error:', err);
    });
  }

  // PeerJS ইনিশিয়ালাইজেশন
  initPeer(peerId, onOpen, onError) {
    if (typeof Peer === 'undefined') {
      if (onError) onError('PeerJS not loaded');
      return;
    }

    try {
      this.peer = new Peer(peerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      this.peer.on('open', (id) => {
        if (onOpen) onOpen(id);
      });

      this.peer.on('error', (err) => {
        if (onError) onError(err);
      });

      this.peer.on('disconnected', () => {
        this.peer.reconnect();
      });
    } catch (e) {
      if (onError) onError(e);
    }
  }

  // কানেকশন ইভেন্ট হ্যান্ডলার
  setupConnectionHandlers() {
    if (!this.conn) return;

    this.conn.on('data', (data) => {
      this.handleIncomingData(data);
    });

    this.conn.on('close', () => {
      this.handlePeerDisconnect();
    });

    this.conn.on('error', (err) => {
      console.warn('Connection error:', err);
      this.handlePeerDisconnect();
    });

    // কিপ-অ্যালাইভ পিং
    clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.conn && this.conn.open) {
        this.conn.send({ type: 'PING' });
      }
    }, 10000);
  }

  // ডেটা পাঠানো
  sendData(data) {
    if (this.conn && this.conn.open) {
      try {
        this.conn.send(data);
      } catch (e) {
        console.warn('Send error:', e);
      }
    }
  }

  // ডেটা গ্রহণ ও প্রসেসিং
  handleIncomingData(data) {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'PING':
        // কিপ অ্যালাইভ
        break;

      case 'INIT_START':
        if (data.hostGender) {
          this.game.setPlayerGender(0, data.hostGender);
        }
        break;

      case 'GUEST_JOINED':
        if (data.guestGender) {
          this.game.setPlayerGender(1, data.guestGender);
        }
        break;

      case 'EMOJI':
        this.showFloatingEmoji(data.emoji, false);
        break;

      case 'CHAT_MSG':
        this.showLiveComment(data.sender || 'বন্ধু', data.text, false);
        break;

      default:
        // ৩ডি গেম ইঞ্জিনে ফরওয়ার্ড
        this.game.handleRemoteOnlineAction(data);
        break;
    }
  }

  // অনলাইন ম্যাচ শুরু
  startOnlineMatch(isHost) {
    this.isConnected = true;
    document.getElementById('online-modal').style.display = 'none';
    document.getElementById('mode-modal').style.display = 'none';

    // HUD অনলাইন ইন্ডিকেটর
    const turnBadge = document.getElementById('turn-badge');
    if (turnBadge) {
      turnBadge.innerHTML = `🟢 লাইভ অনলাইন (রুম: ${this.roomPin})`;
    }

    // ফ্লোটিং ইমোজি প্যানেল প্রদর্শন
    const emojiBar = document.getElementById('online-reactions-bar');
    if (emojiBar) emojiBar.style.display = 'flex';

    window.soundEngine?.playSuccess();

    // গেমে মোড সেট
    this.game.onlineRole = isHost ? 'host' : 'guest';
    this.game.myPlayerIdx = isHost ? 0 : 1;
    this.game.playerNames = isHost ? ['আপনি (হোস্ট)', 'বন্ধু (গেস্ট)'] : ['বন্ধু (হোস্ট)', 'আপনি (গেস্ট)'];

    this.game.startNewGame('online');
  }

  // প্রতিপক্ষ সংযোগ বিচ্ছিন্ন হলে
  handlePeerDisconnect() {
    if (!this.isConnected) return;
    this.isConnected = false;

    window.soundEngine?.playFoul();
    alert('⚠️ অপর প্রান্তের খেলোয়াড় সংযোগ বিচ্ছিন্ন করেছে বা গেম থেকে বের হয়ে গেছে।');

    // রিসেট
    this.cleanup();
    document.getElementById('mode-modal').style.display = 'flex';
    const emojiBar = document.getElementById('online-reactions-bar');
    if (emojiBar) emojiBar.style.display = 'none';
  }

  // ইনভাইট লিংক কপি
  copyInviteLink() {
    if (!this.roomPin) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${this.roomPin}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        this.showCopyFeedback();
      }).catch(() => this.fallbackCopyText(url));
    } else {
      this.fallbackCopyText(url);
    }
  }

  fallbackCopyText(text) {
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    try {
      document.execCommand('copy');
      this.showCopyFeedback();
    } catch (e) {
      alert(`লিংকটি কপি করুন:\n${text}`);
    }
    document.body.removeChild(input);
  }

  showCopyFeedback() {
    const btn = document.getElementById('btn-copy-link');
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = '✅ লিংক কপি হয়েছে!';
      btn.style.background = '#388e3c';
      setTimeout(() => {
        btn.innerHTML = orig;
        btn.style.background = '#0288d1';
      }, 2500);
    }
  }

  setJoinStatus(msg, color) {
    const el = document.getElementById('join-status-msg');
    if (el) {
      el.innerText = msg;
      el.style.color = color || '#3e2723';
    }
  }

  // ইমোজি পাঠানো
  sendEmoji(emoji) {
    this.showFloatingEmoji(emoji, true);
    this.sendData({
      type: 'EMOJI',
      emoji: emoji
    });
  }

  // ফ্লোটিং ইমোজি অ্যানিমেশন
  showFloatingEmoji(emoji, isSelf) {
    const container = document.getElementById('game-app');
    if (!container) return;

    const el = document.createElement('div');
    el.className = 'floating-emoji-item';
    el.innerText = emoji;
    el.style.left = isSelf ? '75%' : '25%';
    el.style.bottom = '120px';

    container.appendChild(el);
    window.soundEngine?.playClick();

    setTimeout(() => {
      el.remove();
    }, 2200);
  }

  // লাইভ কমেন্ট পাঠানো
  sendChatMessage(text) {
    if (!text || !text.trim()) return;
    const cleanText = text.trim();

    // নিজের স্ক্রিনে সাথে সাথে বার্তা ভাসবে
    this.showLiveComment('আপনি', cleanText, true);

    if (this.isConnected && this.conn) {
      const senderLabel = this.isHost ? 'হোস্ট' : 'বন্ধু';
      this.sendData({
        type: 'CHAT_MSG',
        sender: senderLabel,
        text: cleanText
      });
    } else if (this.game.mode === 'p_vs_ai') {
      this.scheduleAIReply(cleanText);
    }
  }

  // লাইভ কমেন্ট বেলুন প্রদর্শন (স্ক্রিনে ভেসে থাকবে এবং অটো মুছে যাবে)
  showLiveComment(sender, text, isSelf) {
    const container = document.getElementById('chat-balloon-container');
    if (!container) return;

    // সর্বোচ্চ ৩টি সাম্প্রতিক মেসেজ রাখা
    while (container.children.length >= 3) {
      container.children[0].remove();
    }

    const balloon = document.createElement('div');
    balloon.className = `live-chat-balloon ${isSelf ? 'self' : 'peer'}`;

    const cleanSender = String(sender || 'বন্ধু').substring(0, 16);
    const cleanText = String(text || '').substring(0, 80);

    balloon.innerHTML = `
      <div class="chat-balloon-header">
        <span class="chat-avatar">${isSelf ? '🗣️' : '💬'}</span>
        <span class="chat-sender-name">${cleanSender}</span>
      </div>
      <div class="chat-balloon-text">${cleanText}</div>
    `;

    container.appendChild(balloon);
    window.soundEngine?.playClick();

    // ৪.৫ সেকেন্ড পর স্মুথলি আউট
    setTimeout(() => {
      balloon.classList.add('fade-out');
      setTimeout(() => balloon.remove(), 400);
    }, 4500);
  }

  // কম্পিউটারের মজার প্রতিউত্তর
  scheduleAIReply(userMsg) {
    const aiReplies = [
      'হাহাহা, দেখি কেমন পারো! 😈',
      'এক্কাদোক্কায় আমার সাথে পারবে না! 😎',
      'সাবধানে খেলো, দাগে যেন না লাগে! 😜',
      'এবার কিন্তু আমার পালা আসছে! 🎯',
      'বাহ্ দারুণ খেলছো তো! 🔥',
      '৫০ পয়েন্ট কিন্তু আমিই আগে করব! 🏆'
    ];
    setTimeout(() => {
      const reply = aiReplies[Math.floor(Math.random() * aiReplies.length)];
      this.showLiveComment('বল্টু (কম্পিউটার)', reply, false);
    }, 1500);
  }

  cleanup() {
    clearInterval(this.pingInterval);
    if (this.conn) {
      try { this.conn.close(); } catch (e) {}
      this.conn = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }
    this.isConnected = false;
    this.isHost = false;
    this.roomPin = null;

    const wait = document.getElementById('host-waiting-indicator');
    if (wait) wait.style.display = 'none';
  }
}

window.EkkadokkaOnlineManager = EkkadokkaOnlineManager;
