/* ==========================================================================
   Tierheilpraxis JessICan - Designvorschau "Komplett"
   Nur fuer die Seiten unter /prototyp/komplett/.

   Dieses Skript sendet grundsaetzlich keine Daten: kein fetch, kein
   XMLHttpRequest, kein sendBeacon, keine Cookies, kein localStorage und
   kein Service Worker. Kontaktseite und Quizze sind reine Frontend-Demos;
   ihre Eingaben verlassen den Browser nicht und werden auch nicht in die
   Adresszeile geschrieben.
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------- Werkzeuge */
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }

  function clearNode(node) {
    while (node.firstChild) { node.removeChild(node.firstChild); }
  }

  /* ------------------------------------------------------------ Navigation */
  function initNavigation() {
    var toggle = document.querySelector(".jc-komplett-navtoggle");
    var nav = document.getElementById("jc-komplett-nav");
    var groups = document.querySelectorAll(".jc-komplett-navgroup");

    // Aufklappgruppen: details/summary funktionieren ohne JavaScript.
    // Hier kommen nur Escape, aria-expanded und das Schliessen der
    // Nachbargruppen dazu.
    each(groups, function (group) {
      var summary = group.querySelector("summary");
      if (!summary) { return; }
      summary.setAttribute("aria-expanded", group.open ? "true" : "false");
      summary.addEventListener("click", function () {
        // details.open kippt erst nach dem Klick; hier den neuen Zustand melden.
        summary.setAttribute("aria-expanded", group.open ? "false" : "true");
      });
      group.addEventListener("toggle", function () {
        summary.setAttribute("aria-expanded", group.open ? "true" : "false");
        if (!group.open) { return; }
        each(groups, function (other) {
          if (other !== group) { other.open = false; }
        });
      });
      group.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && group.open) {
          group.open = false;
          summary.focus();
          // Sonst wuerde dasselbe Escape auch das mobile Menue schliessen.
          event.stopPropagation();
        }
      });
    });

    document.addEventListener("click", function (event) {
      each(groups, function (group) {
        if (group.open && !group.contains(event.target)) { group.open = false; }
      });
    });

    if (!toggle || !nav) { return; }
    toggle.hidden = false;
    toggle.disabled = false;

    function setOpen(open) {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.querySelector(".jc-komplett-navtoggle-label").textContent =
        open ? "Schließen" : "Menü";
      if (!open) { each(groups, function (g) { g.open = false; }); }
    }
    setOpen(false);

    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      setOpen(!open);
      if (!open) {
        var first = nav.querySelector("a, summary");
        if (first) { first.focus(); }
      }
    });

    nav.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && nav.classList.contains("is-open")) {
        var inGroup = event.target.closest && event.target.closest(".jc-komplett-navgroup[open]");
        if (inGroup) { return; }
        setOpen(false);
        toggle.focus();
      }
    });
    toggle.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });
    document.addEventListener("click", function (event) {
      if (toggle.getAttribute("aria-expanded") !== "true") { return; }
      if (nav.contains(event.target) || toggle.contains(event.target)) { return; }
      setOpen(false);
    });

    if (window.matchMedia) {
      var wide = window.matchMedia("(min-width: 1024px)");
      var onChange = function () { if (wide.matches) { setOpen(false); } };
      if (wide.addEventListener) { wide.addEventListener("change", onChange); }
      else if (wide.addListener) { wide.addListener(onChange); }
    }
  }

  /* ---------------------------------------------------------- Kontaktdemo */
  var ALLOWED = {
    tier: ["hund", "pferd", "offen"],
    interesse: ["tcvm", "bioresonanz", "andere", "offen"],
    anliegen: ["kurs"]
  };

  function readParam(params, name) {
    var raw = params.get(name);
    if (!raw) { return null; }
    var value = String(raw).toLowerCase();
    return ALLOWED[name].indexOf(value) !== -1 ? value : null;
  }

  function initDemo() {
    var demo = document.getElementById("jc-demo");
    if (!demo) { return; }

    var el = {
      edit: document.getElementById("jc-demo-edit"),
      status: document.getElementById("jc-demo-status"),
      check: document.getElementById("jc-demo-check"),
      clear: document.getElementById("jc-demo-clear"),
      noscript: document.getElementById("jc-demo-noscript"),
      name: document.getElementById("jc-name"),
      email: document.getElementById("jc-email"),
      telefon: document.getElementById("jc-telefon"),
      ort: document.getElementById("jc-ort"),
      tierart: document.getElementById("jc-tierart"),
      interesse: document.getElementById("jc-interesse"),
      nachricht: document.getElementById("jc-nachricht"),
      tierartField: document.getElementById("jc-tierart-field"),
      ortReq: document.getElementById("jc-ort-req")
    };
    var radios = Array.prototype.slice.call(demo.querySelectorAll('input[name="anliegen"]'));

    el.check.hidden = false; el.check.disabled = false;
    el.clear.hidden = false; el.clear.disabled = false;
    if (el.noscript) { el.noscript.hidden = true; }

    function anliegen() {
      for (var i = 0; i < radios.length; i += 1) {
        if (radios[i].checked) { return radios[i].value; }
      }
      return "";
    }
    function needsOrt() { var v = anliegen(); return v === "hund" || v === "pferd"; }
    function needsTierart() { var v = anliegen(); return v === "kurs" || v === "andere"; }

    function sync() {
      var showTierart = needsTierart();
      el.tierartField.hidden = !showTierart;
      if (!showTierart) { el.tierart.value = "offen"; }
      var req = needsOrt();
      el.ort.required = req;
      el.ortReq.textContent = req ? "Pflichtfeld" : "freiwillig";
      if (!req) { clearFieldError(el.ort); }
    }

    function wrapOf(control) { return control.closest(".jc-komplett-field"); }

    function clearFieldError(control) {
      var wrap = wrapOf(control);
      if (!wrap) { return; }
      wrap.classList.remove("is-invalid");
      control.removeAttribute("aria-invalid");
      var box = wrap.querySelector(".jc-komplett-error");
      if (box) { box.textContent = ""; }
    }
    function setFieldError(control, message) {
      var wrap = wrapOf(control);
      if (!wrap) { return; }
      wrap.classList.add("is-invalid");
      control.setAttribute("aria-invalid", "true");
      var box = wrap.querySelector(".jc-komplett-error");
      if (box) { box.textContent = message; }
    }
    function clearAllErrors() {
      each(demo.querySelectorAll(".jc-komplett-field.is-invalid"), function (wrap) {
        wrap.classList.remove("is-invalid");
        var box = wrap.querySelector(".jc-komplett-error");
        if (box) { box.textContent = ""; }
        each(wrap.querySelectorAll("[aria-invalid]"), function (c) {
          c.removeAttribute("aria-invalid");
        });
      });
    }

    function messageFor(control, label) {
      var v = control.validity;
      if (v.valueMissing) {
        if (control === el.email) { return "Bitte trage eine E-Mail-Adresse ein."; }
        if (control === el.nachricht) { return "Bitte schreibe ein paar Sätze zu deinem Anliegen."; }
        if (control === el.ort) { return "Bitte nenne Postleitzahl und Ort deines Tieres."; }
        return "Bitte fülle das Feld „" + label + "“ aus.";
      }
      if (v.typeMismatch && control === el.email) {
        return "Diese E-Mail-Adresse sieht unvollständig aus. Erwartet wird zum Beispiel name@beispiel.de.";
      }
      return "Diese Angabe kann so nicht übernommen werden.";
    }

    function validate() {
      clearAllErrors();
      var problems = [];
      var required = [
        { control: el.name, label: "Dein Name" },
        { control: el.email, label: "Deine E-Mail-Adresse" },
        { control: el.nachricht, label: "Was möchtest du mir mitteilen?" }
      ];
      if (needsOrt()) {
        required.splice(2, 0, { control: el.ort, label: "Postleitzahl und Ort deines Tieres" });
      }
      required.forEach(function (entry) {
        var c = entry.control;
        if (c.value.trim() === "") { c.value = ""; }
        if (!c.checkValidity()) {
          var m = messageFor(c, entry.label);
          setFieldError(c, m);
          problems.push({ id: c.id, label: entry.label, message: m });
        }
      });
      if (anliegen() === "") {
        var msg = "Bitte wähle aus, worum es geht.";
        var wrap = document.getElementById("jc-anliegen-field");
        wrap.classList.add("is-invalid");
        wrap.querySelector(".jc-komplett-error").textContent = msg;
        radios[0].setAttribute("aria-invalid", "true");
        problems.push({ id: radios[0].id, label: "Worum geht es?", message: msg });
      }
      var phone = el.telefon.value.trim();
      if (phone !== "" && !/[0-9]/.test(phone)) {
        var pm = "Die Telefonnummer enthält keine Ziffer. Lass das Feld sonst einfach leer.";
        setFieldError(el.telefon, pm);
        problems.push({ id: el.telefon.id, label: "Telefonnummer", message: pm });
      }
      return problems;
    }

    function showErrors(problems) {
      clearNode(el.status);
      var box = document.createElement("div");
      box.className = "jc-komplett-statusbox jc-komplett-statusbox--error";
      box.setAttribute("tabindex", "-1");
      var h = document.createElement("h2");
      h.textContent = problems.length === 1
        ? "Eine Angabe fehlt noch"
        : problems.length + " Angaben fehlen noch";
      box.appendChild(h);
      var p = document.createElement("p");
      p.textContent = "Der Prototyp prüft deine Eingaben nur im Browser. Es wurde nichts versendet.";
      box.appendChild(p);
      var ul = document.createElement("ul");
      problems.forEach(function (problem) {
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.href = "#" + problem.id;
        a.textContent = problem.label + ": " + problem.message;
        a.addEventListener("click", function (event) {
          event.preventDefault();
          var t = document.getElementById(problem.id);
          if (t) { t.focus(); }
        });
        li.appendChild(a);
        ul.appendChild(li);
      });
      box.appendChild(ul);
      el.status.appendChild(box);
      box.focus();
    }

    function labelOfSelect(select) {
      var o = select.options[select.selectedIndex];
      return o ? o.textContent.trim() : "";
    }

    function showSuccess() {
      clearNode(el.status);
      clearAllErrors();
      var box = document.createElement("div");
      box.className = "jc-komplett-statusbox jc-komplett-statusbox--ok";
      box.setAttribute("tabindex", "-1");
      var h = document.createElement("h2");
      h.textContent = "Prototyp-Test abgeschlossen";
      box.appendChild(h);
      var p = document.createElement("p");
      p.textContent = "Der Ablauf wurde getestet. Es wurde keine Nachricht versendet und kein Termin vereinbart.";
      box.appendChild(p);

      var dl = document.createElement("dl");
      dl.className = "jc-komplett-summary";
      function row(term, value) {
        if (!value) { return; }
        var dt = document.createElement("dt"); dt.textContent = term;
        var dd = document.createElement("dd"); dd.textContent = value;
        dl.appendChild(dt); dl.appendChild(dd);
      }
      var anliegenLabel = "";
      radios.forEach(function (r) {
        if (r.checked) {
          var lab = document.querySelector('label[for="' + r.id + '"]');
          anliegenLabel = lab ? lab.textContent.trim() : r.value;
        }
      });
      row("Worum es geht", anliegenLabel);
      if (!el.tierartField.hidden) { row("Tierart", labelOfSelect(el.tierart)); }
      row("Ort des Tieres", el.ort.value.trim());
      row("Interesse", labelOfSelect(el.interesse));
      if (dl.children.length > 0) {
        var intro = document.createElement("p");
        intro.textContent = "Diese Auswahl hat der Prototyp übernommen:";
        box.appendChild(intro);
        box.appendChild(dl);
      }
      var hint = document.createElement("p");
      hint.textContent = "Name, E-Mail-Adresse, Telefonnummer und Nachricht werden hier bewusst nicht noch einmal angezeigt.";
      box.appendChild(hint);

      var actions = document.createElement("div");
      actions.className = "jc-komplett-actions jc-komplett-actions--tight";
      var back = document.createElement("button");
      back.type = "button";
      back.className = "jc-komplett-btn jc-komplett-btn--ghost";
      back.textContent = "Zurück zum Bearbeiten";
      back.addEventListener("click", function () {
        el.edit.hidden = false;
        clearNode(el.status);
        el.name.focus();
      });
      var clr = document.createElement("button");
      clr.type = "button";
      clr.className = "jc-komplett-btn jc-komplett-btn--ghost";
      clr.textContent = "Eingaben löschen";
      clr.addEventListener("click", resetDemo);
      actions.appendChild(back);
      actions.appendChild(clr);
      box.appendChild(actions);

      el.status.appendChild(box);
      el.edit.hidden = true;
      box.focus();
    }

    function resetDemo() {
      [el.name, el.email, el.telefon, el.ort, el.nachricht].forEach(function (c) { c.value = ""; });
      radios.forEach(function (r) { r.checked = false; });
      el.tierart.value = "offen";
      el.interesse.value = "offen";
      var wrap = document.getElementById("jc-anliegen-field");
      wrap.classList.remove("is-invalid");
      wrap.querySelector(".jc-komplett-error").textContent = "";
      clearAllErrors();
      clearNode(el.status);
      sync();
      el.edit.hidden = false;
      el.name.focus();
    }

    el.check.addEventListener("click", function () {
      var problems = validate();
      if (problems.length > 0) { showErrors(problems); } else { showSuccess(); }
    });
    el.clear.addEventListener("click", resetDemo);

    radios.forEach(function (r) {
      r.addEventListener("change", function () {
        var wrap = document.getElementById("jc-anliegen-field");
        wrap.classList.remove("is-invalid");
        wrap.querySelector(".jc-komplett-error").textContent = "";
        radios.forEach(function (x) { x.removeAttribute("aria-invalid"); });
        sync();
      });
    });
    [el.name, el.email, el.telefon, el.ort, el.nachricht].forEach(function (c) {
      c.addEventListener("input", function () { clearFieldError(c); });
    });

    // Die Eingabetaste loest nur die lokale Pruefung aus. Es gibt kein
    // <form>-Element, also auch keinen nativen Versand und keine Navigation.
    demo.addEventListener("keydown", function (event) {
      if (event.key !== "Enter") { return; }
      var t = event.target;
      if (!t || t.tagName === "TEXTAREA" || t.tagName === "BUTTON") { return; }
      if (t.tagName === "INPUT" || t.tagName === "SELECT") {
        event.preventDefault();
        el.check.click();
      }
    });

    function applyQuery() {
      if (!window.URLSearchParams) { return; }
      var params = new URLSearchParams(window.location.search);
      var tier = readParam(params, "tier");
      var interesse = readParam(params, "interesse");
      var anl = readParam(params, "anliegen");
      var chosen = "";
      if (anl === "kurs") { chosen = "kurs"; }
      else if (tier === "hund") { chosen = "hund"; }
      else if (tier === "pferd") { chosen = "pferd"; }
      if (chosen) {
        radios.forEach(function (r) { if (r.value === chosen) { r.checked = true; } });
      }
      sync();
      if (anl === "kurs" && tier) { el.tierart.value = tier; }
      if (interesse) { el.interesse.value = interesse; }
    }

    sync();
    applyQuery();
  }

  /* ----------------------------------------------------------------- Quiz */
  var ELEMENT_LABEL = {
    holz: "Holz", feuer: "Feuer", erde: "Erde", metall: "Metall", wasser: "Wasser"
  };
  var ELEMENT_ORDER = ["holz", "feuer", "erde", "metall", "wasser"];

  function initQuiz() {
    var quiz = document.getElementById("jc-quiz");
    if (!quiz) { return; }

    var species = quiz.getAttribute("data-species") === "pferd" ? "pferd" : "hund";
    var tierWort = species === "pferd" ? "Pferd" : "Hund";
    var groups = Array.prototype.slice.call(quiz.querySelectorAll(".jc-komplett-question"));
    var total = groups.length;
    var status = document.getElementById("jc-quiz-status");
    var result = document.getElementById("jc-quiz-result");
    var evaluate = document.getElementById("jc-quiz-eval");
    var reset = document.getElementById("jc-quiz-reset");
    var noscript = document.getElementById("jc-quiz-noscript");
    var counter = document.getElementById("jc-quiz-counter");
    var bar = document.getElementById("jc-quiz-bar");
    var progress = document.getElementById("jc-quiz-progress");

    evaluate.hidden = false; evaluate.disabled = false;
    reset.hidden = false; reset.disabled = false;
    if (noscript) { noscript.hidden = true; }
    if (progress) { progress.hidden = false; }

    function answeredCount() {
      var n = 0;
      groups.forEach(function (g) {
        if (g.querySelector("input:checked")) { n += 1; }
      });
      return n;
    }

    function updateProgress() {
      var n = answeredCount();
      counter.textContent = n + " von " + total + " Fragen beantwortet";
      bar.style.width = Math.round((n / total) * 100) + "%";
    }

    function clearInvalid() {
      groups.forEach(function (g) { g.classList.remove("is-invalid"); });
    }

    function box(kind) {
      var b = document.createElement("div");
      b.className = "jc-komplett-statusbox jc-komplett-statusbox--" + kind;
      b.setAttribute("tabindex", "-1");
      return b;
    }

    function showMissing(missing) {
      clearNode(result);
      var b = box("error");
      var h = document.createElement("h2");
      h.textContent = missing.length === 1
        ? "Eine Frage ist noch offen"
        : missing.length + " Fragen sind noch offen";
      b.appendChild(h);
      var p = document.createElement("p");
      p.textContent = "Bitte beantworte alle " + total + " Fragen. "
        + "„Kann ich nicht einschätzen“ ist dabei eine vollwertige Antwort.";
      b.appendChild(p);
      var ul = document.createElement("ul");
      missing.forEach(function (g) {
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.href = "#" + g.id;
        a.textContent = "Frage " + g.getAttribute("data-index") + ": "
          + g.getAttribute("data-short");
        a.addEventListener("click", function (event) {
          event.preventDefault();
          var first = g.querySelector("input");
          if (first) { first.focus(); }
        });
        li.appendChild(a);
        ul.appendChild(li);
      });
      b.appendChild(ul);
      result.appendChild(b);
      b.focus();
    }

    function scoreList(counts, scored) {
      var ul = document.createElement("ul");
      ul.className = "jc-komplett-scores";
      ELEMENT_ORDER.forEach(function (key) {
        var li = document.createElement("li");
        var name = document.createElement("b");
        name.textContent = ELEMENT_LABEL[key];
        var barWrap = document.createElement("span");
        barWrap.className = "jc-komplett-scorebar";
        barWrap.style.setProperty("--el", "var(--el-" + key + ")");
        var fill = document.createElement("i");
        fill.style.width = scored > 0 ? Math.round((counts[key] / scored) * 100) + "%" : "0%";
        barWrap.appendChild(fill);
        var num = document.createElement("span");
        num.textContent = counts[key] + "×";
        li.appendChild(name);
        li.appendChild(barWrap);
        li.appendChild(num);
        ul.appendChild(li);
      });
      return ul;
    }

    function linkRow(links) {
      var wrap = document.createElement("div");
      wrap.className = "jc-komplett-actions jc-komplett-actions--tight";
      links.forEach(function (entry, index) {
        var a = document.createElement("a");
        a.className = "jc-komplett-btn" + (index === 0 ? "" : " jc-komplett-btn--ghost");
        a.href = entry.href;
        a.textContent = entry.text;
        wrap.appendChild(a);
      });
      return wrap;
    }

    function showResult() {
      clearInvalid();
      var missing = groups.filter(function (g) { return !g.querySelector("input:checked"); });
      if (missing.length > 0) {
        missing.forEach(function (g) { g.classList.add("is-invalid"); });
        showMissing(missing);
        return;
      }

      var counts = { holz: 0, feuer: 0, erde: 0, metall: 0, wasser: 0 };
      var scored = 0;
      groups.forEach(function (g) {
        var chosen = g.querySelector("input:checked");
        var cat = chosen.getAttribute("data-category");
        if (cat && counts.hasOwnProperty(cat)) { counts[cat] += 1; scored += 1; }
      });

      clearNode(result);
      var b = box("ok");

      if (scored < 5) {
        var hHint = document.createElement("h2");
        hHint.textContent = "Für eine Einordnung reichen die Angaben noch nicht";
        b.appendChild(hHint);
        var pHint = document.createElement("p");
        pHint.textContent = "Du hast " + scored + " von " + total + " Fragen mit einer "
          + "Beobachtung beantwortet. Ab fünf einschätzbaren Antworten zeige ich, "
          + "welche Beschreibungen häufiger vorkommen. Das ist eine redaktionelle "
          + "Faustregel, keine geprüfte Auswertungsgrenze.";
        b.appendChild(pHint);
        var pHint2 = document.createElement("p");
        pHint2.textContent = "Es ist völlig in Ordnung, wenn du eine Situation nicht "
          + "einschätzen kannst. Vielleicht ist genau das eine gute Frage für unser Gespräch.";
        b.appendChild(pHint2);
        b.appendChild(scoreList(counts, scored));
      } else {
        var h = document.createElement("h2");
        h.textContent = "In deinen Antworten tauchen diese Beschreibungen häufiger auf.";
        b.appendChild(h);

        var max = 0;
        ELEMENT_ORDER.forEach(function (k) { if (counts[k] > max) { max = counts[k]; } });
        var top = ELEMENT_ORDER.filter(function (k) { return counts[k] === max && max > 0; });
        var topNames = top.map(function (k) { return ELEMENT_LABEL[k]; });
        var pTop = document.createElement("p");
        if (top.length === 1) {
          pTop.textContent = "Am häufigsten kommt die Beschreibung " + topNames[0]
            + " vor (" + max + " von " + scored + " einschätzbaren Antworten).";
        } else {
          pTop.textContent = "Gleich häufig kommen die Beschreibungen "
            + topNames.slice(0, -1).join(", ") + " und " + topNames[topNames.length - 1]
            + " vor (je " + max + " von " + scored + " einschätzbaren Antworten).";
        }
        b.appendChild(pTop);
        b.appendChild(scoreList(counts, scored));

        var pEnd = document.createElement("p");
        pEnd.textContent = "Dein " + tierWort + " muss sich nicht auf eine Beschreibung "
          + "festlegen lassen. Unterschiedliche Situationen können zu unterschiedlichen "
          + "Beobachtungen führen.";
        pEnd.style.marginTop = "1rem";
        b.appendChild(pEnd);

        if (species === "hund") {
          var readMore = document.createElement("p");
          readMore.textContent = "Weiterlesen zu den häufigsten Beschreibungen:";
          b.appendChild(readMore);
          var ul = document.createElement("ul");
          top.forEach(function (key) {
            var li = document.createElement("li");
            var a = document.createElement("a");
            a.href = "/prototyp/komplett/elemente/hund/" + key + "/";
            a.textContent = "Profil " + ELEMENT_LABEL[key] + " beim Hund";
            li.appendChild(a);
            ul.appendChild(li);
          });
          b.appendChild(ul);
        }
      }

      var pSafe = document.createElement("p");
      pSafe.textContent = "Das Ergebnis ist eine redaktionelle Zuordnung, keine Diagnose "
        + "und kein wissenschaftlich validierter Persönlichkeitstest. Es wurde nichts "
        + "gespeichert und nichts versendet.";
      b.appendChild(pSafe);

      b.appendChild(linkRow(species === "hund"
        ? [{ href: "/prototyp/komplett/elemente/hund/", text: "Alle Hund-Profile" },
           { href: "/prototyp/komplett/leistungen/tcvm/", text: "TCVM kennenlernen" },
           { href: "/prototyp/komplett/kurse/akupressur-hund/", text: "Akupressurkurs für Hunde" }]
        : [{ href: "/prototyp/komplett/elemente/pferd/", text: "Zurück zur Pferde-Einführung" },
           { href: "/prototyp/komplett/leistungen/tcvm/", text: "TCVM kennenlernen" },
           { href: "/prototyp/komplett/kurse/akupressur-pferd/", text: "Akupressurkurs für Pferde" }]));

      result.appendChild(b);
      b.focus();
    }

    function resetQuiz() {
      each(quiz.querySelectorAll('input[type="radio"]'), function (r) { r.checked = false; });
      clearInvalid();
      clearNode(result);
      updateProgress();
      var first = quiz.querySelector('input[type="radio"]');
      if (first) { first.focus(); }
    }

    each(quiz.querySelectorAll('input[type="radio"]'), function (r) {
      r.addEventListener("change", function () {
        var group = r.closest(".jc-komplett-question");
        if (group) { group.classList.remove("is-invalid"); }
        updateProgress();
      });
    });

    evaluate.addEventListener("click", showResult);
    reset.addEventListener("click", resetQuiz);

    // Eingabetaste im Quiz loest nur die lokale Auswertung aus.
    quiz.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && event.target.tagName === "INPUT") {
        event.preventDefault();
        evaluate.click();
      }
    });

    if (status) { status.hidden = true; }
    updateProgress();
  }

  function init() {
    initNavigation();
    initDemo();
    initQuiz();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}());
