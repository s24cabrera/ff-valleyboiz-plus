/* Shared helpers: data loading, chrome + filters, theme, formatting,
   avatars, tooltip, sortable tables, and small chart builders. */
(function () {
  const FFL = (window.FFL = {});

  // ---------- theme ----------
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };
  const applyTheme = (t) => t ? document.documentElement.setAttribute("data-theme", t)
    : document.documentElement.removeAttribute("data-theme");
  applyTheme(store.get("ffl-theme"));
  const isDark = () => {
    const t = document.documentElement.getAttribute("data-theme");
    return t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  };
  const ICON_SUN = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const ICON_MENU = '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
  const ICON_CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  const ICON_MOON = '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

  // ---------- formatting ----------
  const esc = (FFL.esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  FFL.fmt = (n, d = 2) => (n == null || isNaN(n) ? "–" : Number(n).toFixed(d));
  FFL.pct = (n) => (n == null ? "–" : n.toFixed(3).replace(/^0/, ""));
  FFL.pct100 = (n) => (n == null ? "–" : Math.round(n * 100) + "%");
  FFL.signed = (n, d = 2) => (n == null ? "–" : (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toFixed(d));
  FFL.rec = (w, l, t) => `${w}-${l}${t ? "-" + t : ""}`;
  FFL.ordinal = (n) => {
    if (n == null) return "–";
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  FFL.$ = (sel, root) => (root || document).querySelector(sel);
  FFL.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  FFL.name = (id) => (FFL.data && FFL.data.managers[id]) || "Unknown";
  FFL.short = (id) => {
    const parts = FFL.name(id).split(" ");
    return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
  };
  FFL.initials = (s) => String(s || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  FFL.cls = (n) => (n > 0 ? "pos" : n < 0 ? "neg" : "");

  // ---------- images ----------
  // Team avatar: downloaded logo if we have it, else initials.
  FFL.avatar = (logo, label, size = 32) => {
    const style = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px`;
    const fallback = esc(FFL.initials(label));
    if (!logo) return `<span class="av" style="${style}" aria-hidden="true">${fallback}</span>`;
    return `<span class="av" style="${style}" aria-hidden="true"><img src="${esc(logo)}" alt="" loading="lazy" ` +
      `onerror="this.parentNode.textContent='${fallback}'"></span>`;
  };
  // Manager profile link (keeps the league param if one is set)
  FFL.mgrHref = (mgr) => {
    const p = new URLSearchParams();
    const lg = new URLSearchParams(location.search).get("league");
    if (lg) p.set("league", lg);
    p.set("mgr", mgr);
    return "manager.html?" + p;
  };
  FFL.mgrLink = (mgr, label) => `<a class="mlink" href="${esc(FFL.mgrHref(mgr))}">${esc(label || FFL.name(mgr))}</a>`;
  FFL.who = (mgr, team, logo, size = 32) =>
    `<div class="who">${FFL.avatar(logo, FFL.name(mgr), size)}<div class="names"><b>${FFL.mgrLink(mgr)}</b>` +
    (team ? `<span title="${esc(team)}">${esc(team)}</span>` : "") + `</div></div>`;

  // ---------- rivalries (from the all-time game log) ----------
  // Game log rows: [season, week, "r"|"p", home mgr, away mgr, home pts, away pts, multiWeek]
  const before = (g, at) => !at || g[0] < at[0] || (g[0] === at[0] && g[1] < at[1]);
  /** a's meetings with b, oldest first. at = [season, week] to only count games before it. */
  FFL.meetings = (a, b, at) => FFL.data.record_book.games.filter((g) => before(g, at) &&
    ((g[3] === a && g[4] === b) || (g[3] === b && g[4] === a))).map((g) => {
    const home = g[3] === a, me = home ? g[5] : g[6], them = home ? g[6] : g[5];
    return { season: g[0], week: g[1], po: g[2] === "p", me, them, multi: !!g[7], res: me > them ? "W" : me < them ? "L" : "T" };
  });
  /** Series summary from a's side: record, points, streak, last meeting, playoff meetings. */
  FFL.series = (a, b, at) => {
    const ms = FFL.meetings(a, b, at);
    const s = { opp: b, games: ms.length, w: 0, l: 0, t: 0, pf: 0, pa: 0, po: ms.filter((m) => m.po), last: ms[ms.length - 1] || null, streak: null };
    ms.forEach((m) => { s[m.res.toLowerCase()]++; s.pf += m.me; s.pa += m.them; });
    s.pct = s.games ? (s.w + 0.5 * s.t) / s.games : null;
    if (ms.length) {
      const last = ms[ms.length - 1].res;
      let n = 0;
      for (let i = ms.length - 1; i >= 0 && ms[i].res === last; i--) n++;
      s.streak = { res: last, n };
    }
    const decided = ms.filter((m) => !m.multi);
    s.bestWin = decided.filter((m) => m.res === "W").sort((x, y) => (y.me - y.them) - (x.me - x.them))[0] || null;
    s.worstLoss = decided.filter((m) => m.res === "L").sort((x, y) => (x.me - x.them) - (y.me - y.them))[0] || null;
    return s;
  };
  FFL.RIVAL_MIN_GAMES = 4;
  /** Every opponent's series for manager m, plus nemesis / favorite victim / arch-rival. */
  FFL.rivals = (m) => {
    const opps = new Set();
    FFL.data.record_book.games.forEach((g) => { if (g[3] === m) opps.add(g[4]); if (g[4] === m) opps.add(g[3]); });
    const list = [...opps].map((o) => FFL.series(m, o));
    const qual = list.filter((s) => s.games >= FFL.RIVAL_MIN_GAMES);
    const by = (f) => qual.slice().sort(f)[0] || null;
    const nemesis = by((x, y) => x.pct - y.pct || y.games - x.games);
    const victim = by((x, y) => y.pct - x.pct || y.games - x.games);
    // Arch-rival: many meetings (playoff games count double) and a close series
    const heat = (s) => (s.games + s.po.length) * (1 - Math.abs(s.pct - 0.5) * 2);
    const arch = by((x, y) => heat(y) - heat(x));
    return { list, nemesis: nemesis && nemesis.pct < 0.5 ? nemesis : null, victim: victim && victim.pct > 0.5 ? victim : null, arch };
  };
  /** Story tags for an upcoming/played game between a and b at [season, week]. */
  FFL.gameFlags = (a, b, at) => {
    const flags = [];
    const s = FFL.series(a, b, at);
    if (!s.games) return flags;
    if (s.streak && s.streak.n >= 2) {
      const loser = s.streak.res === "W" ? b : s.streak.res === "L" ? a : null;
      if (loser) flags.push({ cls: "warn", text: `Revenge game · ${FFL.short(loser)} lost the last ${s.streak.n}` });
    }
    const ra = FFL.rivals(a), rb = FFL.rivals(b);
    if ((ra.nemesis && ra.nemesis.opp === b) || (rb.nemesis && rb.nemesis.opp === a)) {
      const who = ra.nemesis && ra.nemesis.opp === b ? a : b;
      flags.push({ cls: "accent", text: `Nemesis matchup for ${FFL.short(who)}` });
    } else if (ra.arch && ra.arch.opp === b) {
      flags.push({ cls: "accent", text: "Arch-rivals" });
    }
    if (s.po.length) { const p = s.po[s.po.length - 1]; flags.push({ cls: "", text: `Playoff rematch · ${p.season}` }); }
    return flags.slice(0, 2);
  };

  // ESPN pro team id -> abbreviation (for D/ST logos)
  const PRO = { 1: "atl", 2: "buf", 3: "chi", 4: "cin", 5: "cle", 6: "dal", 7: "den", 8: "det", 9: "gb", 10: "ten",
    11: "ind", 12: "kc", 13: "lv", 14: "lar", 15: "mia", 16: "min", 17: "ne", 18: "no", 19: "nyg", 20: "nyj",
    21: "phi", 22: "ari", 23: "pit", 24: "lac", 25: "sf", 26: "sea", 27: "tb", 28: "wsh", 29: "car", 30: "jax",
    33: "bal", 34: "hou" };
  FFL.proAbbr = (id) => (PRO[id] || "").toUpperCase();
  FFL.headshot = (p, size = 40) => {
    if (!p) return "";
    const src = p.pos === "D/ST" || p.id < 0
      ? (PRO[p.pro] ? `https://a.espncdn.com/i/teamlogos/nfl/500/${PRO[p.pro]}.png` : "")
      : `https://a.espncdn.com/i/headshots/nfl/players/full/${p.id}.png`;
    const fb = esc(FFL.initials(p.n));
    const style = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.36)}px`;
    if (!src) return `<span class="av" style="${style}">${fb}</span>`;
    return `<span class="av" style="${style}"><img class="head" src="${src}" alt="" loading="lazy" ` +
      `onerror="this.parentNode.textContent='${fb}'"></span>`;
  };

  FFL.chips = (results) =>
    `<span class="form">${(results || []).map((r) => `<span class="chip ${r}" title="${r === "W" ? "Win" : r === "L" ? "Loss" : "Tie"}">${r}</span>`).join("")}</span>`;

  // Rank sparkline: rank 1 at the top.
  FFL.spark = (ranks, maxRank, w = 84, h = 24) => {
    if (!ranks || ranks.length < 2) return "";
    const x = (i) => 4 + (i * (w - 8)) / (ranks.length - 1);
    const y = (r) => 4 + ((r - 1) * (h - 8)) / Math.max(1, maxRank - 1);
    const d = ranks.map((r, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(r).toFixed(1)}`).join("");
    const last = ranks.length - 1;
    return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Rank by week: ${ranks.join(", ")}">` +
      `<path d="${d}"/><circle cx="${x(last)}" cy="${y(ranks[last])}" r="3.5"/></svg>`;
  };

  // ---------- tooltip ----------
  let tipEl;
  FFL.tip = {
    // rows: [{v: "value", l: "label", color?}] — built with textContent (names are untrusted)
    show(evt, title, rows) {
      if (!tipEl) { tipEl = document.createElement("div"); tipEl.id = "tip"; document.body.appendChild(tipEl); }
      tipEl.textContent = "";
      if (title) { const t = document.createElement("div"); t.className = "tl"; t.textContent = title; tipEl.appendChild(t); }
      rows.forEach((r) => {
        const row = document.createElement("div"); row.className = "tr";
        if (r.color) { const k = document.createElement("span"); k.className = "key"; k.style.background = r.color; row.appendChild(k); }
        const v = document.createElement("span"); v.className = "tv"; v.textContent = r.v; row.appendChild(v);
        if (r.l) { const l = document.createElement("span"); l.className = "tl"; l.textContent = r.l; row.appendChild(l); }
        tipEl.appendChild(row);
      });
      const pt = evt.touches ? evt.touches[0] : evt;
      const x = Math.min(pt.clientX + 14, window.innerWidth - tipEl.offsetWidth - 8);
      const y = pt.clientY + 16 + tipEl.offsetHeight > window.innerHeight ? pt.clientY - tipEl.offsetHeight - 12 : pt.clientY + 16;
      tipEl.style.left = Math.max(8, x) + "px"; tipEl.style.top = y + "px";
      tipEl.classList.add("on");
    },
    hide() { if (tipEl) tipEl.classList.remove("on"); },
  };
  // Attach hover + keyboard-focus tooltips to elements carrying data-tip index.
  FFL.bindTips = (root, getter) => {
    root.querySelectorAll("[data-tip]").forEach((el) => {
      const show = (e) => { const t = getter(+el.dataset.tip); FFL.tip.show(e.type === "focus" ? rectEvt(el) : e, t.title, t.rows); };
      el.addEventListener("pointermove", show);
      el.addEventListener("focus", show);
      el.addEventListener("pointerleave", FFL.tip.hide);
      el.addEventListener("blur", FFL.tip.hide);
    });
  };
  const rectEvt = (el) => { const r = el.getBoundingClientRect(); return { clientX: r.left + r.width / 2, clientY: r.bottom }; };

  // ---------- cards ----------
  FFL.section = (id, title, scope) =>
    `<section id="${id}"><div class="section-head"><h2>${title}</h2>${scope ? `<div class="scope">${scope}</div>` : ""}</div><div class="section-body"></div></section>`;

  /** A card with title, scope line, body, and a "How it's calculated" disclosure.
      Returns the body element. opts.table: () => html for the data-table twin. */
  FFL.card = (host, opts) => {
    const c = document.createElement("div");
    c.className = "card" + (opts.flush ? "" : " card-pad") + (opts.cls ? " " + opts.cls : "");
    const toggle = opts.table ? `<button class="view-toggle" type="button">View as table</button>` : "";
    const head = opts.title ? `<div class="card-head"><h3 class="card-title">${opts.title}</h3>${toggle}</div>${opts.scope ? `<div class="card-scope">${opts.scope}</div>` : ""}` : "";
    c.innerHTML = head + `<div class="card-body"></div>` +
      (opts.methods || opts.table ? `<details class="how"${opts.flush ? ' style="margin:0 18px 14px"' : ""}><summary>${opts.methods ? "How it's calculated" : "Data"}</summary>` +
        (opts.methods ? `<p>${opts.methods}</p>` : "") + `</details>` : "");
    host.appendChild(c);
    const body = c.querySelector(".card-body");
    if (opts.table) {
      // Table view twin for charts: every value reachable without hovering.
      const btn = c.querySelector(".view-toggle");
      let chartHTML = null;
      btn.addEventListener("click", () => {
        if (chartHTML == null) { chartHTML = body.innerHTML; body.innerHTML = opts.table(); btn.textContent = "View as chart"; }
        else { body.innerHTML = chartHTML; chartHTML = null; btn.textContent = "View as table"; if (opts.rebind) opts.rebind(body); }
      });
    }
    return body;
  };

  /** Sortable table. cols: [{key, label, num, html(row), sort(row), title, asc, nosort, cls}] */
  FFL.table = (host, cols, rows, opts = {}) => {
    let sortKey = opts.sortKey, desc = opts.desc !== false, expanded = false;
    const wrap = document.createElement("div");
    wrap.className = "tbl-wrap";
    host.appendChild(wrap);
    const render = () => {
      const col = cols.find((c) => c.key === sortKey);
      const val = (r) => (col && col.sort ? col.sort(r) : r[sortKey]);
      const sorted = col && !opts.nosort ? rows.slice().sort((a, b) => {
        const va = val(a), vb = val(b);
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        const c = typeof va === "string" ? va.localeCompare(vb) : va - vb;
        return desc ? -c : c;
      }) : rows;
      const head = cols.map((c) => {
        const s = c.key === sortKey && !opts.nosort ? ` aria-sort="${desc ? "descending" : "ascending"}"` : "";
        const cls = [c.num ? "n" : "", c.nosort || opts.nosort ? "" : "sortable"].join(" ");
        return `<th class="${cls}" data-k="${c.key}"${s}${c.title ? ` title="${esc(c.title)}"` : ""}>${c.label}</th>`;
      }).join("");
      const limited = opts.limit && !expanded && sorted.length > opts.limit;
      const visible = limited ? sorted.slice(0, opts.limit) : sorted;
      const body = visible.map((r, i) => `<tr class="${opts.rowClass ? opts.rowClass(r) : ""}">` + cols.map((c) =>
        `<td class="${c.num ? "n " : ""}${c.cls || ""}">${c.html ? c.html(r, i) : esc(r[c.key])}</td>`).join("") + "</tr>").join("");
      const toggle = opts.limit && sorted.length > opts.limit
        ? `<button type="button" class="tbl-more${expanded ? " open" : ""}" aria-expanded="${expanded}">${expanded ? "Show fewer" : `Show all ${sorted.length}${opts.limitNoun ? " " + opts.limitNoun : ""}`}</button>` : "";
      wrap.innerHTML = `<table class="${opts.sticky === false ? "" : "sticky1"}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
      const oldBtn = wrap.nextElementSibling && wrap.nextElementSibling.classList.contains("tbl-more") ? wrap.nextElementSibling : null;
      if (oldBtn) oldBtn.remove();
      if (toggle) {
        wrap.insertAdjacentHTML("afterend", toggle);
        wrap.nextElementSibling.addEventListener("click", () => {
          const top = wrap.getBoundingClientRect().top;
          expanded = !expanded;
          render();
          // Collapsing a long list: bring the table back into view
          if (!expanded && top < 0) wrap.scrollIntoView({ block: "start" });
        });
      }
      wrap.querySelectorAll("th.sortable").forEach((th) => th.addEventListener("click", () => {
        const k = th.dataset.k;
        if (k === sortKey) desc = !desc;
        else { sortKey = k; desc = !cols.find((c) => c.key === k).asc; }
        render();
      }));
    };
    render();
    return wrap;
  };

  /** Horizontal bars. rows: [{mgr, team, logo, value, value2?, mark?, label?, dim?}]
      opts: {max, ref, refLabel, fmt, fmt2, name1, name2, markName, tip(row)} */
  FFL.barsH = (host, rows, opts = {}) => {
    const max = opts.max || Math.max(1, ...rows.map((r) => Math.max(r.value || 0, r.mark || 0, r.value2 || 0))) * 1.12;
    const pctOf = (v) => Math.max(0, Math.min(100, (v / max) * 100));
    const fmt = opts.fmt || ((v) => FFL.fmt(v, 1));
    let legend = "";
    if (opts.name2 || opts.markName) {
      legend = `<div class="legend"><span><i style="background:var(--accent)"></i>${esc(opts.name1)}</span>` +
        (opts.name2 ? `<span><i style="background:var(--series-2);height:5px"></i>${esc(opts.name2)}</span>` : "") +
        (opts.markName ? `<span><i class="line" style="background:var(--text)"></i>${esc(opts.markName)}</span>` : "") + `</div>`;
    }
    const ref = opts.ref != null ? `<div class="ref" style="left:${pctOf(opts.ref)}%"></div>` : "";
    const refLabel = opts.ref != null ? `<div class="ref-label" style="left:${pctOf(opts.ref)}%">${esc(opts.refLabel || "")}</div>` : "";
    const html = rows.map((r, i) => {
      const w = pctOf(r.value || 0);
      return `<div class="bar-row${r.dim ? " dimmed" : ""}" data-tip="${i}" tabindex="0">
        ${FFL.who(r.mgr, null, r.logo, 22)}
        <div class="bar-track">${i === 0 ? refLabel : ""}${ref}
          <div class="bar" style="width:${w}%"></div>
          ${r.value2 ? `<div class="bar b2" style="width:${pctOf(r.value2)}%"></div>` : ""}
          ${r.mark != null ? `<div class="mark" style="left:${pctOf(r.mark)}%"></div>` : ""}
          <div class="bar-val" style="left:${Math.max(w, r.mark != null ? pctOf(r.mark) + 1 : 0)}%">${r.label != null ? esc(r.label) : fmt(r.value)}</div>
        </div></div>`;
    }).join("");
    host.innerHTML = legend + `<div class="bars-wrap"><div class="bars">${html}</div></div>`;
    if (opts.tip) FFL.bindTips(host, (i) => opts.tip(rows[i]));
  };

  /** Scatter with a y=x diagonal. pts: [{x, y, label, sub, dim}] */
  FFL.scatter = (host, pts, opts = {}) => {
    const W = 560, H = 360, L = 40, R = 12, T = 12, B = 34;
    const maxV = Math.ceil(Math.max(10, ...pts.map((p) => Math.max(p.x, p.y))) / 10) * 10;
    const minV = Math.min(0, Math.floor(Math.min(...pts.map((p) => Math.min(p.x, p.y))) / 10) * 10);
    const sx = (v) => L + ((v - minV) / (maxV - minV)) * (W - L - R);
    const sy = (v) => H - B - ((v - minV) / (maxV - minV)) * (H - T - B);
    let g = "";
    for (let v = minV; v <= maxV; v += 10) {
      g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${sy(v)}" y2="${sy(v)}"/>` +
        `<text class="axis-label" x="${L - 6}" y="${sy(v) + 4}" text-anchor="end">${v}</text>` +
        `<text class="axis-label" x="${sx(v)}" y="${H - B + 16}" text-anchor="middle">${v}</text>`;
    }
    g += `<line class="diag" x1="${sx(Math.max(minV, 0))}" y1="${sy(Math.max(minV, 0))}" x2="${sx(maxV)}" y2="${sy(maxV)}"/>`;
    g += `<text class="anno" x="${sx(maxV) - 4}" y="${sy(maxV) + 14}" text-anchor="end">met projection</text>`;
    g += `<text class="axis-label" x="${(L + W - R) / 2}" y="${H - 2}" text-anchor="middle">${esc(opts.xLabel || "")}</text>`;
    g += `<text class="axis-label" transform="translate(11 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle">${esc(opts.yLabel || "")}</text>`;
    // Dim points first so highlighted ones sit on top
    const order = pts.map((p, i) => i).sort((a, b) => (pts[b].dim ? 1 : 0) - (pts[a].dim ? 1 : 0));
    const dots = order.map((i) => `<circle class="dot${pts[i].dim ? " dim" : ""}" data-i="${i}" cx="${sx(pts[i].x).toFixed(1)}" cy="${sy(pts[i].y).toFixed(1)}" r="4.5"/>`).join("");
    host.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.aria || "Scatter plot")}">${g}${dots}<rect class="hit" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent"/></svg>`;
    const svg = host.querySelector("svg");
    const hit = svg.querySelector(".hit");
    let focused = null;
    // Nearest-point hover: the pointer only has to be closest, not dead-on.
    hit.addEventListener("pointermove", (e) => {
      const r = svg.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W, py = ((e.clientY - r.top) / r.height) * H;
      let best = -1, bd = Infinity;
      pts.forEach((p, i) => { const d = (sx(p.x) - px) ** 2 + (sy(p.y) - py) ** 2; if (d < bd) { bd = d; best = i; } });
      if (focused) focused.classList.remove("focus");
      if (best < 0 || bd > 900) { FFL.tip.hide(); return; }
      focused = svg.querySelector(`circle[data-i="${best}"]`);
      focused.classList.add("focus");
      const p = pts[best];
      FFL.tip.show(e, p.sub, [{ v: p.label }, { v: FFL.fmt(p.y, 1), l: "scored" }, { v: FFL.fmt(p.x, 1), l: "projected" }]);
    });
    hit.addEventListener("pointerleave", () => { FFL.tip.hide(); if (focused) focused.classList.remove("focus"); });
  };

  /** Diverging cell background: positive -> accent, negative -> orange, 0 -> none. */
  FFL.divBg = (v, scale) => {
    if (!v || !scale) return "";
    const p = Math.round(Math.min(1, Math.abs(v) / scale) * 55);
    return `background:color-mix(in srgb, ${v > 0 ? "var(--accent)" : "var(--series-2)"} ${p}%, transparent)`;
  };

  // ---------- filters (kept in the URL so a view can be shared) ----------
  const params = new URLSearchParams(location.search);
  FFL.filters = { week: params.get("week") || "all", season: params.get("season") || "all", mgr: params.get("mgr") || "" };
  const listeners = [];
  FFL.onFilter = (fn) => listeners.push(fn);
  FFL.setFilter = (k, v) => {
    FFL.filters[k] = v;
    const p = new URLSearchParams(location.search);
    if (v && v !== "all") p.set(k, v); else p.delete(k);
    history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : "") + location.hash);
    listeners.forEach((fn) => fn());
  };
  FFL.mgrOK = (m) => !FFL.filters.mgr || FFL.filters.mgr === m;
  FFL.hlClass = (m) => !FFL.filters.mgr ? "" : FFL.filters.mgr === m ? "hl" : "";

  function leagueId() {
    const q = params.get("league");
    const all = Object.keys(window.FFL_LEAGUES || {});
    return q && all.includes(q) ? q : all[0];
  }
  const linkQuery = () => {
    const p = new URLSearchParams();
    if (params.get("league")) p.set("league", params.get("league"));
    if (FFL.filters.mgr) p.set("mgr", FFL.filters.mgr);
    return p.toString() ? "?" + p : "";
  };

  // ---------- sidebar navigation ----------
  // Level 1: the three pages. Level 2: each page's sections. The current page
  // lists the sections actually on screen (they change with filters) and
  // highlights the one you're reading; other pages list their usual sections.
  const SECTION_LABELS = {
    recap: "Recap", scoreboard: "Scoreboard", awards: "Awards", injuries: "Injuries", glance: "At a glance",
    standings: "Standings", power: "Power rankings", swap: "Schedule swap", strength: "Position strength",
    trophy: "Trophy case", decisions: "Lineup decisions", schedule: "Schedule", rosters: "Rosters", draft: "Draft",
    "coming-in": "Coming in", champions: "Champions", managers: "Manager careers", records: "Records",
    h2h: "Head-to-head", rivalries: "Rivalries", finishes: "Finish history", seasons: "Season by season",
    rivals: "Rivalries", highs: "Highs and lows", drafting: "Drafting", now: "This season", current: "Current managers",
    former: "Former managers",
  };
  const PAGE_SECTIONS = {
    record: ["champions", "managers", "records", "h2h", "draft", "rivalries", "finishes", "standings"],
    season: ["recap", "scoreboard", "awards", "injuries", "glance", "standings", "power", "swap", "strength",
      "trophy", "decisions", "schedule", "rosters", "draft", "coming-in"],
  };
  const PAGES = [["record", "index.html", "Record book"], ["manager", "manager.html", "Managers"], ["season", "season.html", null]];
  let navOpen = false, lastFocus = null;
  const wide = () => window.matchMedia("(min-width: 1440px)").matches;

  function sidenav(page) {
    const aside = document.createElement("aside");
    aside.id = "sidenav"; aside.className = "sidenav"; aside.setAttribute("aria-label", "Site menu");
    const scrim = document.createElement("div");
    scrim.className = "scrim"; scrim.hidden = true;
    document.body.append(scrim, aside);
    const btn = document.getElementById("menu-btn");

    const build = () => {
      const groups = PAGES.map(([key, href, label]) => {
        const title = label || `${FFL.data.season.season} season`;
        const here = key === page;
        let items;
        if (here) {
          items = [["top", "Top"]].concat(Array.from(document.querySelectorAll("#app > section[id]"))
            .map((s) => [s.id, SECTION_LABELS[s.id] || (s.querySelector("h2") || {}).textContent || s.id]));
        } else if (key === "manager") {
          // Elsewhere, Managers lists the people: one tap to a profile
          const cur = new Set(FFL.data.season.standings.map((r) => r.manager));
          items = [...cur].sort((a, b) => FFL.name(a).localeCompare(FFL.name(b))).map((m) => [null, FFL.name(m), FFL.mgrHref(m)]);
        } else {
          items = PAGE_SECTIONS[key].map((id) => [id, SECTION_LABELS[id]]);
        }
        const link = (id, text, hrefOverride) => {
          const url = hrefOverride || (here ? `#${id === "top" ? "" : id}` : `${href}${linkQuery()}${id ? "#" + id : ""}`);
          return `<li><a class="nav-sec" href="${esc(url)}" data-sec="${here ? esc(id) : ""}">${esc(text)}</a></li>`;
        };
        return `<div class="nav-group${here ? " open" : ""}">
          <div class="nav-page-row">
            <a class="nav-page${here ? " current" : ""}" href="${href}${linkQuery()}"${here ? ' aria-current="page"' : ""}>${esc(title)}</a>
            <button class="nav-toggle" type="button" aria-expanded="${here}" aria-label="Show ${esc(title)} sections">${ICON_CHEVRON}</button>
          </div>
          <ul class="nav-secs">${items.map(([id, text, h]) => link(id, text, h)).join("")}</ul></div>`;
      }).join("");
      aside.innerHTML = `<div class="nav-head"><span>${esc(FFL.data.league_name)}</span>
        <button class="icon-btn nav-close" type="button" aria-label="Close menu"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
        <nav>${groups}</nav>`;
      aside.querySelector(".nav-close").addEventListener("click", () => close(true));
      aside.querySelectorAll(".nav-toggle").forEach((b) => b.addEventListener("click", () => {
        const g = b.closest(".nav-group"); g.classList.toggle("open"); b.setAttribute("aria-expanded", g.classList.contains("open"));
      }));
      aside.querySelectorAll("a.nav-sec[data-sec]").forEach((a) => {
        if (!a.dataset.sec) return;
        a.addEventListener("click", (e) => {
          e.preventDefault();
          const id = a.dataset.sec;
          const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          close(false);
          const target = id === "top" ? null : document.getElementById(id);
          // Land just below the sticky header, measured now (it's taller on
          // phones, where the filters wrap onto a second line)
          const header = document.querySelector(".chrome");
          const offset = (header ? header.offsetHeight : 0) + 12;
          const go = (behavior) => window.scrollTo({
            top: target ? Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset) : 0, behavior });
          requestAnimationFrame(() => {
            const before = window.scrollY;
            go(smooth ? "smooth" : "auto");
            // Safety net: if smooth scrolling didn't start, jump there directly
            setTimeout(() => { if (Math.abs(window.scrollY - before) < 2) go("auto"); }, 400);
          });
          history.replaceState(null, "", location.pathname + location.search + (id === "top" ? "" : "#" + id));
        });
      });
      aside.querySelectorAll("a:not([data-sec]), a[data-sec='']").forEach((a) => a.addEventListener("click", () => {
        // Keep the manager filter when changing pages from the menu
        if (a.classList.contains("nav-page")) a.href = a.getAttribute("href").split("?")[0] + linkQuery();
      }));
      highlight();
    };

    // Highlight the section you're reading
    const highlight = () => {
      const secs = Array.from(document.querySelectorAll("#app > section[id]"));
      const header = document.querySelector(".chrome");
      const line = (header ? header.getBoundingClientRect().bottom : 0) + 24;
      let current = "top";
      secs.forEach((s) => { if (s.getBoundingClientRect().top <= line) current = s.id; });
      aside.querySelectorAll("a.nav-sec[data-sec]").forEach((a) => a.classList.toggle("active", a.dataset.sec === current && a.dataset.sec !== ""));
    };
    let ticking = false;
    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { highlight(); ticking = false; });
    }, { passive: true });

    function open() {
      if (wide()) return;
      navOpen = true; lastFocus = document.activeElement;
      document.body.classList.add("nav-open");
      scrim.hidden = false;
      aside.setAttribute("role", "dialog"); aside.setAttribute("aria-modal", "true");
      btn.setAttribute("aria-expanded", "true");
      highlight();
      const first = aside.querySelector(".nav-sec.active") || aside.querySelector("a");
      if (first) first.focus({ preventScroll: true });
    }
    function close(restoreFocus) {
      if (!navOpen) return;
      navOpen = false;
      document.body.classList.remove("nav-open");
      scrim.hidden = true;
      aside.removeAttribute("role"); aside.removeAttribute("aria-modal");
      btn.setAttribute("aria-expanded", "false");
      if (restoreFocus && lastFocus) lastFocus.focus({ preventScroll: true });
    }
    btn.addEventListener("click", () => (navOpen ? close(true) : open()));
    scrim.addEventListener("click", () => close(true));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && navOpen) close(true); });
    window.addEventListener("resize", () => { if (wide()) close(false); });

    // Sections are re-rendered whenever a filter changes: rebuild the list
    const app = document.getElementById("app");
    let pending = null;
    new MutationObserver(() => { clearTimeout(pending); pending = setTimeout(build, 50); }).observe(app, { childList: true });
    build();
  }

  function chrome(page, opts) {
    const d = FFL.data;
    const el = document.createElement("header");
    el.className = "chrome";
    el.innerHTML = `<div class="chrome-row">
      <button class="icon-btn menu-btn" id="menu-btn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="sidenav">${ICON_MENU}</button>
      <div class="brand">${esc(d.league_name)}</div>
      <nav class="tabs" aria-label="Pages">
        <a href="index.html" data-page="record"${page === "record" ? ' aria-current="page"' : ""}>Record book</a>
        <a href="manager.html" data-page="manager"${page === "manager" ? ' aria-current="page"' : ""}>Managers</a>
        <a href="season.html" data-page="season"${page === "season" ? ' aria-current="page"' : ""}>${d.season.season}</a>
      </nav>
      <button class="icon-btn" id="theme-btn" type="button" aria-label="Toggle dark mode"></button>
    </div>
    <div class="filters" id="filters"></div>`;
    document.body.prepend(el);
    sidenav(page);
    const btn = el.querySelector("#theme-btn");
    const paint = () => { btn.innerHTML = isDark() ? ICON_SUN : ICON_MOON; };
    paint();
    btn.addEventListener("click", () => { const t = isDark() ? "light" : "dark"; applyTheme(t); store.set("ffl-theme", t); paint(); });
    // Keep league + manager filter when switching pages
    el.querySelectorAll(".tabs a").forEach((a) => a.addEventListener("click", () => { a.href = a.getAttribute("href").split("?")[0] + linkQuery(); }));

    const f = el.querySelector("#filters");
    // Segmented filter (week on the season page, season on the record book)
    const segFilter = (key, label, allLabel, items) => {
      const seg = document.createElement("div");
      seg.className = "seg"; seg.setAttribute("role", "group"); seg.setAttribute("aria-label", label);
      seg.innerHTML = [{ v: "all", l: allLabel }].concat(items)
        .map(({ v, l, live }) => `<button type="button" data-v="${v}" aria-pressed="${FFL.filters[key] === v}">${l}${live ? '<span class="dot" title="In progress"></span>' : ""}</button>`).join("");
      seg.addEventListener("click", (e) => {
        const b = e.target.closest("button"); if (!b) return;
        seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
        FFL.setFilter(key, b.dataset.v);
        window.scrollTo({ top: 0 });
      });
      f.appendChild(seg);
      const on = seg.querySelector('[aria-pressed="true"]');
      if (on) requestAnimationFrame(() => on.scrollIntoView({ block: "nearest", inline: "center" }));
    };
    if (opts.weeks) segFilter("week", "Week", "All weeks", opts.weeks.map((w) => ({ v: String(w.week), l: `Wk ${w.week}`, live: w.live })));
    if (opts.seasons) segFilter("season", "Season", "All seasons", opts.seasons.slice().reverse().map((s) => ({ v: String(s.season), l: String(s.season), live: s.live })));
    const sel = document.createElement("select");
    sel.className = "select"; sel.setAttribute("aria-label", "Manager");
    const mgrs = opts.managers.slice().sort((a, b) => FFL.name(a).localeCompare(FFL.name(b)));
    sel.innerHTML = `<option value="">All managers</option>` + mgrs.map((m) => `<option value="${esc(m)}"${FFL.filters.mgr === m ? " selected" : ""}>${esc(FFL.name(m))}</option>`).join("");
    sel.addEventListener("change", () => FFL.setFilter("mgr", sel.value));
    f.appendChild(sel);
    const leagues = window.FFL_LEAGUES || {};
    if (Object.keys(leagues).length > 1) {
      const lp = document.createElement("select");
      lp.className = "select"; lp.setAttribute("aria-label", "League");
      lp.innerHTML = Object.entries(leagues).map(([id, l]) => `<option value="${id}"${id === d.league_id ? " selected" : ""}>${esc(l.name)}</option>`).join("");
      lp.addEventListener("change", () => { location.search = "?league=" + lp.value; });
      f.appendChild(lp);
    }
  }

  /** opts: {weeks?: [{week, live}], managers: () => [ids]} */
  FFL.boot = (page, opts, render) => {
    const id = leagueId();
    const fail = (msg) => { document.body.innerHTML = `<div class="error">${msg}</div>`; };
    if (!id) return fail("No league data found. Run <code>python -m ffl</code> to build it.");
    const s = document.createElement("script");
    // Version from the build so a fresh page never reuses an old cached data file
    const v = ((window.FFL_LEAGUES || {})[id] || {}).v;
    s.src = `data/${id}.js${v ? `?v=${v}` : ""}`;
    s.onload = () => {
      FFL.data = window.FFL_DATA && window.FFL_DATA[id];
      if (!FFL.data) return fail(`Data file for league ${esc(id)} is empty or invalid.`);
      const o = opts(FFL.data);
      if (o.weeks && FFL.filters.week !== "all" && !o.weeks.some((w) => String(w.week) === FFL.filters.week)) FFL.filters.week = "all";
      if (o.seasons && FFL.filters.season !== "all" && !o.seasons.some((s) => String(s.season) === FFL.filters.season)) FFL.filters.season = "all";
      chrome(page, o);
      document.title = `${{ record: "Record Book", manager: "Managers" }[page] || FFL.data.season.season + " Season"} · ${FFL.data.league_name}`;
      render(FFL.data);
      const f = document.querySelector("footer");
      if (f) f.textContent = `Data from ESPN · updated ${FFL.data.generated_at.replace("T", " ")}`;
      if (location.hash) { const t = document.querySelector(location.hash); if (t) t.scrollIntoView(); }
    };
    s.onerror = () => fail(`Couldn't load data/${esc(id)}.js. Run <code>python -m ffl</code> to build it.`);
    document.head.appendChild(s);
  };
})();
