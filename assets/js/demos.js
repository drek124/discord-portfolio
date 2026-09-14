(function () {
  "use strict";

  var api = window.portfolio || {};
  var qs = api.qs || function (selector, scope) { return (scope || document).querySelector(selector); };
  var qsa = api.qsa || function (selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  };
  var toast = api.toast || function () {};
  var sfx = api.sfx || {
    click: function () {}, tick: function () {}, win: function () {},
    lose: function () {}, warn: function () {}, alert: function () {}, confirm: function () {}
  };
  var reduceMotion = Boolean(api.reduceMotion);

  var EMOTE_BASE = "assets/emotes/";
  var EMOTES = {
    wave: "peanut-01.png",
    yes: "peanut-02.png",
    laugh: "peanut-03.png",
    peek: "peanut-04.png",
    shock: "peanut-05.png",
    squee: "peanut-06.png",
    no: "peanut-07.png",
    event: "peanut-08.png",
    love: "peanut-09.png",
    cozy: "peanut-10.png",
    sus: "peanut-11.png",
    sad: "peanut-12.png",
    sobbing: "peanut-13.png",
    jackpot: "peanut-14.png",
    grr: "peanut-15.png",
    officer: "peanut-16.png"
  };

  function emote(key) {
    return EMOTE_BASE + EMOTES[key];
  }

  function shuffle(list) {
    var copy = list.slice();
    for (var i = copy.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function formatNumber(value, decimals) {
    if (!isFinite(value)) {
      return "0";
    }
    return value.toLocaleString("en-US", {
      minimumFractionDigits: decimals || 0,
      maximumFractionDigits: decimals || 0
    });
  }

  var DOT = String.fromCharCode(183);
  var ARROW = String.fromCharCode(8594);
  var PLUSMINUS = String.fromCharCode(177);
  var INFINITY_SIGN = String.fromCharCode(8734);
  var ELLIPSIS = String.fromCharCode(8230);

  function clockStamp() {
    var now = new Date();
    return [now.getHours(), now.getMinutes(), now.getSeconds()].map(function (part) {
      return String(part).padStart(2, "0");
    }).join(":");
  }

  function makeLogger(elementId, limit) {
    var root = qs("#" + elementId);
    var max = limit || 60;

    return function (message, kind) {
      if (!root) {
        return;
      }
      var line = document.createElement("div");
      line.className = "log-line" + (kind ? " is-" + kind : "");
      var time = document.createElement("time");
      time.textContent = clockStamp();
      var text = document.createElement("span");
      text.textContent = message;
      line.appendChild(time);
      line.appendChild(text);
      root.appendChild(line);
      while (root.children.length > max) {
        root.removeChild(root.firstChild);
      }
      root.scrollTop = root.scrollHeight;
    };
  }

  (function economy() {
    var balanceEl = qs("#ecoBalance");
    var deltaEl = qs("#ecoDelta");
    var msgEl = qs("#slotMsg");
    var spinBtn = qs("#spinBtn");
    var dailyBtn = qs("#dailyBtn");
    var flipBtn = qs("#flipBtn");
    var betInput = qs("#betInput");
    var reels = qsa("[data-reel]");
    var log = makeLogger("ecoLog", 40);

    if (!balanceEl || !spinBtn || reels.length !== 3) {
      return;
    }

    var symbols = [
      { key: "grapes", art: "\uD83C\uDF47", weight: 30 },
      { key: "cherry", art: "\uD83C\uDF52", weight: 26 },
      { key: "lemon", art: "\uD83C\uDF4B", weight: 22 },
      { key: "bell", art: "\uD83D\uDD14", weight: 15 },
      { key: "moon", art: "\uD83C\uDF19", weight: 10 },
      { key: "gem", art: "\uD83D\uDC8E", weight: 6 },
      { key: "seven", art: "7\uFE0F\u20E3", weight: 4 },
      { key: "coin", art: "\uD83D\uDCB0", weight: 3 }
    ];

    var payouts = {
      grapes: 4,
      cherry: 5,
      lemon: 6,
      bell: 8,
      moon: 12,
      gem: 22,
      seven: 55,
      coin: 180
    };

    var balance = 1000;
    var starting = 1000;
    var dailyReady = true;
    var spinning = false;
    var busy = false;

    var weighted = [];
    symbols.forEach(function (symbol) {
      for (var i = 0; i < symbol.weight; i += 1) {
        weighted.push(symbol);
      }
    });

    function draw() {
      return pick(weighted);
    }

    function renderBalance(bump) {
      balanceEl.textContent = formatNumber(Math.max(0, Math.floor(balance)), 0);
      var delta = Math.floor(balance) - starting;
      deltaEl.textContent = (delta > 0 ? "+" : "") + formatNumber(delta, 0);
      deltaEl.classList.toggle("is-up", delta > 0);
      deltaEl.classList.toggle("is-down", delta < 0);
      if (bump) {
        balanceEl.classList.toggle("is-up", bump === "up");
        balanceEl.classList.toggle("is-down", bump === "down");
        window.setTimeout(function () {
          balanceEl.classList.remove("is-up", "is-down");
        }, 700);
      }
    }

    function buildStrip(strip, count) {
      strip.innerHTML = "";
      for (var i = 0; i < count; i += 1) {
        var symbol = draw();
        var cell = document.createElement("div");
        cell.className = "reel__symbol";
        cell.textContent = symbol.art;
        strip.appendChild(cell);
      }
    }

    function prepareStrips() {
      reels.forEach(function (reel) {
        var strip = qs(".reel__strip", reel);
        buildStrip(strip, 3);
        strip.style.transition = "none";
        strip.style.transform = "translateY(0px)";
      });
    }

    prepareStrips();

    function spinReel(reel, finalSymbol, duration) {
      return new Promise(function (resolve) {
        var strip = qs(".reel__strip", reel);
        var sequence = [];
        for (var i = 0; i < 22; i += 1) {
          sequence.push(draw().art);
        }
        sequence.push(finalSymbol.art);
        sequence.push(draw().art);

        strip.innerHTML = "";
        sequence.forEach(function (art) {
          var cell = document.createElement("div");
          cell.className = "reel__symbol";
          cell.textContent = art;
          strip.appendChild(cell);
        });

        strip.style.transition = "none";
        strip.style.transform = "translateY(0px)";
        reel.classList.add("is-spinning");
        reel.classList.remove("is-win");

        var distance = (sequence.length - 2) * 88;
        void strip.offsetHeight;

        strip.style.transition = "transform " + duration + "ms cubic-bezier(0.12, 0.72, 0.16, 1)";
        strip.style.transform = "translateY(-" + distance + "px)";

        window.setTimeout(function () {
          reel.classList.remove("is-spinning");
          resolve();
        }, reduceMotion ? 60 : duration + 40);
      });
    }

    function readBet() {
      var value = parseInt(betInput.value, 10);
      if (isNaN(value) || value < 10) {
        value = 10;
      }
      if (value > balance) {
        value = Math.floor(balance);
      }
      betInput.value = String(value);
      return value;
    }

    function finishSpin(result, bet) {
      var wins = result[0].key === result[1].key && result[1].key === result[2].key;
      var pair = !wins && (result[0].key === result[1].key || result[1].key === result[2].key || result[0].key === result[2].key);

      if (wins) {
        var multiplier = payouts[result[0].key];
        var payout = bet * multiplier;
        balance += payout;
        reels.forEach(function (reel) { reel.classList.add("is-win"); });
        msgEl.className = "slots__msg is-win";
        msgEl.textContent = "TRIPLE " + result[0].art + " paid " + formatNumber(payout, 0) + " d$ (" + multiplier + "x)";
        log("Jackpot line: " + result[0].art + " x3 " + DOT + " payout " + formatNumber(payout, 0) + " d$", "hot");
        sfx.win();
        renderBalance("up");
        return;
      }

      if (pair) {
        var refund = Math.floor(bet * 1.4);
        balance += refund;
        msgEl.className = "slots__msg";
        msgEl.textContent = "Two of a kind, returned " + formatNumber(refund, 0) + " d$";
        log("Near miss: pair found " + DOT + " refund " + formatNumber(refund, 0) + " d$", "warn");
        sfx.click();
        renderBalance("up");
        return;
      }

      msgEl.className = "slots__msg is-loss";
      msgEl.textContent = "No line. The house keeps your " + formatNumber(bet, 0) + " d$.";
      log("Spin lost " + formatNumber(bet, 0) + " d$", "err");
      sfx.lose();
      renderBalance("down");
    }

    function spin() {
      if (spinning) {
        return;
      }
      var bet = readBet();
      if (balance < 10) {
        msgEl.className = "slots__msg is-loss";
        msgEl.textContent = "Wallet empty. Claim your hourly stipend.";
        log("Spin refused: insufficient balance", "err");
        sfx.warn();
        return;
      }

      spinning = true;
      spinBtn.disabled = true;
      balance -= bet;
      renderBalance("down");
      msgEl.className = "slots__msg";
      msgEl.textContent = "Spinning" + ELLIPSIS;
      log("Spin committed " + DOT + " bet " + formatNumber(bet, 0) + " d$", "info");

      var result = [draw(), draw(), draw()];
      var durations = [900, 1250, 1620];

      Promise.all(reels.map(function (reel, index) {
        return spinReel(reel, result[index], durations[index]);
      })).then(function () {
        finishSpin(result, bet);
        spinning = false;
        spinBtn.disabled = false;
      });
    }

    function claimDaily() {
      if (!dailyReady) {
        msgEl.className = "slots__msg is-loss";
        msgEl.textContent = "Hourly stipend already claimed.";
        log("Claim refused: cooldown active", "warn");
        sfx.warn();
        return;
      }
      dailyReady = false;
      var amount = 250 + Math.floor(Math.random() * 4) * 50;
      balance += amount;
      dailyBtn.disabled = true;
      dailyBtn.textContent = "Claimed (+" + formatNumber(amount, 0) + " d$)";
      log("Hourly stipend claimed " + DOT + " +" + formatNumber(amount, 0) + " d$", "ok");
      msgEl.className = "slots__msg is-win";
      msgEl.textContent = "Stipend banked: " + formatNumber(amount, 0) + " d$.";
      sfx.confirm();
      renderBalance("up");
    }

    function coinflip() {
      if (busy) {
        return;
      }
      var bet = readBet();
      if (balance < bet || bet < 10) {
        msgEl.className = "slots__msg is-loss";
        msgEl.textContent = "Not enough d$ for that flip.";
        log("Coinflip refused: bet exceeds wallet", "warn");
        sfx.warn();
        return;
      }

      busy = true;
      var won = Math.random() < 0.48;
      balance += won ? bet : -bet;
      msgEl.className = won ? "slots__msg is-win" : "slots__msg is-loss";
      msgEl.textContent = won
        ? "Heads. You doubled to " + formatNumber(bet * 2, 0) + " d$."
        : "Tails. " + formatNumber(bet, 0) + " d$ gone.";
      log("Coinflip " + (won ? "won" : "lost") + " " + formatNumber(bet, 0) + " d$", won ? "ok" : "err");
      if (won) { sfx.win(); } else { sfx.lose(); }
      renderBalance(won ? "up" : "down");
      window.setTimeout(function () { busy = false; }, 320);
    }

    spinBtn.addEventListener("click", spin);
    dailyBtn.addEventListener("click", claimDaily);
    flipBtn.addEventListener("click", coinflip);

    qsa(".mini-btn", qs(".bet-row__quick")).forEach(function (button) {
      button.addEventListener("click", function () {
        var mode = button.getAttribute("data-bet");
        if (mode === "half") {
          betInput.value = String(Math.max(10, Math.floor(balance / 2)));
        } else if (mode === "all") {
          betInput.value = String(Math.max(10, Math.floor(balance)));
        } else {
          betInput.value = mode;
        }
        sfx.click();
      });
    });

    betInput.addEventListener("change", readBet);
    renderBalance(false);
    log("Economy service online " + DOT + " currency d$ " + DOT + " odds table v9 loaded", "ok");
  })();

  (function joinGate() {
    var grid = qs("#colourGrid");
    var prompt = qs("#gatePrompt");
    var resetBtn = qs("#gateReset");
    var stateEl = qs("#gateState");
    var userEl = qs("#gateUser");
    var timerText = qs("#gateTimerText");
    var timerRing = qs("#gateTimerRing");
    var log = makeLogger("gateLog", 40);

    if (!grid || !prompt) {
      return;
    }

    var colours = [
      { name: "red", hex: "#ee4b4b", ink: "#ffffff" },
      { name: "blue", hex: "#4b7bee", ink: "#ffffff" },
      { name: "green", hex: "#3ddc84", ink: "#04170f" },
      { name: "yellow", hex: "#f5c542", ink: "#2a2000" },
      { name: "purple", hex: "#9b5cf6", ink: "#ffffff" },
      { name: "orange", hex: "#f2892f", ink: "#2a1600" }
    ];

    var zalgoMarks = [
      "\u0300", "\u0301", "\u0302", "\u0303", "\u0308", "\u030A",
      "\u0327", "\u0328", "\u0330", "\u0331", "\u0332", "\u0335",
      "\u0336", "\u0337", "\u0338", "\u0342", "\u0344", "\u0345"
    ];

    var strikes = 0;
    var target = null;
    var buttons = [];
    var timeLeft = 20;
    var timerHandle = null;
    var finished = false;
    var attempts = 0;

    var suspects = [
      "Raid_Account_8842",
      "qz7f2k9wlm41",
      "FreeNitro_x91",
      "discorduser2024",
      "NewMember_7731",
      "aishf82jdn3",
      "ValuedCustomer",
      "xvx_sniper_vx"
    ];

    function zalgo(word, intensity) {
      var out = "";
      for (var i = 0; i < word.length; i += 1) {
        out += word[i];
        var marks = intensity;
        if (i > 0 && i < word.length - 1) {
          marks += Math.floor(Math.random() * 2);
        }
        for (var m = 0; m < marks; m += 1) {
          out += zalgoMarks[Math.floor(Math.random() * zalgoMarks.length)];
        }
      }
      return out;
    }

    function buildGrid() {
      grid.innerHTML = "";
      buttons = [];
      attempts = 0;
      target = pick(colours);
      var decoys = shuffle(colours.filter(function (colour) {
        return colour.name !== target.name;
      })).slice(0, 5);
      var options = shuffle(decoys.concat([target]));

      prompt.innerHTML = "Press the button with the color: <strong>" + zalgo(target.name, 1) + "</strong>.";

      options.forEach(function (color) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "colour-btn";
        button.style.setProperty("--swatch", color.hex);
        button.style.setProperty("--ink", color.ink);
        button.setAttribute("data-colour", color.name);

        button.addEventListener("click", function () {
          choose(color, button);
        });

        grid.appendChild(button);
        buttons.push(button);
      });

      finished = false;
      stateEl.textContent = "QUARANTINED";
      stateEl.classList.remove("is-danger", "is-ok");
      userEl.textContent = pick(suspects);
      startTimer();
    }

    function stopTimer() {
      if (timerHandle) {
        window.clearInterval(timerHandle);
        timerHandle = null;
      }
    }

    function paintTimer() {
      if (timerText) {
        timerText.textContent = timeLeft + "s";
      }
      if (timerRing) {
        var circumference = 97.4;
        var ratio = clamp(timeLeft / 20, 0, 1);
        timerRing.style.strokeDashoffset = String(circumference * (1 - ratio));
        timerRing.style.stroke = timeLeft <= 6 ? "#ee4b4b" : timeLeft <= 12 ? "#f5c542" : "#7d88ff";
      }
    }

    function startTimer() {
      stopTimer();
      timeLeft = 20;
      paintTimer();
      timerHandle = window.setInterval(function () {
        timeLeft -= 1;
        paintTimer();
        if (timeLeft <= 0) {
          stopTimer();
          if (!finished) {
            fail("Challenge expired for " + userEl.textContent + " " + DOT + " member kicked");
          }
        }
      }, 1000);
    }

    function reveal() {
      buttons.forEach(function (button) {
        var isTarget = button.getAttribute("data-colour") === target.name;
        if (isTarget) {
          button.classList.add("is-target");
        } else {
          button.classList.add("is-faded");
        }
      });
    }

    function choose(colour, button) {
      if (finished) {
        return;
      }
      attempts += 1;
      if (colour.name === target.name) {
        pass(button);
      } else {
        button.classList.add("is-wrong");
        sfx.warn();
        if (attempts >= 3) {
          fail("Three wrong colours chosen by " + userEl.textContent);
        } else {
          log("Wrong colour pressed: " + colour.name + " (attempt " + attempts + " of 3)", "warn");
        }
      }
    }

    function fail(message) {
      finished = true;
      stopTimer();
      strikes += 1;
      reveal();
      stateEl.textContent = "STRIKE " + strikes + "/3";
      stateEl.classList.add("is-danger");
      log(message + " (strike " + strikes + ")", "err");
      sfx.alert();
      buttons.forEach(function (button) {
        button.disabled = true;
      });

      if (strikes >= 3) {
        log("Three strikes reached " + DOT + " auto-ban queued for " + userEl.textContent, "err");
        stateEl.textContent = "AUTO-BAN";
        toast("Gate slammed: " + userEl.textContent + " auto-banned", "err");
      } else {
        toast("Verification failed " + DOT + " strike " + strikes + " of 3", "err");
      }
    }

    function pass(button) {
      finished = true;
      stopTimer();
      strikes = 0;
      stateEl.textContent = "VERIFIED";
      stateEl.classList.add("is-ok");
      button.classList.add("is-target");
      log("Colour challenge solved in " + (20 - timeLeft) + "s " + DOT + " verified role granted", "ok");
      log("Scrapers read the zalgo prompt as noise " + DOT + " the member read it fine", "info");
      sfx.win();
      toast("Verified " + DOT + " welcome to the server!", "ok");
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        stopTimer();
        buildGrid();
        log("Gate reset " + DOT + " new colour challenge issued", "info");
      });
    }

    grid.addEventListener("keydown", function (event) {
      var items = qsa(".colour-btn", grid);
      var index = items.indexOf(document.activeElement);
      if (index === -1) {
        return;
      }
      var next = index;
      if (event.key === "ArrowRight") { next = (index + 1) % items.length; }
      else if (event.key === "ArrowLeft") { next = (index + items.length - 1) % items.length; }
      else if (event.key === "ArrowDown") { next = (index + 3) % items.length; }
      else if (event.key === "ArrowUp") { next = (index + items.length - 3) % items.length; }
      else { return; }
      event.preventDefault();
      items[next].focus();
    });

    buildGrid();
    log("Join gate armed " + DOT + " quarantine role applied on join", "ok");
    log("Zalgo layer active " + DOT + " prompt text obfuscated for scrapers", "info");
    log("New member " + userEl.textContent + " held at the gate", "warn");
  })();

  (function mlDetection() {
    var input = qs("#mlName");
    var scanBtn = qs("#mlScan");
    var fill = qs("#mlFill");
    var scoreEl = qs("#mlScore");
    var verdictEl = qs("#mlVerdict");
    var signalsEl = qs("#mlSignals");
    var log = makeLogger("mlLog", 40);

    if (!input || !scanBtn || !signalsEl) {
      return;
    }

    var dictionary = [
      "raptor", "ninja", "dragon", "gamer", "shadow", "sniper", "wolf", "master",
      "drek", "lover", "discord", "user", "free", "nitro", "steam", "squad",
      "king", "queen", "dark", "fire", "storm", "blade", "ghost", "void",
      "killer", "pro", "epic", "legend", "sword", "pixel", "cosmic", "frost"
    ];

    var botTokens = ["bot", "raid", "alt", "farm", "spam", "adm", "mint", "drop"];

    function entropyOf(text) {
      var counts = {};
      for (var i = 0; i < text.length; i += 1) {
        counts[text[i]] = (counts[text[i]] || 0) + 1;
      }
      var entropy = 0;
      Object.keys(counts).forEach(function (key) {
        var p = counts[key] / text.length;
        entropy -= p * Math.log2(p);
      });
      return entropy;
    }

    function featureSet(rawName) {
      var name = rawName.trim();
      var lower = name.toLowerCase();
      var letters = lower.replace(/[^a-z]/g, "");
      var digits = lower.replace(/[^0-9]/g, "");
      var special = lower.replace(/[a-z0-9]/g, "");
      var vowelRun = lower.replace(/[^aeiou]/g, "");
      var digitRatio = name.length ? digits.length / name.length : 0;
      var specialRatio = name.length ? special.length / name.length : 0;
      var vowelRatio = letters.length ? vowelRun.length / letters.length : 0;
      var entropy = entropyOf(lower) / 4.7;
      var runs = (lower.match(/(.)\1{2,}/g) || []).length;
      var keyboardRuns = (lower.match(/(qwer|wert|erty|rtyu|tyui|yuio|uiop|asdf|sdfg|dfgh|fghj|ghjk|hjkl|zxcv|xcvb|cvbn|vbnm)/g) || []).length;
      var tailMatch = lower.match(/\d{3,}$/);
      var digitTails = tailMatch ? 1 : 0;
      var digraphs = 0;
      var trigrams = 0;
      var matches = [];

      for (var i = 0; i < letters.length - 1; i += 1) {
        var pairText = letters.slice(i, i + 2);
        if (dictionary.indexOf(pairText) !== -1) {
          digraphs += 1;
        }
      }

      dictionary.forEach(function (word) {
        if (word.length >= 4 && letters.indexOf(word) !== -1) {
          trigrams += 1;
          matches.push(word);
        }
      });

      botTokens.forEach(function (token) {
        if (lower.indexOf(token) !== -1) {
          trigrams += 1;
          matches.push(token);
        }
      });

      var humanScore =
        Math.min(letters.length / 10, 1) * 0.55 +
        Math.min(trigrams / 2, 1) * 0.9 +
        Math.min(vowelRatio, 0.55) * 0.7 +
        Math.min(digraphs / 3, 1) * 0.35;

      var botScore =
        Math.min(digits.length / 5, 1) * 1.1 +
        Math.min(digitTails * 0.6, 1.1) +
        entropy * 0.95 +
        Math.min(runs / 2, 1) * 0.5 +
        Math.min(keyboardRuns, 1) * 0.95 +
        (letters.length > 0 && letters.length <= 4 ? 0.85 : 0) +
        Math.min(specialRatio * 2.2, 1) * 0.3;

      var total = humanScore + botScore;
      var probability = total > 0 ? botScore / total : 0.5;
      probability = clamp(probability, 0.01, 0.99);

      var keyboardDetected = keyboardRuns > 0 || /(.)\1{2,}/.test(lower);

      return {
        name: name,
        probability: probability,
        dictionaryHits: matches.slice(0, 3),
        rows: [
          { name: "digit density", value: digitRatio, text: (digitRatio * 100).toFixed(0) + "%" },
          { name: "char entropy", value: entropy, text: entropyOf(lower).toFixed(2) },
          { name: "keyboard walk", value: keyboardDetected ? 0.92 : 0.05, text: keyboardDetected ? "detected" : "clean" },
          { name: "digit tail", value: digitTails > 0 ? 0.95 : 0.04, text: tailMatch ? tailMatch[0] : "none" },
          { name: "dictionary match", value: matches.length ? 0.9 : 0.08, text: matches.length ? matches.slice(0, 2).join(", ") : "none" },
          { name: "special chars", value: specialRatio * 2 > 1 ? 1 : specialRatio * 2, text: String(special.length) },
          { name: "vowel balance", value: 1 - Math.min(vowelRatio * 1.7, 1), text: (vowelRatio * 100).toFixed(0) + "%" },
          { name: "length prior", value: name.length <= 4 ? 0.85 : name.length >= 8 ? 0.1 : 0.4, text: String(name.length) + " chars" }
        ]
      };
    }

    function verdictFor(probability) {
      if (probability >= 0.68) {
        return { text: "BLOCK " + DOT + " automated", cls: "t-err" };
      }
      if (probability >= 0.35) {
        return { text: "REVIEW " + DOT + " suspicious", cls: "t-warn" };
      }
      return { text: "ALLOW " + DOT + " human", cls: "t-ok" };
    }

    function renderSignals(rows) {
      signalsEl.innerHTML = "";
      rows.forEach(function (row) {
        var item = document.createElement("div");
        item.className = "signal " + (row.value >= 0.6 ? "is-hot" : row.value >= 0.32 ? "is-warm" : "is-calm");

        var head = document.createElement("div");
        head.className = "signal__head";
        var name = document.createElement("span");
        name.className = "signal__name";
        name.textContent = row.name;
        var value = document.createElement("span");
        value.className = "signal__val";
        value.textContent = row.text;
        head.appendChild(name);
        head.appendChild(value);

        var bar = document.createElement("div");
        bar.className = "signal__bar";
        var inner = document.createElement("i");
        bar.appendChild(inner);

        item.appendChild(head);
        item.appendChild(bar);
        signalsEl.appendChild(item);

        window.setTimeout(function () {
          inner.style.width = (clamp(row.value, 0, 1) * 100).toFixed(0) + "%";
        }, 60);
      });
    }

    function analyse() {
      var name = input.value.trim();
      if (!name) {
        toast("Enter a username to analyse", "info");
        sfx.warn();
        return;
      }

      var result = featureSet(name);
      var percent = result.probability * 100;
      var verdict = verdictFor(result.probability);

      fill.style.width = "0%";
      scoreEl.textContent = "0.0";
      verdictEl.textContent = "classifying" + ELLIPSIS;
      verdictEl.className = "";

      renderSignals(result.rows);

      window.setTimeout(function () {
        fill.style.width = percent.toFixed(1) + "%";
        scoreEl.textContent = percent.toFixed(1);
        verdictEl.textContent = verdict.text;
        verdictEl.classList.add(verdict.cls.replace("t-", "verdict-"));
      }, 120);

      log("Scored \"" + result.name + "\" " + ARROW + " " + percent.toFixed(1) + "% bot likelihood", result.probability >= 0.68 ? "err" : result.probability >= 0.35 ? "warn" : "ok");

      if (result.dictionaryHits.length) {
        log("Dictionary hits: " + result.dictionaryHits.join(", "), "info");
      }
      if (result.probability >= 0.68) {
        log("Action: account quarantined and reported to mod queue", "err");
        sfx.alert();
      } else if (result.probability >= 0.35) {
        log("Action: routed to manual review queue", "warn");
        sfx.warn();
      } else {
        log("Action: allowed through the gate", "ok");
        sfx.confirm();
      }
    }

    scanBtn.addEventListener("click", analyse);

    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        analyse();
      }
    });

    qsa(".mini-btn[data-sample]").forEach(function (button) {
      button.addEventListener("click", function () {
        input.value = button.getAttribute("data-sample");
        analyse();
      });
    });

    input.addEventListener("input", function () {
      var result = featureSet(input.value);
      var percent = result.probability * 100;
      fill.style.width = percent.toFixed(1) + "%";
      scoreEl.textContent = percent.toFixed(1);
      var live = verdictFor(result.probability);
      verdictEl.textContent = live.text;
      verdictEl.className = "";
      verdictEl.classList.add(live.cls.replace("t-", "verdict-"));
    });

    analyse();
    log("Browser heuristic loaded " + DOT + " 8 features " + DOT + " simplified stand-in only", "warn");
    log("Reminder: this page is a simulation, not the production model", "info");
  })();

  (function antiNuke() {
    var scoreEl = qs("#threatScore");
    var ring = qs("#threatRing");
    var stateEl = qs("#nukeState");
    var log = makeLogger("nukeLog", 60);
    var incidentEl = qs("#incidentCount");
    var maxEl = qs("#threatMax");
    var shield = qs(".shield");
    var resetBtn = qs("#nukeReset");

    if (!scoreEl || !ring) {
      return;
    }

    var THRESHOLD = 100;
    var CIRCUMFERENCE = 326.7;
    var score = 0;
    var incidents = 0;
    var locked = false;
    var busy = false;

    var scenarios = {
      channels: {
        weight: 60,
        label: "channel deletion",
        lines: ["#general deleted by actor 4482", "#memes deleted by actor 4482", "channel-wipe weighting escalated"]
      },
      roles: { weight: 24, label: "role deletion", lines: ["@Verified deleted"] },
      bans: { weight: 26, label: "ban wave", lines: ["4 members banned in 1.2s"] },
      webhooks: { weight: 22, label: "webhook creation", lines: ["webhook free-nitro created", "webhook steam-gift created"] },
      raid: { weight: 140, label: "mass-destructive sequence", lines: ["channel wipe", "role wipe", "ban wave", "webhook spam"] }
    };

    function paint() {
      var ratio = clamp(score / THRESHOLD, 0, 1);
      scoreEl.textContent = String(Math.round(score));
      ring.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - ratio));
      ring.style.stroke = ratio >= 0.75 ? "#ee4b4b" : ratio >= 0.4 ? "#f5c542" : "#3ddc84";
      scoreEl.classList.toggle("is-warning", ratio >= 0.4 && ratio < 0.75);
      scoreEl.classList.toggle("is-critical", ratio >= 0.75);
      shield.classList.toggle("is-warning", ratio >= 0.4 && ratio < 0.75);
      shield.classList.toggle("is-critical", ratio >= 0.75);
      if (incidentEl) {
        incidentEl.textContent = String(incidents);
      }
    }

    function addScore(amount) {
      score = Math.min(THRESHOLD, score + amount);
      paint();
    }

    function lockdown(reason) {
      locked = true;
      stateEl.textContent = "LOCKED DOWN";
      stateEl.classList.add("is-danger");
      shield.classList.add("is-locked");
      scoreEl.classList.remove("is-warning", "is-critical");
      scoreEl.style.color = "var(--ok)";
      log("LOCKDOWN " + DOT + " " + reason, "err");
      log("Acting role stripped " + DOT + " @Quarantine applied", "hot");
      log("Destructive permissions revoked guild-wide", "hot");
      log("Snapshot rollback queued for reversed actions", "ok");
      sfx.alert();
      toast("Anti-nuke fired: guild locked down", "err");
    }

    function run(key) {
      if (busy || locked) {
        return;
      }
      var scenario = scenarios[key];
      if (!scenario) {
        return;
      }

      busy = true;
      var buttons = qsa("[data-nuke]");
      buttons.forEach(function (button) { button.disabled = true; });
      log("Audit event :: " + scenario.label + " detected", "warn");

      var index = 0;

      function step() {
        if (index < scenario.lines.length) {
          addScore(Math.round(scenario.weight / scenario.lines.length));
          incidents += 1;
          log(scenario.lines[index] + " " + DOT + " threat " + Math.round(score) + "/" + THRESHOLD, "err");
          sfx.warn();
          index += 1;
          window.setTimeout(step, reduceMotion ? 40 : 240);
          return;
        }

        if (score >= THRESHOLD) {
          lockdown("threshold reached at " + Math.round(score) + "/" + THRESHOLD);
        } else {
          log("Threat contained at " + Math.round(score) + "/" + THRESHOLD + " " + DOT + " watching actor", "info");
          sfx.tick();
        }

        busy = false;
        buttons.forEach(function (button) { button.disabled = false; });
      }

      step();
    }

    qsa("[data-nuke]").forEach(function (button) {
      button.addEventListener("click", function () {
        run(button.getAttribute("data-nuke"));
      });
    });

    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        score = 0;
        incidents = 0;
        locked = false;
        busy = false;
        stateEl.textContent = "ARMED";
        stateEl.classList.remove("is-danger");
        shield.classList.remove("is-locked", "is-warning", "is-critical");
        scoreEl.style.color = "";
        paint();
        log("Tripwire re-armed " + DOT + " thresholds reset", "ok");
        sfx.confirm();
      });
    }

    if (maxEl) {
      maxEl.textContent = String(THRESHOLD);
    }
    paint();
    log("Tripwire armed " + DOT + " weights [channels 60, roles 24, bans 26, webhooks 22]", "ok");
    log("Channel deletions weighted highest " + DOT + " 2 wipes trip the wire", "warn");
  })();

  (function notionBoard() {
    var syncBtn = qs("#notionSync");
    var board = qs("#board");
    var countEl = qs("#notionCount");
    var stateEl = qs("#notionSyncState");
    var log = makeLogger("notionLog", 40);

    if (!board || !syncBtn) {
      return;
    }

    var tasks = [
      { id: "TSK-101", title: "Design raid-throttle telemetry panel", owner: "Drek", hue: 265, due: "+2d", status: "Backlog" },
      { id: "TSK-102", title: "Retrain bot-name classifier on August dump", owner: "Mira", hue: 200, due: "+5d", status: "Backlog" },
      { id: "TSK-103", title: "Write join-gate onboarding copy", owner: "Kae", hue: 150, due: "+3d", status: "Backlog" },
      { id: "TSK-104", title: "Add blackjack split-hand support", owner: "Drek", hue: 25, due: "today", status: "In Progress" },
      { id: "TSK-105", title: "Voice hub permission mirroring edge cases", owner: "Rin", hue: 340, due: "+1d", status: "In Progress" },
      { id: "TSK-106", title: "Notion webhook write-back throttling", owner: "Mira", hue: 200, due: "+4d", status: "In Progress" },
      { id: "TSK-107", title: "Anti-nuke snapshot rollback tests", owner: "Kae", hue: 150, due: "today", status: "Review" },
      { id: "TSK-108", title: "Agent sandbox boundary rendering", owner: "Drek", hue: 265, due: "+2d", status: "Review" },
      { id: "TSK-109", title: "Emote pack export at 128px", owner: "Rin", hue: 340, due: "done", status: "Done" },
      { id: "TSK-110", title: "Economy odds table v9 balance pass", owner: "Mira", hue: 200, due: "done", status: "Done" },
      { id: "TSK-111", title: "Shard reconnection backoff tuning", owner: "Drek", hue: 25, due: "done", status: "Done" },
      { id: "TSK-112", title: "Weekly digest embed for staff", owner: "Kae", hue: 150, due: "done", status: "Done" }
    ];

    var pagesLoaded = 0;
    var dragging = null;
    var syncing = false;

    function dueClass(task) {
      if (task.due === "done") { return "is-done"; }
      if (task.due === "today") { return "is-late"; }
      if (task.due === "+1d") { return "is-soon"; }
      return "";
    }

    function makeCard(task, index) {
      var card = document.createElement("article");
      card.className = "task-card";
      card.draggable = true;
      card.setAttribute("data-id", task.id);
      card.style.animationDelay = (index * 45) + "ms";

      var title = document.createElement("div");
      title.className = "task-card__title";
      title.textContent = task.title;

      var meta = document.createElement("div");
      meta.className = "task-card__meta";

      var owner = document.createElement("span");
      owner.className = "task-card__owner";
      var dot = document.createElement("span");
      dot.className = "task-card__dot";
      dot.style.setProperty("--h", String(task.hue));
      var ownerName = document.createElement("span");
      ownerName.textContent = task.owner;
      owner.appendChild(dot);
      owner.appendChild(ownerName);

      var due = document.createElement("span");
      due.className = "task-card__due " + dueClass(task);
      due.textContent = task.due === "done" ? "closed" : task.due;

      meta.appendChild(owner);
      meta.appendChild(due);

      card.appendChild(title);
      card.appendChild(meta);

      card.addEventListener("dragstart", function () {
        dragging = task;
        card.classList.add("is-dragging");
      });

      card.addEventListener("dragend", function () {
        dragging = null;
        card.classList.remove("is-dragging");
        qsa(".board__col").forEach(function (column) {
          column.classList.remove("is-over");
        });
      });

      return card;
    }

    function paintColumns() {
      qsa(".board__list").forEach(function (list) {
        var status = list.getAttribute("data-drop");
        list.innerHTML = "";
        var subset = tasks.filter(function (task) { return task.status === status; });
        subset.forEach(function (task, index) {
          list.appendChild(makeCard(task, index));
        });
        var counter = qs('[data-count-for="' + status + '"]');
        if (counter) {
          counter.textContent = String(subset.length);
        }
      });
    }

    function moveTask(task, status) {
      if (task.status === status) {
        return;
      }
      var previous = task.status;
      task.status = status;
      if (status === "Done") {
        task.due = "done";
      } else if (task.due === "done") {
        task.due = "+2d";
      }
      paintColumns();
      log("PATCH /v1/pages/" + task.id + " " + ARROW + " status \"" + status + "\"", "info");
      log("Notion write-back confirmed (" + previous + " " + ARROW + " " + status + ")", "ok");
      sfx.confirm();
      toast(task.id + " moved to " + status, "ok");
    }

    qsa(".board__col").forEach(function (column) {
      var status = column.getAttribute("data-status");

      column.addEventListener("dragover", function (event) {
        event.preventDefault();
        column.classList.add("is-over");
      });

      column.addEventListener("dragleave", function () {
        column.classList.remove("is-over");
      });

      column.addEventListener("drop", function (event) {
        event.preventDefault();
        column.classList.remove("is-over");
        if (dragging) {
          moveTask(dragging, status);
        }
      });

      column.addEventListener("click", function (event) {
        var card = event.target.closest(".task-card");
        if (!card) {
          return;
        }
        var id = card.getAttribute("data-id");
        var task = tasks.filter(function (item) { return item.id === id; })[0];
        if (!task) {
          return;
        }
        var order = ["Backlog", "In Progress", "Review", "Done"];
        var next = order[(order.indexOf(task.status) + 1) % order.length];
        moveTask(task, next);
      });
    });

    function sync() {
      if (syncing) {
        return;
      }
      syncing = true;
      syncBtn.disabled = true;
      stateEl.textContent = "SYNCING";
      stateEl.classList.remove("is-ok", "is-danger");
      log("GET /v1/databases/team-tasks/query " + DOT + " page_size=100", "info");

      var revealed = 0;
      var timer = window.setInterval(function () {
        revealed += 2;
        pagesLoaded = Math.min(revealed, tasks.length);
        if (countEl) {
          countEl.textContent = String(pagesLoaded);
        }
        log("Fetched " + pagesLoaded + "/" + tasks.length + " pages " + DOT + " cursor advanced", "info");
        paintColumns();
        if (pagesLoaded >= tasks.length) {
          window.clearInterval(timer);
          syncing = false;
          syncBtn.disabled = false;
          stateEl.textContent = "SYNCED";
          stateEl.classList.add("is-ok");
          log("Board rebuilt from Notion " + DOT + " " + tasks.length + " tasks mapped", "ok");
          sfx.confirm();
          toast("Notion board synced " + DOT + " " + tasks.length + " tasks", "ok");
        }
      }, reduceMotion ? 30 : 260);
    }

    syncBtn.addEventListener("click", sync);

    qsa(".board__list").forEach(function (list) {
      list.innerHTML = "";
    });
    log("Notion bridge idle " + DOT + " database Team Tasks ready", "info");
    log("Press Sync to pull pages from the API", "info");
  })();

  (function agentAI() {
    var promptButtons = qsa("#agentPrompts .mini-btn");
    var planEl = qs("#agentPlan");
    var clearBtn = qs("#agentClear");
    var log = makeLogger("agentLog", 60);

    if (!planEl) {
      return;
    }

    var blueprints = {
      squad: {
        match: /squad|tournament|private|category/i,
        goal: "Create a squad category with three private channels",
        steps: [
          { tool: "create_category", title: "Create category", detail: "name: Tournament Squad " + DOT + " position: 2", diff: "add category Tournament Squad" },
          { tool: "create_channel", title: "Create text channel", detail: "name: squad-chat " + DOT + " parent: Tournament Squad", diff: "add #squad-chat (private)" },
          { tool: "create_channel", title: "Create voice channel", detail: "name: Squad Voice " + DOT + " parent: Tournament Squad", diff: "add Squad Voice (private)" },
          { tool: "create_channel", title: "Create text channel", detail: "name: squad-strats " + DOT + " parent: Tournament Squad", diff: "add #squad-strats (private)" },
          { tool: "overwrite_permissions", title: "Lock down visibility", detail: "@everyone deny VIEW_CHANNEL " + DOT + " role @Squad allow VIEW_CHANNEL", diff: "mod @everyone VIEW_CHANNEL " + ARROW + " deny" }
        ]
      },
      moderator: {
        match: /moderator|permission|manage messages|kick/i,
        goal: "Repair the Moderator role permissions",
        steps: [
          { tool: "fetch_role", title: "Read current permissions", detail: "@Moderator " + DOT + " 1,208 bits set", diff: "read @Moderator" },
          { tool: "edit_role", title: "Grant missing bits", detail: "MANAGE_MESSAGES, KICK_MEMBERS, MODERATE_MEMBERS", diff: "mod @Moderator +MANAGE_MESSAGES" },
          { tool: "edit_role", title: "Apply hierarchy guard", detail: "position bumped below @Admin to prevent escalation", diff: "mod @Moderator position 5" },
          { tool: "audit_log", title: "Verify change", detail: "permissions now 1,416 bits " + DOT + " audit entry written", diff: "verify @Moderator" }
        ]
      },
      lockdown: {
        match: /lock|raid|emergency|announce/i,
        goal: "Emergency raid lockdown across public channels",
        steps: [
          { tool: "list_channels", title: "Enumerate public channels", detail: "18 channels matched visibility filter", diff: "read 18 channels" },
          { tool: "overwrite_permissions", title: "Deny send in bulk", detail: "@everyone SEND_MESSAGES " + ARROW + " deny on all 18 channels", diff: "mod @everyone SEND_MESSAGES " + ARROW + " deny" },
          { tool: "create_channel", title: "Open staff war room", detail: "name: staff-war-room " + DOT + " visible to @Staff only", diff: "add #staff-war-room (private)" },
          { tool: "send_message", title: "Publish lockdown notice", detail: "#announcements " + DOT + " embed with ETA and appeal link", diff: "send #announcements" },
          { tool: "schedule_task", title: "Schedule automatic unlock", detail: "re-check in 30 minutes and lift if raid traffic drops", diff: "schedule unlock +30m" }
        ]
      },
      registration: {
        match: /regist|verify|rules|onboard|flow/i,
        goal: "Set up a registration and verification flow",
        steps: [
          { tool: "create_channel", title: "Create rules channel", detail: "name: rules " + DOT + " read-only for @everyone", diff: "add #rules" },
          { tool: "create_channel", title: "Create verify channel", detail: "name: get-verified " + DOT + " gated to quarantine role", diff: "add #get-verified" },
          { tool: "send_message", title: "Post the rulebook", detail: "8 rules formatted as an embed with reaction roles", diff: "send #rules" },
          { tool: "create_role", title: "Create pending role", detail: "name: Quarantine " + DOT + " no channel permissions", diff: "add role @Quarantine" },
          { tool: "edit_guild_settings", title: "Wire onboarding", detail: "default role " + ARROW + " @Quarantine " + DOT + " colour gate enabled", diff: "mod guild.default_role " + ARROW + " @Quarantine" }
        ]
      }
    };

    var activePlan = null;

    function resolveBlueprint(text) {
      var keys = Object.keys(blueprints);
      for (var i = 0; i < keys.length; i += 1) {
        if (blueprints[keys[i]].match.test(text)) {
          return blueprints[keys[i]];
        }
      }
      return {
        goal: text,
        steps: [
          { tool: "resolve_intent", title: "Parse request", detail: "goal: " + text, diff: "read guild state" },
          { tool: "inspect_guild", title: "Inspect current structure", detail: "24 channels " + DOT + " 14 roles " + DOT + " 3 categories", diff: "read guild" },
          { tool: "plan_change", title: "Draft change set", detail: "minimal-diff plan generated from intent", diff: "plan only" },
          { tool: "sandbox_check", title: "Validate against sandbox", detail: "all calls reversible, no destructive scope granted", diff: "sandbox verify" }
        ]
      };
    }

    function execute(count) {
      var rows = qsa(".plan-step", planEl);

      function step(index) {
        if (index >= count || index >= rows.length) {
          log("Change set committed " + DOT + " audit entry written " + DOT + " 0 errors", "ok");
          log("Sandbox held " + DOT + " nothing escaped the guild scope", "info");
          toast("Agent finished " + DOT + " guild updated", "ok");
          sfx.win();
          return;
        }

        var row = rows[index];
        var state = qs(".plan-step__state", row);
        var tool = qs(".plan-step__tool", row);
        row.classList.add("is-running");
        if (state) {
          state.textContent = "running";
        }
        log("tool_call " + (tool ? tool.textContent : "unknown") + " " + ARROW + " dispatched", "info");
        sfx.tick();

        window.setTimeout(function () {
          row.classList.remove("is-running");
          row.classList.add("is-done");
          if (state) {
            state.textContent = "done";
            state.style.color = "var(--ok)";
          }
          log("tool_call " + (tool ? tool.textContent : "unknown") + " " + ARROW + " 200 OK", "ok");
          step(index + 1);
        }, reduceMotion ? 60 : 520);
      }

      step(0);
    }

    function renderPlan(blueprint) {
      planEl.innerHTML = "";
      activePlan = blueprint;

      var header = document.createElement("p");
      header.className = "agent-console__hint";
      header.textContent = "Goal: " + blueprint.goal + " " + DOT + " " + blueprint.steps.length + " tool calls queued";
      planEl.appendChild(header);

      blueprint.steps.forEach(function (step, index) {
        var row = document.createElement("div");
        row.className = "plan-step";
        row.style.animationDelay = (index * 60) + "ms";

        var tool = document.createElement("span");
        tool.className = "plan-step__tool";
        tool.textContent = step.tool;

        var body = document.createElement("div");
        body.className = "plan-step__body";

        var title = document.createElement("div");
        title.className = "plan-step__title";
        title.textContent = step.title;

        var detail = document.createElement("div");
        detail.className = "plan-step__detail";
        detail.textContent = step.detail;

        var diff = document.createElement("div");
        diff.className = "diff-list";
        var diffLine = document.createElement("span");
        diffLine.className = step.diff.indexOf("mod") === 0 ? "diff-mod" : "diff-add";
        diffLine.textContent = PLUSMINUS + " " + step.diff;
        diff.appendChild(diffLine);

        body.appendChild(title);
        body.appendChild(detail);
        body.appendChild(diff);

        var state = document.createElement("span");
        state.className = "plan-step__state";
        state.textContent = "queued";

        row.appendChild(tool);
        row.appendChild(body);
        row.appendChild(state);
        planEl.appendChild(row);
      });

      log("Plan generated " + DOT + " " + blueprint.steps.length + " tool calls " + DOT + " executing now", "info");
      sfx.click();
      execute(blueprint.steps.length);
    }

    promptButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        promptButtons.forEach(function (other) {
          other.classList.toggle("is-active", other === button);
        });
        var text = button.getAttribute("data-prompt") || "";
        log("> " + text, "hot");
        renderPlan(resolveBlueprint(text));
      });
    });

    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        planEl.innerHTML = '<p class="agent-console__hint">Pick a goal above and the agent plans and executes it.</p>';
        activePlan = null;
        promptButtons.forEach(function (button) {
          button.classList.remove("is-active");
        });
        log("Console cleared " + DOT + " no changes made", "warn");
      });
    }

    log("Agent online " + DOT + " 12 tools bound " + DOT + " sandbox sealed", "ok");
    log("No approval step: the sandbox makes damage effectively impossible", "info");
  })();

  (function voiceBuilder() {
    var templateInput = qs("#vcTemplate");
    var limitInput = qs("#vcLimit");
    var limitOut = qs("#vcLimitOut");
    var previewName = qs("#vcPreviewName");
    var previewBadges = qs("#vcPreviewBadges");
    var previewMembers = qs("#vcPreviewMembers");
    var previewChannel = qs(".vc-preview__channel");
    var accessList = qs("#vcAccessList");
    var accessNote = qs("#vcAccessNote");
    var blockedCountEl = qs("#vcBlockedCount");
    var stateEl = qs("#vcState");
    var log = makeLogger("vcLog", 40);

    if (!templateInput || !limitInput || !previewName) {
      return;
    }

    var toggles = {
      private: qs("#vcPrivate"),
      locked: qs("#vcLocked"),
      hidden: qs("#vcHidden")
    };

    var roster = [
      { name: "Drek", handle: "@drek", hue: 265, owner: true },
      { name: "Mira", handle: "@mira", hue: 200 },
      { name: "Kae", handle: "@kae", hue: 150 },
      { name: "Rin", handle: "@rin", hue: 340 },
      { name: "Juno", handle: "@juno", hue: 25 },
      { name: "Ash", handle: "@ash", hue: 95 },
      { name: "Nova", handle: "@nova", hue: 305 },
      { name: "Bit", handle: "@bit", hue: 180 }
    ];

    var blocked = {};
    var currentOwner = "Drek";
    var memberCount = 1;
    var debounce = null;

    function blockedNames() {
      return Object.keys(blocked).filter(function (name) {
        return blocked[name];
      });
    }

    function renderName() {
      var raw = templateInput.value || "{user}'s room";
      var rendered = raw.replace(/\{user\}/gi, currentOwner).replace(/\{count\}/gi, String(memberCount));
      previewName.textContent = rendered;
      return rendered;
    }

    function renderBadges() {
      previewBadges.innerHTML = "";
      var entries = [];
      if (toggles.private && toggles.private.checked) {
        entries.push({ label: "private", cls: "vc-badge--key" });
      }
      if (toggles.locked && toggles.locked.checked) {
        entries.push({ label: "locked", cls: "vc-badge--lock" });
      }
      if (toggles.hidden && toggles.hidden.checked) {
        entries.push({ label: "hidden", cls: "vc-badge--eye" });
      }
      if (limitInput.value !== "0") {
        entries.push({ label: limitInput.value + " max", cls: "" });
      }
      var banned = blockedNames().length;
      if (banned > 0) {
        entries.push({ label: banned + " blocked", cls: "vc-badge--lock" });
      }
      entries.forEach(function (entry) {
        var badge = document.createElement("span");
        badge.className = "vc-badge " + entry.cls;
        badge.textContent = entry.label;
        previewBadges.appendChild(badge);
      });
      if (previewChannel) {
        previewChannel.classList.toggle("is-locked", Boolean(toggles.locked && toggles.locked.checked));
      }
    }

    function renderMembers() {
      previewMembers.innerHTML = "";
      var limit = parseInt(limitInput.value, 10) || 0;
      var eligible = roster.filter(function (person) {
        return !blocked[person.name];
      });
      var shown = limit === 0 ? Math.min(eligible.length, 6) : clamp(limit, 1, 8);
      eligible.slice(0, shown).forEach(function (person, index) {
        var avatar = document.createElement("span");
        avatar.className = "vc-member";
        avatar.style.setProperty("--h", String(person.hue));
        avatar.style.animationDelay = (index * 50) + "ms";
        avatar.textContent = person.name.charAt(0).toUpperCase();
        avatar.title = person.handle;
        previewMembers.appendChild(avatar);
      });
      if (!previewMembers.children.length) {
        var empty = document.createElement("span");
        empty.className = "vc-preview__empty";
        empty.textContent = "Empty room " + DOT + " only the owner can join";
        previewMembers.appendChild(empty);
      }
    }

    function renderAccess() {
      accessList.innerHTML = "";
      roster.forEach(function (person) {
        var isBlocked = Boolean(blocked[person.name]);
        var button = document.createElement("button");
        button.type = "button";
        button.className = "vc-member-chip" + (isBlocked ? " is-blocked" : "") + (person.owner ? " is-owner" : "");
        button.setAttribute("aria-pressed", String(isBlocked));
        button.setAttribute("data-name", person.name);

        var avatar = document.createElement("span");
        avatar.className = "vc-member-chip__avatar";
        avatar.style.setProperty("--h", String(person.hue));
        avatar.textContent = person.name.charAt(0).toUpperCase();

        var text = document.createElement("span");
        text.className = "vc-member-chip__text";

        var name = document.createElement("strong");
        name.textContent = person.owner ? person.name + " (owner)" : person.name;

        var status = document.createElement("em");
        status.textContent = isBlocked ? "Blocked " + DOT + " cannot join" : "Allowed " + DOT + " can join";

        text.appendChild(name);
        text.appendChild(status);

        var action = document.createElement("span");
        action.className = "vc-member-chip__action";
        action.textContent = isBlocked ? "unblock" : "block";

        button.appendChild(avatar);
        button.appendChild(text);
        button.appendChild(action);

        if (person.owner) {
          button.disabled = true;
          button.title = "The room owner cannot be blocked";
        } else {
          button.addEventListener("click", function () {
            toggleBlock(person);
          });
        }

        accessList.appendChild(button);
      });

      var names = blockedNames();
      if (blockedCountEl) {
        blockedCountEl.textContent = String(names.length);
      }
      if (accessNote) {
        if (!names.length) {
          accessNote.textContent = "Nobody is blocked. The room is open to everyone who can see the hub.";
        } else {
          accessNote.textContent = "Blocked from this room: " + names.join(", ") +
            ". They lose CONNECT permission natively and cannot rejoin until you unblock them.";
        }
      }
    }

    function toggleBlock(person) {
      blocked[person.name] = !blocked[person.name];
      var isBlocked = blocked[person.name];
      renderAccess();
      renderMembers();
      renderBadges();
      log((isBlocked ? "DENY" : "ALLOW") + " CONNECT " + ARROW + " " + person.handle +
        (isBlocked ? " removed from the room" : " granted access again"), isBlocked ? "err" : "ok");
      if (isBlocked) {
        sfx.warn();
        toast(person.name + " blocked from the room", "err");
      } else {
        sfx.confirm();
        toast(person.name + " allowed back in", "ok");
      }
    }

    function refresh(silent) {
      limitOut.textContent = limitInput.value === "0" ? INFINITY_SIGN : limitInput.value;
      var name = renderName();
      renderBadges();
      renderMembers();
      if (!silent) {
        log("Channel update " + ARROW + " name \"" + name + "\" " + DOT + " limit " + (limitInput.value === "0" ? "unlimited" : limitInput.value), "info");
      }
    }

    function scheduleLog(message) {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(function () {
        log(message, "ok");
        sfx.tick();
      }, 420);
    }

    var initial = false;

    templateInput.addEventListener("input", function () {
      refresh(true);
      if (initial) {
        scheduleLog("Synced name template to voice hub");
      }
      initial = true;
    });

    limitInput.addEventListener("input", function () {
      refresh(true);
      scheduleLog("User limit set to " + (limitInput.value === "0" ? "unlimited" : limitInput.value));
    });

    Object.keys(toggles).forEach(function (key) {
      var input = toggles[key];
      if (!input) {
        return;
      }
      input.addEventListener("change", function () {
        refresh(true);
        log("Permission " + key + " " + ARROW + " " + (input.checked ? "enabled" : "disabled"), input.checked ? "ok" : "warn");
        sfx.click();
        if (key === "locked" && input.checked) {
          stateEl.textContent = "ROOM LOCKED";
        } else if (key === "locked") {
          stateEl.textContent = "HUB READY";
        }
      });
    });

    renderAccess();
    refresh(true);
    log("Join-to-create hub online " + DOT + " channel Join to Create", "ok");
    log("Native owner controls mirrored: rename, limit, lock, hide, grant, block", "info");
    log("Voice channels already carry text chat " + DOT + " no paired channel needed", "info");
  })();
})();
