(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  function qs(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function qsa(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  var toastStack = qs("#toastStack");

  function toast(message, kind) {
    if (!toastStack) {
      return;
    }
    var el = document.createElement("div");
    el.className = "toast is-" + (kind || "info");
    var icon = document.createElement("span");
    icon.className = "toast__icon";
    var text = document.createElement("span");
    text.textContent = message;
    el.appendChild(icon);
    el.appendChild(text);
    toastStack.appendChild(el);
    window.setTimeout(function () {
      el.classList.add("is-leaving");
      window.setTimeout(function () {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
      }, 320);
    }, 2600);
  }

  window.portfolioToast = toast;

  var audio = {
    ctx: null,
    enabled: true
  };

  function audioContext() {
    if (audio.ctx) {
      return audio.ctx;
    }
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) {
      return null;
    }
    audio.ctx = new Ctor();
    return audio.ctx;
  }

  function blip(frequency, duration, type, gain) {
    if (!audio.enabled) {
      return;
    }
    var ctx = audioContext();
    if (!ctx) {
      return;
    }
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    var osc = ctx.createOscillator();
    var amp = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.value = frequency;
    amp.gain.setValueAtTime(0.0001, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(gain || 0.045, ctx.currentTime + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  function chord(frequencies, step, duration) {
    frequencies.forEach(function (frequency, index) {
      window.setTimeout(function () {
        blip(frequency, duration || 0.18, "triangle", 0.05);
      }, index * (step || 70));
    });
  }

  var sfx = {
    click: function () { blip(520, 0.09, "triangle", 0.035); },
    tick: function () { blip(880, 0.045, "square", 0.018); },
    win: function () { chord([523, 659, 784, 1047], 62, 0.22); },
    lose: function () { chord([320, 250, 190], 90, 0.2); },
    warn: function () { blip(300, 0.22, "sawtooth", 0.04); },
    alert: function () { chord([740, 620, 740, 620], 70, 0.14); },
    confirm: function () { chord([587, 880], 70, 0.16); }
  };

  window.portfolioSfx = sfx;

  var soundToggle = qs("#soundToggle");
  var soundLabel = qs("[data-sound-label]");

  function paintSoundButton() {
    if (!soundToggle) {
      return;
    }
    soundToggle.setAttribute("aria-pressed", String(audio.enabled));
    soundToggle.setAttribute("title", audio.enabled ? "Interface sounds are on" : "Interface sounds are muted");
    if (soundLabel) {
      soundLabel.textContent = audio.enabled ? "Mute interface sounds" : "Unmute interface sounds";
    }
  }

  if (soundToggle) {
    soundToggle.addEventListener("click", function () {
      audio.enabled = !audio.enabled;
      paintSoundButton();
      if (audio.enabled) {
        blip(660, 0.12, "triangle", 0.05);
        toast("Interface sounds on", "ok");
      } else {
        toast("Interface sounds muted", "info");
      }
    });
  }

  if (finePointer && !reduceMotion) {
    var glow = qs("#cursorGlow");
    var dot = qs("#cursorDot");
    var pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    var glowPos = { x: pointer.x, y: pointer.y };
    var dotPos = { x: pointer.x, y: pointer.y };
    var cursorVisible = false;

    document.body.classList.add("has-pointer");

    window.addEventListener("pointermove", function (event) {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      if (!cursorVisible && glow && dot) {
        cursorVisible = true;
        glow.style.opacity = "";
        dot.style.opacity = "";
      }
      var target = event.target;
      var interactive = target && target.closest ? target.closest("a, button, input, label, summary, .captcha-tile, .task-card, .emote-tile, .swatch") : null;
      document.body.classList.toggle("cursor-hot", Boolean(interactive));
    }, { passive: true });

    (function cursorLoop() {
      glowPos.x += (pointer.x - glowPos.x) * 0.09;
      glowPos.y += (pointer.y - glowPos.y) * 0.09;
      dotPos.x += (pointer.x - dotPos.x) * 0.3;
      dotPos.y += (pointer.y - dotPos.y) * 0.3;
      if (glow) {
        glow.style.transform = "translate3d(" + glowPos.x.toFixed(2) + "px," + glowPos.y.toFixed(2) + "px,0)";
      }
      if (dot) {
        dot.style.transform = "translate3d(" + dotPos.x.toFixed(2) + "px," + dotPos.y.toFixed(2) + "px,0)";
      }
      window.requestAnimationFrame(cursorLoop);
    })();
  }

  var canvas = qs("#particles");

  if (canvas && !reduceMotion) {
    var ctx2d = canvas.getContext("2d");
    var particles = [];
    var pointerField = { x: -9999, y: -9999 };
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var palette = ["88,101,242", "242,160,61", "238,91,138", "47,214,168"];

    function sizeCanvas() {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function makeParticle() {
      return {
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.34,
        vy: (Math.random() - 0.5) * 0.34,
        r: 0.7 + Math.random() * 1.9,
        colour: palette[Math.floor(Math.random() * palette.length)],
        alpha: 0.24 + Math.random() * 0.5
      };
    }

    function seed() {
      var target = Math.round(Math.min(110, Math.max(34, window.innerWidth / 14)));
      particles = [];
      for (var i = 0; i < target; i += 1) {
        particles.push(makeParticle());
      }
    }

    sizeCanvas();
    seed();

    window.addEventListener("resize", function () {
      sizeCanvas();
      seed();
    });

    window.addEventListener("pointermove", function (event) {
      pointerField.x = event.clientX;
      pointerField.y = event.clientY;
    }, { passive: true });

    window.addEventListener("pointerleave", function () {
      pointerField.x = -9999;
      pointerField.y = -9999;
    });

    var linkDistance = 132;

    (function particleLoop() {
      var w = window.innerWidth;
      var h = window.innerHeight;
      ctx2d.clearRect(0, 0, w, h);

      for (var i = 0; i < particles.length; i += 1) {
        var p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        var dxp = p.x - pointerField.x;
        var dyp = p.y - pointerField.y;
        var pd = Math.sqrt(dxp * dxp + dyp * dyp);
        if (pd < 130 && pd > 0.001) {
          var push = (130 - pd) / 130;
          p.x += (dxp / pd) * push * 1.9;
          p.y += (dyp / pd) * push * 1.9;
        }

        if (p.x < -20) { p.x = w + 20; }
        if (p.x > w + 20) { p.x = -20; }
        if (p.y < -20) { p.y = h + 20; }
        if (p.y > h + 20) { p.y = -20; }

        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx2d.fillStyle = "rgba(" + p.colour + "," + p.alpha + ")";
        ctx2d.fill();

        for (var j = i + 1; j < particles.length; j += 1) {
          var q = particles[j];
          var dx = p.x - q.x;
          var dy = p.y - q.y;
          if (Math.abs(dx) > linkDistance || Math.abs(dy) > linkDistance) {
            continue;
          }
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < linkDistance) {
            var strength = (1 - dist / linkDistance) * 0.13;
            ctx2d.beginPath();
            ctx2d.moveTo(p.x, p.y);
            ctx2d.lineTo(q.x, q.y);
            ctx2d.strokeStyle = "rgba(140,155,255," + strength.toFixed(3) + ")";
            ctx2d.lineWidth = 0.7;
            ctx2d.stroke();
          }
        }
      }

      window.requestAnimationFrame(particleLoop);
    })();
  }

  var topbar = qs("#topbar");
  var progress = qs("#pageProgress");
  var toTop = qs("#toTop");
  var ticking = false;

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    var height = document.documentElement.scrollHeight - window.innerHeight;
    var ratio = height > 0 ? Math.min(1, Math.max(0, y / height)) : 0;

    if (topbar) {
      topbar.classList.toggle("is-stuck", y > 24);
    }
    if (progress) {
      progress.style.width = (ratio * 100).toFixed(2) + "%";
    }
    if (toTop) {
      toTop.classList.toggle("is-visible", y > 700);
    }

    var sections = qsa("section[id]");
    var current = "";
    sections.forEach(function (section) {
      if (section.getBoundingClientRect().top <= 160) {
        current = section.id;
      }
    });
    qsa(".nav a").forEach(function (link) {
      var href = link.getAttribute("href") || "";
      link.classList.toggle("is-current", href === "#" + current);
    });

    ticking = false;
  }

  window.addEventListener("scroll", function () {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(onScroll);
    }
  }, { passive: true });

  onScroll();

  if (toTop) {
    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    });
  }

  var burger = qs("#burger");
  var nav = qs("#nav");

  if (burger && nav) {
    burger.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", String(open));
    });

    qsa("a", nav).forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      });
    });

    document.addEventListener("click", function (event) {
      if (!nav.classList.contains("is-open")) {
        return;
      }
      if (!nav.contains(event.target) && !burger.contains(event.target)) {
        nav.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      }
    });
  }

  var revealables = qsa("[data-reveal]");

  if ("IntersectionObserver" in window && !reduceMotion) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, index) {
        if (!entry.isIntersecting) {
          return;
        }
        var delay = Math.min(index * 70, 320);
        window.setTimeout(function () {
          entry.target.classList.add("is-revealed");
        }, delay);
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -60px 0px" });

    revealables.forEach(function (el) {
      revealObserver.observe(el);
    });
  } else {
    revealables.forEach(function (el) {
      el.classList.add("is-revealed");
    });
  }

  function formatNumber(value, decimals) {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function runCounter(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
    var prefix = el.getAttribute("data-prefix") || "";
    var suffix = el.getAttribute("data-suffix") || "";
    var duration = 1500;
    var start = null;

    if (isNaN(target)) {
      return;
    }

    function frame(now) {
      if (start === null) {
        start = now;
      }
      var t = Math.min(1, (now - start) / duration);
      var eased = 1 - Math.pow(1 - t, 3);
      var value = target * eased;
      el.textContent = prefix + formatNumber(value, decimals) + suffix;
      if (t < 1) {
        window.requestAnimationFrame(frame);
      } else {
        el.textContent = prefix + formatNumber(target, decimals) + suffix;
      }
    }

    window.requestAnimationFrame(frame);
  }

  var counters = qsa(".count[data-count]");

  if (counters.length) {
    if ("IntersectionObserver" in window && !reduceMotion) {
      var counterObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            runCounter(entry.target);
            counterObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.5 });
      counters.forEach(function (el) {
        counterObserver.observe(el);
      });
    } else {
      counters.forEach(function (el) {
        var target = parseFloat(el.getAttribute("data-count"));
        var suffix = el.getAttribute("data-suffix") || "";
        if (!isNaN(target)) {
          el.textContent = formatNumber(target, 0) + suffix;
        }
      });
    }
  }

  var marqueeTrack = qs(".marquee__track");

  if (marqueeTrack) {
    var clone = marqueeTrack.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    marqueeTrack.parentNode.appendChild(clone);
  }

  if (finePointer && !reduceMotion) {
    qsa("[data-tilt]").forEach(function (card) {
      var raf = null;
      var state = { rx: 0, ry: 0, targetRx: 0, targetRy: 0 };

      function apply() {
        state.rx += (state.targetRx - state.rx) * 0.12;
        state.ry += (state.targetRy - state.ry) * 0.12;
        card.style.setProperty("--rx", state.rx.toFixed(3) + "deg");
        card.style.setProperty("--ry", state.ry.toFixed(3) + "deg");
        if (Math.abs(state.targetRx - state.rx) > 0.01 || Math.abs(state.targetRy - state.ry) > 0.01) {
          raf = window.requestAnimationFrame(apply);
        } else {
          raf = null;
        }
      }

      function kick() {
        if (raf === null) {
          raf = window.requestAnimationFrame(apply);
        }
      }

      card.addEventListener("pointermove", function (event) {
        var rect = card.getBoundingClientRect();
        var px = (event.clientX - rect.left) / rect.width;
        var py = (event.clientY - rect.top) / rect.height;
        card.style.setProperty("--mx", (px * 100).toFixed(2) + "%");
        card.style.setProperty("--my", (py * 100).toFixed(2) + "%");
        state.targetRy = (px - 0.5) * 9;
        state.targetRx = (0.5 - py) * 9;
        kick();
      });

      card.addEventListener("pointerleave", function () {
        state.targetRx = 0;
        state.targetRy = 0;
        kick();
      });
    });
  }

  var glyphs = "abcdefghijklmnopqrstuvwxyz#$%&*<>/\\{}[]=+";

  qsa("[data-scramble]").forEach(function (el) {
    var finalText = el.getAttribute("data-scramble") || el.textContent;
    var running = false;

    function scramble() {
      if (running || reduceMotion) {
        return;
      }
      running = true;
      var frame = 0;
      var total = 22;
      var timer = window.setInterval(function () {
        var shown = "";
        for (var i = 0; i < finalText.length; i += 1) {
          if (i < (frame / total) * finalText.length) {
            shown += finalText[i];
          } else {
            shown += glyphs[Math.floor(Math.random() * glyphs.length)];
          }
        }
        el.textContent = shown;
        frame += 1;
        if (frame > total) {
          window.clearInterval(timer);
          el.textContent = finalText;
          running = false;
        }
      }, 34);
    }

    el.addEventListener("mouseenter", scramble);
    el.addEventListener("focus", scramble);
  });

  var terminalEl = qs("#bootTerminal");

  if (terminalEl) {
    var script = [
      { text: "$ drek deploy --guild \"Drek's Community\"", cls: "t-hot", delay: 260 },
      { text: "[gateway]  shard 0 connected · 4,812 guilds · latency 38ms", cls: "t-info", delay: 320 },
      { text: "[join-gate] quarantine role applied to 12 new members", cls: "t-dim", delay: 300 },
      { text: "[ml-guard]  analysing 12 usernames against n-gram model", cls: "t-dim", delay: 340 },
      { text: "[ml-guard]  flagged Raid_Account_8842 · confidence 0.973 · entropy 4.61", cls: "t-warn", delay: 420 },
      { text: "[ml-guard]  flagged qz7f2k9wlm41 · confidence 0.988 · digit-tail match", cls: "t-warn", delay: 380 },
      { text: "[ml-guard]  11 of 12 accounts quarantined · 1 passed CAPTCHA", cls: "t-ok", delay: 360 },
      { text: "[anti-nuke] audit tripwire ARMED · thresholds [channels:3 roles:2 bans:4]", cls: "t-dim", delay: 380 },
      { text: "[anti-nuke] ! webhook burst detected from actor 4482...", cls: "t-err", delay: 460 },
      { text: "[anti-nuke] actor role-stripped in 742ms · guild lockdown engaged", cls: "t-err", delay: 420 },
      { text: "[anti-nuke] rolled back 3 channel deletions from snapshot", cls: "t-ok", delay: 400 },
      { text: "[economy]   d$1,204,882 circulating · 3 jackpots this week", cls: "t-dim", delay: 340 },
      { text: "[notion]    synced 24 team tasks · 6 due today", cls: "t-info", delay: 340 },
      { text: "[agent]     listening for natural-language ops requests", cls: "t-info", delay: 340 },
      { text: "[voice]     join-to-create hub online · 7 rooms owned", cls: "t-dim", delay: 320 },
      { text: "$ all systems nominal. drek is watching. 🥜", cls: "t-ok", delay: 380 }
    ];

    var lineIndex = 0;

    function appendLine() {
      if (lineIndex >= script.length) {
        var caret = document.createElement("span");
        caret.className = "caret";
        terminalEl.appendChild(caret);
        return;
      }

      var entry = script[lineIndex];
      var span = document.createElement("span");
      span.className = entry.cls;
      terminalEl.appendChild(span);
      terminalEl.appendChild(document.createTextNode("\n"));

      var chars = entry.text.split("");
      var i = 0;

      function typeChar() {
        if (i < chars.length) {
          span.textContent += chars[i];
          i += 1;

          window.setTimeout(typeChar, reduceMotion ? 0 : 9 + Math.random() * 12);
        } else {
          lineIndex += 1;
          window.setTimeout(appendLine, reduceMotion ? 40 : entry.delay);
        }
      }

      typeChar();
    }

    if (reduceMotion) {
      appendLine();
    } else if ("IntersectionObserver" in window) {
      var bootObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            appendLine();
            bootObserver.disconnect();
          }
        });
      }, { threshold: 0.3 });
      bootObserver.observe(terminalEl);
    } else {
      appendLine();
    }
  }

  var mascotMain = qs("#mascotMain");
  var swapper = qs("#emoteSwapper");

  if (mascotMain && swapper) {
    qsa(".swatch", swapper).forEach(function (button) {
      button.addEventListener("click", function () {
        var next = button.getAttribute("data-emote");
        var alt = button.getAttribute("data-alt") || "Peanut the bot mascot";
        if (!next || next === mascotMain.getAttribute("src")) {
          return;
        }
        qsa(".swatch", swapper).forEach(function (other) {
          other.classList.toggle("is-active", other === button);
        });
        mascotMain.classList.add("is-swapping");
        sfx.click();
        window.setTimeout(function () {
          mascotMain.setAttribute("src", next);
          mascotMain.setAttribute("alt", alt);
          mascotMain.classList.remove("is-swapping");
        }, 240);
      });
    });

    if (!reduceMotion) {
      var autoEmotes = qsa(".swatch", swapper).map(function (button) {
        return {
          src: button.getAttribute("data-emote"),
          alt: button.getAttribute("data-alt") || "Peanut the bot mascot",
          button: button
        };
      });
      var autoIndex = 0;
      var autoTimer = window.setInterval(function () {
        if (document.hidden || window.scrollY > window.innerHeight * 1.1) {
          return;
        }
        autoIndex = (autoIndex + 1) % autoEmotes.length;
        var pick = autoEmotes[autoIndex];
        if (pick.src === mascotMain.getAttribute("src")) {
          return;
        }
        qsa(".swatch", swapper).forEach(function (other) {
          other.classList.toggle("is-active", other === pick.button);
        });
        mascotMain.classList.add("is-swapping");
        window.setTimeout(function () {
          mascotMain.setAttribute("src", pick.src);
          mascotMain.setAttribute("alt", pick.alt);
          mascotMain.classList.remove("is-swapping");
        }, 240);
      }, 5200);
      window.addEventListener("beforeunload", function () {
        window.clearInterval(autoTimer);
      });
    }
  }

  var mascotStage = qs("#mascotStage");

  if (mascotStage && finePointer && !reduceMotion) {
    mascotStage.addEventListener("pointermove", function (event) {
      var rect = mascotStage.getBoundingClientRect();
      var px = (event.clientX - rect.left) / rect.width - 0.5;
      var py = (event.clientY - rect.top) / rect.height - 0.5;
      mascotStage.style.setProperty("--px", (px * 14).toFixed(2) + "px");
      mascotStage.style.setProperty("--py", (py * 14).toFixed(2) + "px");
    });
    mascotStage.addEventListener("pointerleave", function () {
      mascotStage.style.setProperty("--px", "0px");
      mascotStage.style.setProperty("--py", "0px");
    });
  }

  var copyButton = qs("#copyDiscord");

  if (copyButton) {
    copyButton.addEventListener("click", function () {
      var handle = "@" + (copyButton.getAttribute("data-handle") || "drek");
      function done() {
        toast(handle + " copied to clipboard", "ok");
        sfx.confirm();
        var label = qs("span", copyButton);
        if (label) {
          var original = label.textContent;
          label.textContent = "Copied!";
          window.setTimeout(function () {
            label.textContent = original;
          }, 1600);
        }
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(handle).then(done, function () {
          toast("Copy failed — handle is " + handle, "err");
        });
      } else {
        toast("Handle is " + handle, "info");
      }
    });
  }

  var faqItems = qsa(".faq__item");

  faqItems.forEach(function (item) {
    item.addEventListener("toggle", function () {
      if (!item.open) {
        return;
      }
      faqItems.forEach(function (other) {
        if (other !== item) {
          other.open = false;
        }
      });
    });
  });

  var yearEl = qs("#year");

  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  window.portfolio = {
    qs: qs,
    qsa: qsa,
    toast: toast,
    sfx: sfx,
    reduceMotion: reduceMotion,
    finePointer: finePointer
  };
})();
