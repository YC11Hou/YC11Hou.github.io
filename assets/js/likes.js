// Likes + guestbook (backend: cf/likes — Cloudflare Worker + KV).
// Any element with data-like-id renders a heart with a live count. Clicking
// likes it (anonymous, once per visitor per day) and then offers an optional
// name / note. Elements with data-like-notes also list recent notes.
(function () {
  var API = document.documentElement.getAttribute("data-likes-api") || "";
  if (!API) return;
  var hosts = Array.prototype.slice.call(document.querySelectorAll("[data-like-id]"));
  if (!hosts.length) return;

  function t(key, fallback) {
    var v = window.siteI18n && window.siteI18n.t(key);
    return v || fallback;
  }
  function tr(el) {
    if (window.siteI18n) window.siteI18n.translate(el);
  }
  function liked(id) {
    try {
      return localStorage.getItem("liked:" + id) === "1";
    } catch (e) {
      return false;
    }
  }
  function remember(id) {
    try {
      localStorage.setItem("liked:" + id, "1");
    } catch (e) {
      /* private mode */
    }
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function build(host) {
    var id = host.getAttribute("data-like-id");
    host.classList.add("likes");
    host.innerHTML =
      '<button type="button" class="like-btn" aria-pressed="false">' +
      '<i class="fa-regular fa-heart" aria-hidden="true"></i><span class="like-count">–</span>' +
      '<span class="like-label" data-i18n="ui.like">Like</span></button>' +
      '<button type="button" class="like-note-btn"><i class="fa-regular fa-comment" aria-hidden="true"></i><span data-i18n="ui.leave_note">Leave a note</span></button>' +
      '<form class="like-form" hidden>' +
      '<input class="like-name" type="text" maxlength="40" required data-i18n-attr="placeholder:ui.your_name" placeholder="Your name">' +
      '<input class="like-email" type="email" maxlength="80" required data-i18n-attr="placeholder:ui.your_email" placeholder="Email (required, not shown)">' +
      '<input class="like-text" type="text" maxlength="140" required data-i18n-attr="placeholder:ui.your_note" placeholder="Your note">' +
      '<button type="submit" class="like-send" data-i18n="ui.send">Send</button>' +
      "</form>" +
      '<p class="like-thanks" hidden data-i18n="ui.thanks">Thank you!</p>' +
      (host.hasAttribute("data-like-notes") ? '<ol class="like-notes" hidden></ol>' : "");
    tr(host);

    var btn = host.querySelector(".like-btn");
    var icon = btn.querySelector("i");
    var count = host.querySelector(".like-count");
    var label = host.querySelector(".like-label");
    var form = host.querySelector(".like-form");
    var thanks = host.querySelector(".like-thanks");
    var notes = host.querySelector(".like-notes");

    function setLiked() {
      btn.classList.add("liked");
      btn.setAttribute("aria-pressed", "true");
      icon.className = "fa-solid fa-heart";
      label.setAttribute("data-i18n", "ui.liked");
      label.textContent = t("ui.liked", "Liked");
    }
    if (liked(id)) setLiked();

    host.querySelector(".like-note-btn").addEventListener("click", function () {
      form.hidden = !form.hidden;
      if (!form.hidden) form.querySelector(".like-name").focus();
    });

    btn.addEventListener("click", function () {
      if (btn.classList.contains("liked")) {
        form.hidden = !form.hidden;
        return;
      }
      btn.disabled = true;
      fetch(API + "/like", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id }) })
        .then(function (r) {
          return r.json();
        })
        .then(function (j) {
          count.textContent = j.count;
          remember(id);
          setLiked();
          form.hidden = false;
          var first = form.querySelector(".like-name");
          if (first) first.focus();
        })
        .catch(function () {})
        .then(function () {
          btn.disabled = false;
        });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = form.querySelector(".like-name").value.trim();
      var email = form.querySelector(".like-email").value.trim();
      var text = form.querySelector(".like-text").value.trim();
      // A note is only sent with a real name and a valid e-mail (the server enforces the same)
      if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email) || !text) {
        form.classList.add("invalid");
        return;
      }
      form.classList.remove("invalid");
      fetch(API + "/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id, name: name, email: email, text: text }),
      })
        .then(function (r) {
          if (!r.ok) throw new Error(String(r.status));
        })
        .then(function () {
          form.hidden = true;
          thanks.hidden = false;
          setTimeout(function () {
            thanks.hidden = true;
          }, 3000);
          if (notes) loadNotes();
        })
        .catch(function () {});
    });

    function loadNotes() {
      fetch(API + "/notes?id=" + encodeURIComponent(id) + "&limit=12")
        .then(function (r) {
          return r.json();
        })
        .then(function (j) {
          if (!j.notes || !j.notes.length) {
            notes.hidden = true;
            return;
          }
          notes.innerHTML = j.notes
            .map(function (n) {
              var who = n.name ? esc(n.name) : '<span data-i18n="ui.anonymous">' + t("ui.anonymous", "Anonymous") + "</span>";
              return '<li><span class="like-note-text">' + esc(n.text) + '</span><span class="like-note-who">— ' + who + "</span></li>";
            })
            .join("");
          notes.hidden = false;
        })
        .catch(function () {});
    }
    if (notes) loadNotes();
    return { id: id, count: count };
  }

  var items = hosts.map(build);
  var ids = items.map(function (i) {
    return i.id;
  });
  fetch(API + "/likes?ids=" + encodeURIComponent(ids.join(",")))
    .then(function (r) {
      return r.json();
    })
    .then(function (j) {
      items.forEach(function (i) {
        var n = j.counts && j.counts[i.id];
        i.count.textContent = typeof n === "number" ? n : 0;
      });
    })
    .catch(function () {
      items.forEach(function (i) {
        i.count.textContent = "";
      });
    });

  document.addEventListener("i18n:applied", function () {
    hosts.forEach(tr);
  });
})();
