/* ==========================================================================
   Tierheilpraxis JessICan - Designvorschau "Sanft"
   Nur fuer die Seiten unter /prototyp/sanft/.

   Dieses Skript sendet grundsaetzlich keine Daten: kein fetch, kein
   XMLHttpRequest, kein sendBeacon, keine Cookies, kein localStorage und
   kein Service Worker. Die Kontaktseite ist eine reine Frontend-Demo;
   ihre Eingaben verlassen den Browser nicht und werden auch nicht in die
   Adresszeile geschrieben.
   ========================================================================== */
(function () {
  "use strict";

  /* ---------------------------------------------------------------- Menue */
  function initNavigation() {
    var toggle = document.querySelector(".jc-sanft-navtoggle");
    var nav = document.getElementById("jc-sanft-nav");
    if (!toggle || !nav) { return; }

    toggle.hidden = false;
    toggle.disabled = false;

    function setOpen(open) {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.querySelector(".jc-sanft-navtoggle-label").textContent = open ? "Schließen" : "Menü";
    }

    setOpen(false);

    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      setOpen(!open);
      if (!open) {
        var first = nav.querySelector("a");
        if (first) { first.focus(); }
      }
    });

    nav.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
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

    // Beim Wechsel auf breite Bildschirme bleibt die Liste ohnehin sichtbar.
    if (window.matchMedia) {
      var wide = window.matchMedia("(min-width: 1024px)");
      var onChange = function () { if (wide.matches) { setOpen(false); } };
      if (wide.addEventListener) { wide.addEventListener("change", onChange); }
      else if (wide.addListener) { wide.addListener(onChange); }
    }
  }

  /* ------------------------------------------------------------ Demoformular */
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

    var elements = {
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
      ortField: document.getElementById("jc-ort-field"),
      ortReq: document.getElementById("jc-ort-req")
    };

    var anliegenRadios = Array.prototype.slice.call(
      demo.querySelectorAll('input[name="anliegen"]')
    );

    if (elements.check) { elements.check.hidden = false; elements.check.disabled = false; }
    if (elements.clear) { elements.clear.hidden = false; elements.clear.disabled = false; }
    if (elements.noscript) { elements.noscript.hidden = true; }

    function currentAnliegen() {
      for (var i = 0; i < anliegenRadios.length; i += 1) {
        if (anliegenRadios[i].checked) { return anliegenRadios[i].value; }
      }
      return "";
    }

    function needsOrt() {
      var value = currentAnliegen();
      return value === "hund" || value === "pferd";
    }

    function needsTierart() {
      var value = currentAnliegen();
      return value === "kurs" || value === "andere";
    }

    function syncConditional() {
      var showTierart = needsTierart();
      elements.tierartField.hidden = !showTierart;
      if (!showTierart) { elements.tierart.value = "offen"; }

      var ortRequired = needsOrt();
      elements.ort.required = ortRequired;
      elements.ortReq.textContent = ortRequired ? "Pflichtfeld" : "freiwillig";
      if (!ortRequired) { clearFieldError(elements.ort); }
    }

    /* --- Fehlerdarstellung ------------------------------------------------ */
    function fieldWrapOf(control) {
      return control.closest(".jc-sanft-field");
    }

    function clearFieldError(control) {
      var wrap = fieldWrapOf(control);
      if (!wrap) { return; }
      wrap.classList.remove("is-invalid");
      control.removeAttribute("aria-invalid");
      var box = wrap.querySelector(".jc-sanft-error");
      if (box) { box.textContent = ""; }
    }

    function setFieldError(control, message) {
      var wrap = fieldWrapOf(control);
      if (!wrap) { return; }
      wrap.classList.add("is-invalid");
      control.setAttribute("aria-invalid", "true");
      var box = wrap.querySelector(".jc-sanft-error");
      if (box) { box.textContent = message; }
    }

    function clearAllErrors() {
      Array.prototype.forEach.call(
        demo.querySelectorAll(".jc-sanft-field.is-invalid"),
        function (wrap) {
          wrap.classList.remove("is-invalid");
          var box = wrap.querySelector(".jc-sanft-error");
          if (box) { box.textContent = ""; }
          Array.prototype.forEach.call(
            wrap.querySelectorAll("[aria-invalid]"),
            function (control) { control.removeAttribute("aria-invalid"); }
          );
        }
      );
    }

    function clearStatus() {
      elements.status.textContent = "";
    }

    /* --- Pruefung --------------------------------------------------------- */
    function messageFor(control, label) {
      var validity = control.validity;
      if (validity.valueMissing) {
        if (control === elements.email) { return "Bitte trage eine E-Mail-Adresse ein."; }
        if (control === elements.nachricht) { return "Bitte schreibe ein paar Sätze zu deinem Anliegen."; }
        if (control === elements.ort) { return "Bitte nenne Postleitzahl und Ort deines Tieres."; }
        return "Bitte fülle das Feld „" + label + "“ aus.";
      }
      if (validity.typeMismatch && control === elements.email) {
        return "Diese E-Mail-Adresse sieht unvollständig aus. Erwartet wird zum Beispiel name@beispiel.de.";
      }
      if (validity.tooShort) {
        return "Diese Angabe ist noch sehr kurz. Bitte ergänze sie.";
      }
      return "Diese Angabe kann so nicht übernommen werden.";
    }

    function validate() {
      clearAllErrors();
      var problems = [];

      var required = [
        { control: elements.name, label: "Dein Name" },
        { control: elements.email, label: "Deine E-Mail-Adresse" },
        { control: elements.nachricht, label: "Was möchtest du mir mitteilen?" }
      ];

      if (needsOrt()) {
        required.splice(2, 0, { control: elements.ort, label: "Postleitzahl und Ort deines Tieres" });
      }

      required.forEach(function (entry) {
        var control = entry.control;
        if (control.value.trim() === "") {
          control.value = "";
        }
        if (!control.checkValidity()) {
          var message = messageFor(control, entry.label);
          setFieldError(control, message);
          problems.push({ id: control.id, label: entry.label, message: message });
        }
      });

      if (currentAnliegen() === "") {
        var message = "Bitte wähle aus, worum es geht.";
        var wrap = document.getElementById("jc-anliegen-field");
        wrap.classList.add("is-invalid");
        wrap.querySelector(".jc-sanft-error").textContent = message;
        anliegenRadios[0].setAttribute("aria-invalid", "true");
        problems.push({ id: anliegenRadios[0].id, label: "Worum geht es?", message: message });
      }

      var phone = elements.telefon.value.trim();
      if (phone !== "" && !/[0-9]/.test(phone)) {
        var phoneMessage = "Die Telefonnummer enthält keine Ziffer. Lass das Feld sonst einfach leer.";
        setFieldError(elements.telefon, phoneMessage);
        problems.push({ id: elements.telefon.id, label: "Telefonnummer", message: phoneMessage });
      }

      return problems;
    }

    /* --- Ausgabe ---------------------------------------------------------- */
    function showErrors(problems) {
      clearStatus();

      var box = document.createElement("div");
      box.className = "jc-sanft-status-box jc-sanft-status-box--error";
      box.setAttribute("tabindex", "-1");

      var heading = document.createElement("h2");
      heading.textContent = problems.length === 1
        ? "Eine Angabe fehlt noch"
        : problems.length + " Angaben fehlen noch";
      box.appendChild(heading);

      var intro = document.createElement("p");
      intro.textContent = "Der Prototyp prüft deine Eingaben nur im Browser. Es wurde nichts versendet.";
      box.appendChild(intro);

      var list = document.createElement("ul");
      problems.forEach(function (problem) {
        var item = document.createElement("li");
        var link = document.createElement("a");
        link.href = "#" + problem.id;
        link.textContent = problem.label + ": " + problem.message;
        link.addEventListener("click", function (event) {
          event.preventDefault();
          var target = document.getElementById(problem.id);
          if (target) { target.focus(); }
        });
        item.appendChild(link);
        list.appendChild(item);
      });
      box.appendChild(list);

      elements.status.appendChild(box);
      box.focus();
    }

    function labelOfSelect(select) {
      var option = select.options[select.selectedIndex];
      return option ? option.textContent.trim() : "";
    }

    function showSuccess() {
      clearStatus();
      clearAllErrors();

      var box = document.createElement("div");
      box.className = "jc-sanft-status-box jc-sanft-status-box--ok";
      box.setAttribute("tabindex", "-1");

      var heading = document.createElement("h2");
      heading.textContent = "Prototyp-Test abgeschlossen";
      box.appendChild(heading);

      var text = document.createElement("p");
      text.textContent = "Der Ablauf wurde getestet. Es wurde keine Nachricht versendet und kein Termin vereinbart.";
      box.appendChild(text);

      var summary = document.createElement("dl");
      summary.className = "jc-sanft-summary-list";

      function addRow(term, value) {
        if (!value) { return; }
        var dt = document.createElement("dt");
        dt.textContent = term;
        var dd = document.createElement("dd");
        dd.textContent = value;
        summary.appendChild(dt);
        summary.appendChild(dd);
      }

      var anliegenLabel = "";
      anliegenRadios.forEach(function (radio) {
        if (radio.checked) {
          var label = document.querySelector('label[for="' + radio.id + '"]');
          anliegenLabel = label ? label.textContent.trim() : radio.value;
        }
      });

      addRow("Worum es geht", anliegenLabel);
      if (!elements.tierartField.hidden) {
        addRow("Tierart", labelOfSelect(elements.tierart));
      }
      addRow("Ort des Tieres", elements.ort.value.trim());
      addRow("Interesse", labelOfSelect(elements.interesse));

      if (summary.children.length > 0) {
        var summaryIntro = document.createElement("p");
        summaryIntro.textContent = "Diese Auswahl hat der Prototyp übernommen:";
        box.appendChild(summaryIntro);
        box.appendChild(summary);
      }

      var hint = document.createElement("p");
      hint.textContent = "Name, E-Mail-Adresse, Telefonnummer und Nachricht werden hier bewusst nicht noch einmal angezeigt.";
      box.appendChild(hint);

      var actions = document.createElement("div");
      actions.className = "jc-sanft-actions";
      actions.style.marginTop = "1rem";

      var back = document.createElement("button");
      back.type = "button";
      back.className = "jc-sanft-btn jc-sanft-btn--ghost";
      back.textContent = "Zurück zum Bearbeiten";
      back.addEventListener("click", function () {
        elements.edit.hidden = false;
        clearStatus();
        elements.name.focus();
      });

      var clear = document.createElement("button");
      clear.type = "button";
      clear.className = "jc-sanft-btn jc-sanft-btn--ghost";
      clear.textContent = "Eingaben löschen";
      clear.addEventListener("click", resetDemo);

      actions.appendChild(back);
      actions.appendChild(clear);
      box.appendChild(actions);

      elements.status.appendChild(box);
      elements.edit.hidden = true;
      box.focus();
    }

    function resetDemo() {
      [elements.name, elements.email, elements.telefon, elements.ort, elements.nachricht]
        .forEach(function (control) { control.value = ""; });
      anliegenRadios.forEach(function (radio) { radio.checked = false; });
      elements.tierart.value = "offen";
      elements.interesse.value = "offen";
      var anliegenWrap = document.getElementById("jc-anliegen-field");
      anliegenWrap.classList.remove("is-invalid");
      anliegenWrap.querySelector(".jc-sanft-error").textContent = "";
      clearAllErrors();
      clearStatus();
      syncConditional();
      elements.edit.hidden = false;
      elements.name.focus();
    }

    /* --- Ereignisse ------------------------------------------------------- */
    elements.check.addEventListener("click", function () {
      var problems = validate();
      if (problems.length > 0) { showErrors(problems); }
      else { showSuccess(); }
    });

    elements.clear.addEventListener("click", resetDemo);

    anliegenRadios.forEach(function (radio) {
      radio.addEventListener("change", function () {
        var wrap = document.getElementById("jc-anliegen-field");
        wrap.classList.remove("is-invalid");
        wrap.querySelector(".jc-sanft-error").textContent = "";
        anliegenRadios.forEach(function (item) { item.removeAttribute("aria-invalid"); });
        syncConditional();
      });
    });

    [elements.name, elements.email, elements.telefon, elements.ort, elements.nachricht]
      .forEach(function (control) {
        control.addEventListener("input", function () { clearFieldError(control); });
      });

    // Die Eingabetaste loest nur die lokale Pruefung aus. Es gibt kein
    // <form>-Element, also auch keinen nativen Versand und keine Navigation.
    demo.addEventListener("keydown", function (event) {
      if (event.key !== "Enter") { return; }
      var target = event.target;
      if (!target || target.tagName === "TEXTAREA" || target.tagName === "BUTTON") { return; }
      if (target.tagName === "INPUT" || target.tagName === "SELECT") {
        event.preventDefault();
        elements.check.click();
      }
    });

    /* --- Vorauswahl aus erlaubten Queryparametern ------------------------- */
    function applyQuery() {
      if (!window.URLSearchParams) { return; }
      var params = new URLSearchParams(window.location.search);
      var tier = readParam(params, "tier");
      var interesse = readParam(params, "interesse");
      var anliegen = readParam(params, "anliegen");

      var chosen = "";
      if (anliegen === "kurs") { chosen = "kurs"; }
      else if (tier === "hund") { chosen = "hund"; }
      else if (tier === "pferd") { chosen = "pferd"; }

      if (chosen) {
        anliegenRadios.forEach(function (radio) {
          if (radio.value === chosen) { radio.checked = true; }
        });
      }

      syncConditional();

      if (anliegen === "kurs" && tier) {
        elements.tierart.value = tier;
      }
      if (interesse) {
        elements.interesse.value = interesse;
      }
    }

    syncConditional();
    applyQuery();
  }

  function init() {
    initNavigation();
    initDemo();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}());
