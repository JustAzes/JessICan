/* Gemeinsame Logik für die Element-Quizze (Pferd und Hund).
 *
 * Die Seite liefert:
 *   <script id="quizData" type="application/json">  { total, questions: [{q, a[5]}] }
 *   window.QUIZ_CONFIG = { imgBase, contactUrl, methodsUrl, elementsUrl, animal, animalPossessive }
 *   window.QUIZ_TEXTS  = { single: { Holz: "<p>…" , … }, mix: { "Holz+Feuer": "<p>…", … } }
 *
 * Erwartetes Markup: #quizContainer, #quizForm, #quizProgress, #answeredCount,
 * #submitCount, #evalBtn, #resultBox, #resultNote, #resultCard, #resultKicker,
 * #resultTitle, #resultText, #resultImg1, #resultImg2, #mixPlus
 */
(function () {
  'use strict';

  function init() {
    var dataEl = document.getElementById('quizData');
    if (!dataEl) { return; }

    var cfg = JSON.parse(dataEl.textContent);
    var opts = window.QUIZ_CONFIG || {};
    var texts = window.QUIZ_TEXTS || { single: {}, mix: {} };

    var TOTAL = cfg.total || (cfg.questions ? cfg.questions.length : 0);
    var container = document.getElementById('quizContainer');
    var form = document.getElementById('quizForm');
    if (!container || !form) { return; }

    var letters = ['A', 'B', 'C', 'D', 'E'];
    var letterToElement = { 'A': 'Holz', 'B': 'Feuer', 'C': 'Erde', 'D': 'Metall', 'E': 'Wasser' };
    var elementOrder = ['Holz', 'Feuer', 'Erde', 'Metall', 'Wasser'];
    var elementSlug = { 'Holz': 'holz', 'Feuer': 'feuer', 'Erde': 'erde', 'Metall': 'metall', 'Wasser': 'wasser' };

    var animal = opts.animal || 'Tier';
    var possessive = opts.animalPossessive || ('dein ' + animal);

    /* --- Fragen rendern --------------------------------------------------- */

    cfg.questions.forEach(function (q, idx) {
      var no = idx + 1;

      var card = document.createElement('fieldset');
      card.className = 'quiz-card';
      card.id = 'frage-' + no;

      var legend = document.createElement('legend');
      var num = document.createElement('span');
      num.className = 'quiz-card-no';
      num.textContent = 'Frage ' + no + ' von ' + TOTAL;
      var text = document.createElement('span');
      text.className = 'quiz-card-q';
      text.textContent = q.q;
      legend.appendChild(num);
      legend.appendChild(text);
      card.appendChild(legend);

      var options = document.createElement('div');
      options.className = 'quiz-options';

      q.a.forEach(function (answer, i) {
        var val = letters[i];
        var wrap = document.createElement('div');
        wrap.className = 'quiz-option';

        var input = document.createElement('input');
        input.type = 'radio';
        input.className = 'quiz-input';
        input.name = 'q' + no;
        input.id = 'q' + no + '_' + val;
        input.value = val;

        var label = document.createElement('label');
        label.setAttribute('for', input.id);
        label.appendChild(document.createTextNode(answer));

        wrap.appendChild(input);
        wrap.appendChild(label);
        options.appendChild(wrap);
      });

      card.appendChild(options);
      container.appendChild(card);
    });

    /* --- Fortschritt ------------------------------------------------------ */

    var progressBar = document.getElementById('quizProgress');
    var answeredCountEl = document.getElementById('answeredCount');
    var submitCountEl = document.getElementById('submitCount');

    function questionNames() {
      var names = [];
      for (var i = 1; i <= TOTAL; i++) { names.push('q' + i); }
      return names;
    }

    function countAnswered() {
      var answered = 0;
      questionNames().forEach(function (n, i) {
        var card = document.getElementById('frage-' + (i + 1));
        if (form.querySelector('input[name="' + n + '"]:checked')) {
          answered++;
          if (card) { card.classList.add('is-answered'); }
        } else if (card) {
          card.classList.remove('is-answered');
        }
      });
      if (progressBar) {
        progressBar.style.width = (answered / TOTAL * 100) + '%';
        progressBar.setAttribute('aria-valuenow', answered);
        progressBar.setAttribute('aria-valuemax', TOTAL);
      }
      if (answeredCountEl) { answeredCountEl.textContent = answered; }
      if (submitCountEl) { submitCountEl.textContent = answered; }
      return answered;
    }

    form.addEventListener('change', function (e) {
      if (e.target.classList && e.target.classList.contains('quiz-input')) { countAnswered(); }
    });

    /* --- Auswertung ------------------------------------------------------- */

    var resultBox = document.getElementById('resultBox');
    var resultNote = document.getElementById('resultNote');
    var resultCard = document.getElementById('resultCard');
    var resultKicker = document.getElementById('resultKicker');
    var resultTitle = document.getElementById('resultTitle');
    var resultText = document.getElementById('resultText');
    var img1 = document.getElementById('resultImg1');
    var img2 = document.getElementById('resultImg2');
    var mixPlus = document.getElementById('mixPlus');

    function setImage(img, element) {
      img.src = opts.imgBase + elementSlug[element] + '.jpg';
      img.alt = 'Sinnbild für das Element ' + element;
      img.hidden = false;
    }

    function resetResult() {
      img1.hidden = true; img2.hidden = true; mixPlus.hidden = true;
      img1.removeAttribute('src'); img2.removeAttribute('src');
      img1.alt = ''; img2.alt = '';
      resultCard.className = 'quiz-result-card';
    }

    function link(url, label) {
      return '<a href="' + url + '">' + label + '</a>';
    }

    function evaluate() {
      var counts = { 'Holz': 0, 'Feuer': 0, 'Erde': 0, 'Metall': 0, 'Wasser': 0 };
      questionNames().forEach(function (n) {
        var checked = form.querySelector('input[name="' + n + '"]:checked');
        if (checked) {
          var el = letterToElement[checked.value];
          counts[el] = (counts[el] || 0) + 1;
        }
      });

      var answered = elementOrder.reduce(function (a, k) { return a + counts[k]; }, 0);

      resultBox.hidden = false;

      if (answered === 0) {
        resultNote.hidden = false;
        resultNote.textContent = 'Bitte beantworte mindestens eine Frage, um eine Tendenz zu erhalten.';
        resultCard.hidden = true;
        document.getElementById('frage-1').scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      resultNote.hidden = true;
      resultCard.hidden = false;
      resetResult();

      var max = Math.max.apply(null, elementOrder.map(function (k) { return counts[k]; }));
      var tops = elementOrder.filter(function (k) { return counts[k] === max && max > 0; });

      var closing = '<p>Möchtest du wissen, welche meiner Methoden dazu besonders gut passen? '
        + link(opts.methodsUrl, 'Hier findest du eine Übersicht') + ' – oder '
        + link(opts.contactUrl, 'sprich mich direkt an') + '.</p>';

      if (tops.length === 1) {
        var el = tops[0];
        resultCard.className = 'quiz-result-card quiz-result--' + elementSlug[el];
        resultKicker.textContent = 'Dein Ergebnis · ' + counts[el] + ' von ' + answered + ' Antworten';
        resultTitle.textContent = 'Element ' + el;
        setImage(img1, el);
        resultText.innerHTML = (texts.single[el] || '<p>Kurze Beschreibung folgt.</p>') + closing;
      } else {
        var sorted = tops.slice().sort(function (a, b) {
          return elementOrder.indexOf(a) - elementOrder.indexOf(b);
        });

        resultCard.className = 'quiz-result-card quiz-result--mix';
        resultKicker.textContent = 'Dein Ergebnis · Mischtyp';
        resultTitle.textContent = sorted.join(' + ');

        setImage(img1, sorted[0]);
        if (sorted.length >= 2) {
          mixPlus.hidden = false;
          setImage(img2, sorted[1]);
        }

        if (sorted.length === 2) {
          var key = sorted[0] + '+' + sorted[1];
          resultText.innerHTML = (texts.mix[key]
            || '<p>' + possessive.charAt(0).toUpperCase() + possessive.slice(1)
               + ' vereint zwei Elemente ausgewogen: ' + sorted[0] + ' und ' + sorted[1] + '.</p>')
            + '<p>Gern bespreche ich mit dir, welche Bausteine für Alltag und Training zu '
            + possessive + ' passen. ' + link(opts.contactUrl, 'Kontakt aufnehmen') + '.</p>';
        } else {
          resultText.innerHTML =
            '<p><strong>Vielschichtig:</strong> ' + possessive.charAt(0).toUpperCase() + possessive.slice(1)
            + ' zeigt Anteile von ' + sorted.join(', ')
            + '. Das ist völlig normal – entscheidend ist, die Stärken gezielt einzusetzen und sensible Punkte zu respektieren.</p>'
            + '<p><strong>Im Alltag:</strong> Beginne mit dem gemeinsamen Nenner – meist einer verlässlichen Routine – und ergänze je nach Tagesform Anteile aus den weiteren Elementen: spielerische Motivation, klare Aufgaben oder mehr Abstand und Sicherheit.</p>'
            + '<p>Für einen individuellen Plan ' + link(opts.contactUrl, 'sprich mich gern an') + '.</p>';
        }
      }

      resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    var evalBtn = document.getElementById('evalBtn');
    if (evalBtn) { evalBtn.addEventListener('click', evaluate); }
    countAnswered();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
