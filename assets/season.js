/* Season tracker. Every section re-renders from the week + manager filters. */
(function () {
  const { esc, fmt, pct, pct100, signed, rec, name, short } = FFL;

  FFL.boot("season", (d) => ({
    weeks: d.season.weeks.filter((w) => !w.scheduled).map((w) => ({ week: w.week, live: !w.final })),
    managers: Object.values(d.season.teams).map((t) => t.manager),
  }), (d) => {
    const s = d.season;
    const team = (tid) => s.teams[String(tid)];
    const mgrOf = (tid) => team(tid).manager;
    const whoT = (tid, size = 32, withTeam = true) => FFL.who(mgrOf(tid), withTeam ? team(tid).team : null, team(tid).logo, size);
    const avT = (tid, size = 32) => FFL.avatar(team(tid).logo, name(mgrOf(tid)), size);
    const tids = Object.keys(s.teams).map(Number);
    const nTeams = tids.length;
    const kinds = Object.fromEntries(s.award_kinds.map((k) => [k.k, k]));
    const app = FFL.$("#app");

    // Completed, non-consolation team scores per week: {week: {tid: {pts, opp, oppPts, result}}}
    const results = {};
    s.weeks.forEach((w) => w.games.forEach((g) => {
      if (!g.final || g.type === "consolation") return;
      const [h, a] = g.sides;
      results[w.week] = results[w.week] || {};
      [[h, a, "home"], [a, h, "away"]].forEach(([me, op, side]) => {
        results[w.week][me.team_id] = { pts: me.pts, opp: op.team_id, oppPts: op.pts, type: g.type,
          result: g.winner === "tie" ? "T" : g.winner === side ? "W" : "L" };
      });
    }));
    const doneWeeks = s.weeks_done.slice();
    const regWeeks = doneWeeks.filter((w) => w <= s.regular_season_weeks);

    const selWeek = () => (FFL.filters.week === "all" ? null : +FFL.filters.week);
    const throughWeeks = (list) => { const w = selWeek(); return w == null ? list : list.filter((x) => x <= w); };
    const lineupsIn = (wk) => s.lineups.filter((l) => l.final && (wk == null ? true : l.week === wk));
    const dimmed = (tid) => !!FFL.filters.mgr && FFL.filters.mgr !== mgrOf(tid);

    function render() {
      FFL.tip.hide();
      app.innerHTML = "";
      renderHero();
      renderRecap();
      renderScoreboard();
      renderAwards();
      renderInjuries();
      renderGlance();
      renderStandings();
      renderPower();
      renderSwap();
      renderStrength();
      renderTrophies();
      renderDecisions();
      renderSchedule();
      renderRosters();
      renderDraft();
      renderComingIn();
    }
    const section = (id, title, scope) => {
      app.insertAdjacentHTML("beforeend", FFL.section(id, title, scope));
      return app.lastElementChild.querySelector(".section-body");
    };

    // ---------------- hero ----------------
    function renderHero() {
      const live = s.live_week;
      const status = s.complete ? "Final standings. The record book has the full history."
        : `${s.completed_weeks} of ${s.regular_season_weeks} regular-season weeks played` +
          (live ? ` · Week ${live} in progress` : "") + ` · Top ${s.playoff_teams} make the playoffs`;
      app.insertAdjacentHTML("beforeend", `<div class="hero"><h1>${s.season} Season</h1><p>${status}</p><div class="tiles" id="tiles"></div></div>`);
      const scores = [];
      Object.entries(results).forEach(([wk, r]) => Object.entries(r).forEach(([tid, x]) => scores.push({ wk: +wk, tid: +tid, pts: x.pts })));
      const hi = scores.slice().sort((a, b) => b.pts - a.pts)[0];
      const lo = scores.slice().sort((a, b) => a.pts - b.pts)[0];
      const leader = s.standings[0];
      const p1 = s.power[0];
      const worst = s.lineups.filter((l) => l.final).sort((a, b) => b.regret - a.regret)[0];
      const tile = (k, v, sub, isName) => `<div class="card tile"><div class="k">${k}</div><div class="v${isName ? " name" : ""}">${v}</div><div class="d">${sub}</div></div>`;
      FFL.$("#tiles").innerHTML = [
        tile("Standings leader", esc(name(leader.manager)), `${rec(leader.w, leader.l, leader.t)} · ${fmt(leader.pf, 1)} pts`, true),
        p1 && tile("Power #1", esc(name(mgrOf(p1.team_id))), `Score ${fmt(p1.score, 1)} of 100`, true),
        hi && tile("High score", fmt(hi.pts), `${esc(name(mgrOf(hi.tid)))} · Week ${hi.wk}`),
        lo && tile("Low score", fmt(lo.pts), `${esc(name(mgrOf(lo.tid)))} · Week ${lo.wk}`),
        worst && tile("Worst lineup call", fmt(worst.regret, 1), `${esc(name(mgrOf(worst.team_id)))} · Week ${worst.week}`),
      ].filter(Boolean).join("");
    }

    // ---------------- AI recap ----------------
    function renderRecap() {
      const recaps = d.recaps || {};
      const weeks = Object.keys(recaps).map(Number).sort((a, b) => a - b);
      if (!weeks.length) return;
      const w = selWeek();
      const wk = w == null ? weeks[weeks.length - 1] : w;
      const r = recaps[wk];
      if (!r) return;  // no recap for this week (not final yet, or not written)
      const paras = (txt) => esc(txt).split(/\n\s*\n|\n/).filter(Boolean).map((x) => `<p>${x}</p>`).join("");
      const SHOW = 2;
      const sections = r.sections.map((sec, i) => `<div class="recap-sec${i >= SHOW ? " extra" : ""}"><h4>${esc(sec.title)}</h4>${paras(sec.body)}</div>`).join("");
      app.insertAdjacentHTML("beforeend", `<section id="recap"><div class="card recap">
        <div class="recap-eyebrow">Week ${wk} recap${weeks.length > 1 ? ` <span class="muted">· ${weeks.length} recaps this season, pick a week above</span>` : ""}</div>
        <h2 class="recap-headline">${esc(r.headline)}</h2>
        <p class="recap-dek">${esc(r.dek)}</p>
        <div class="recap-body">${sections}</div>
        <div class="recap-foot">
          ${r.sections.length > SHOW ? `<button type="button" class="pill-btn" data-act="more">Read the full recap</button>` : ""}
          <button type="button" class="pill-btn primary" data-act="copy">Copy for group chat</button>
          <span class="muted recap-note">Written by Claude from this week's stats</span>
        </div></div></section>`);
      const card = app.querySelector(".recap");
      const more = card.querySelector('[data-act="more"]');
      if (more) more.addEventListener("click", () => {
        card.classList.toggle("open");
        more.textContent = card.classList.contains("open") ? "Show less" : "Read the full recap";
      });
      const copy = card.querySelector('[data-act="copy"]');
      copy.addEventListener("click", async () => {
        // End with this site's link so the text is ready to paste into the group chat
        const text = `${r.chat_text}\n\n${new URL("season.html", location.href).href}`;
        let ok = false;
        try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
          // Fallback for browsers that block the clipboard API on local files
          const ta = document.createElement("textarea");
          ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
          document.body.appendChild(ta); ta.select();
          try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
          ta.remove();
        }
        copy.textContent = ok ? "Copied" : "Copy failed: select the text manually";
        setTimeout(() => { copy.textContent = "Copy for group chat"; }, 2200);
      });
    }

    // ---------------- scoreboard ----------------
    function scoreboardWeek() {
      const w = selWeek();
      if (w != null) return w;
      return s.live_week || doneWeeks[doneWeeks.length - 1] || (s.weeks[0] && s.weeks[0].week);
    }
    function lineupDetail(side) {
      if (side.regret == null) return "";
      const m = side.misses;
      const items = m.length ? `<ul class="misses">${m.map((x) =>
        `<li><span>${x.vs_proj ? '<span class="tag warn">ESPN had him higher</span> ' : ""}Start <b>${esc(x.start)}</b> <span class="muted">${x.start_pos} · ${fmt(x.start_pts, 1)}${x.start_proj != null ? ` (proj ${fmt(x.start_proj, 1)})` : ""}</span> over ${esc(x.sit)} <span class="muted">${fmt(x.sit_pts, 1)}${x.sit_proj != null ? ` (proj ${fmt(x.sit_proj, 1)})` : ""}</span></span><span class="gain">+${fmt(x.gain, 1)}</span></li>`).join("")}</ul>` +
        `<div class="muted" style="margin-top:6px;font-size:12px">Swaps tagged <b>ESPN had him higher</b> went against the projections; the rest are hindsight.</div>`
        : `<div class="muted" style="margin-top:6px">Started the best possible lineup.</div>`;
      const espn = side.projected_lineup != null
        ? `<div class="muted" style="margin-top:6px">ESPN's projected lineup: ${fmt(side.projected_lineup, 1)} (${signed(side.projected_lineup - side.pts, 1)})</div>` : "";
      return `<div style="margin-top:10px"><b>${esc(name(mgrOf(side.team_id)))}</b> <span class="muted">· best possible ${fmt(side.optimal, 1)} · left ${fmt(side.regret, 1)}</span>${items}${espn}</div>`;
    }
    function renderScoreboard() {
      const wk = scoreboardWeek();
      const week = s.weeks.find((w) => w.week === wk);
      if (!week) return;
      const games = week.games.filter((g) => g.sides.some((x) => FFL.mgrOK(mgrOf(x.team_id))));
      const state = week.scheduled ? "not yet played" : week.final ? "final" : "in progress · as of last update";
      const body = section("scoreboard", `Week ${wk} scoreboard`, `${games.length} game${games.length === 1 ? "" : "s"} · ${state}`);
      const grid = document.createElement("div"); grid.className = "board"; body.appendChild(grid);
      const order = { playoff: 0, regular: 1, consolation: 2 };
      grid.innerHTML = games.slice().sort((a, b) => order[a.type] - order[b.type]).map((g) => {
        let [h, a] = g.sides;
        const winner = g.winner === "home" ? h : g.winner === "away" ? a : null;
        if (winner === a) [h, a] = [a, h]; // winner on top, the way a final reads
        const sideHTML = (x) => {
          const st = !g.final ? "" : winner === x ? "won" : winner ? "lost" : "";
          const scoreTxt = x.pts == null ? "–" : fmt(x.pts);
          const sub = !g.final && x.proj != null ? `<small>proj ${fmt(x.proj, 1)}</small>` : "";
          return `<div class="side ${st}">${whoT(x.team_id, 40)}<div class="score">${scoreTxt}${sub}</div></div>`;
        };
        let foot = [];
        if (!g.final && h.win_prob != null) {
          foot.push(`<div class="line"><span>Win chance</span><span>${esc(short(mgrOf(h.team_id)))} ${pct100(h.win_prob)} · ${esc(short(mgrOf(a.team_id)))} ${pct100(a.win_prob)}</span></div>`);
        }
        const top = winner && winner.top;
        if (top) foot.push(`<div class="line"><span>${FFL.headshot(top, 26)}<span>Top scorer: <b>${esc(top.n)}</b> <span class="muted">${top.pos}</span></span></span><span>${fmt(top.pts, 1)}</span></div>`);
        // All-time series going into this game, plus story flags (revenge, nemesis, rematch)
        const ma = mgrOf(h.team_id), mb = mgrOf(a.team_id);
        const sr = FFL.series(ma, mb, [s.season, wk]);
        if (sr.games) {
          const lead = sr.w === sr.l ? `Series tied ${rec(sr.w, sr.l, sr.t)}`
            : `${esc(short(sr.w > sr.l ? ma : mb))} leads ${sr.w > sr.l ? rec(sr.w, sr.l, sr.t) : rec(sr.l, sr.w, sr.t)}`;
          const last = sr.last ? `Last: ${sr.last.season} Wk ${sr.last.week}, ${esc(short(sr.last.res === "W" ? ma : mb))} ${fmt(Math.max(sr.last.me, sr.last.them), 1)}–${fmt(Math.min(sr.last.me, sr.last.them), 1)}` : "";
          foot.push(`<div class="line"><span>${lead} <span class="muted">all-time going in</span></span></div>`);
          if (last) foot.push(`<div class="line muted"><span>${last.replace("Last: ", "Last meeting: ")}</span></div>`);
        } else {
          foot.push(`<div class="line"><span class="muted">First-ever meeting</span></div>`);
        }
        const flags = FFL.gameFlags(ma, mb, [s.season, wk]);
        if (flags.length) foot.push(`<div class="flags">${flags.map((f) => `<span class="tag ${f.cls}">${esc(f.text)}</span>`).join("")}</div>`);
        const winbar = !g.final && h.win_prob != null ? `<div class="winbar" aria-hidden="true"><i style="width:${Math.round(h.win_prob * 100)}%"></i></div>` : "";
        const tags = [g.type !== "regular" ? `<span class="tag ${g.type === "playoff" ? "accent" : ""}">${g.type}</span>` : "",
          !g.final && !g.scheduled ? `<span class="tag live">Live</span>` : ""].join(" ");
        const margin = g.final ? `Final · won by ${fmt(Math.abs(h.pts - a.pts))}` : g.scheduled ? "Upcoming" : "";
        foot.unshift(`<div class="line"><span>${margin}</span><span>${tags}</span></div>`);
        const lineups = g.final && (h.regret != null || a.regret != null)
          ? `<details><summary>Lineup decisions</summary>${lineupDetail(h)}${lineupDetail(a)}</details>` : "";
        const hl = FFL.filters.mgr && g.sides.some((x) => mgrOf(x.team_id) === FFL.filters.mgr) ? " hl" : "";
        return `<div class="card game${hl}">${sideHTML(h)}${sideHTML(a)}${winbar}<div class="foot">${foot.join("")}</div>${lineups}</div>`;
      }).join("") || `<div class="card empty">No games for this manager this week.</div>`;
    }

    // ---------------- awards ----------------
    const ICONS = {
      1: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>',
      0: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2.5" stroke-linecap="round"/></svg>',
      "-1": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v12M6 12l6 6 6-6"/></svg>',
    };
    const awardValue = (a) => ({
      mvp: `${fmt(a.value, 1)} pts`, high: `${fmt(a.value, 1)} pts`, low: `${fmt(a.value, 1)} pts`,
      beatdown: `by ${fmt(a.value, 1)}`, nailbiter: `by ${fmt(a.value, 2)}`, lucky: `${fmt(a.value, 1)} pts`, robbed: `${fmt(a.value, 1)} pts`,
      overachiever: `+${fmt(a.value, 1)}`, bust: `−${fmt(a.value, 1)}`, bench_hero: `${fmt(a.value, 1)} pts`, facepalm: `${fmt(a.value, 1)} left`,
    }[a.k]);
    function renderAwards() {
      const keys = Object.keys(s.awards).map(Number).sort((a, b) => a - b);
      const w = selWeek();
      const wk = w != null ? w : keys[keys.length - 1];
      const list = s.awards[wk];
      const body = section("awards", wk ? `Week ${wk} awards` : "Weekly awards", list ? "Handed out from the completed week" : "");
      if (!list) {
        body.innerHTML = `<div class="card empty">Awards are handed out once Week ${wk || ""} is final.</div>`;
        return;
      }
      const ord = s.award_kinds.map((k) => k.k);
      const grid = document.createElement("div"); grid.className = "awards"; body.appendChild(grid);
      grid.innerHTML = list.slice().sort((a, b) => ord.indexOf(a.k) - ord.indexOf(b.k)).map((a) => {
        const k = kinds[a.k];
        const tone = k.sign > 0 ? "good" : k.sign < 0 ? "bad" : "neutral";
        const pic = a.player ? FFL.headshot(a.player, 44) : avT(a.team_id, 44);
        const detail = a.opp ? `${esc(a.text)} over ${esc(name(mgrOf(a.opp)))}` : esc(a.text);
        const m = mgrOf(a.team_id);
        const cls = FFL.filters.mgr ? (FFL.filters.mgr === m ? " hl" : " dimmed") : "";
        return `<div class="card award${cls}"><div class="top"><span class="title ${tone}">${ICONS[k.sign]}${esc(k.label)}</span><span class="val">${awardValue(a)}</span></div>
          <div class="body">${pic}<div><b>${esc(name(m))}</b><div class="detail">${detail}</div></div></div></div>`;
      }).join("");
      body.insertAdjacentHTML("beforeend", `<details class="how plain"><summary>How awards are decided</summary><p>` +
        "Everything here comes from the finished week; nothing is a prediction. <b>Lucky</b> is the winner whose score beat the fewest other teams that week; " +
        "<b>Robbed</b> is the loser whose score beat the most (the all-play view applied to one week). <b>Overachiever</b> and <b>Bust</b> compare a starter's " +
        "points with ESPN's projection for that week. <b>Bench hero</b> is the top-scoring bench player. <b>Facepalm</b> is the costliest lineup decision, counting " +
        "only swaps that were legal; a call that cost the game ranks above one that didn't, and one where ESPN's own projections would have won ranks highest.</p></details>");
    }

    // ---------------- key injuries ----------------
    const INJ = s.injuries || { by_week: {}, watch: [], status: {} };
    // Small IR / Out / D / Q badge after a player's name (current ESPN status)
    const injTag = (id) => {
      const b = INJ.status[String(id)];
      if (!b) return "";
      const tip = [b.type && b.type.replace(" - ", ", "), b.ofs ? "out for the season" : ""].filter(Boolean).join(" · ");
      return ` <span class="itag i${b.s.replace(/[^A-Za-z]/g, "")}" title="${esc(tip || b.s)}">${esc(b.ofs ? "Season" : b.s)}</span>`;
    };
    function renderInjuries() {
      const w = selWeek();
      const done = Object.keys(INJ.by_week).map(Number).filter((x) => s.weeks_done.includes(x)).sort((a, b) => a - b);
      const liveWeek = INJ.live_week;
      // All weeks: the latest finished week; a picked week: that week
      const wk = w != null ? w : done[done.length - 1] || (s.weeks_done[s.weeks_done.length - 1]);
      const list = (INJ.by_week[wk] || []).filter((e) => FFL.mgrOK(mgrOf(e.team_id)));
      const showWatch = liveWeek && (w == null || w === liveWeek);
      const watch = showWatch ? INJ.watch.filter((e) => FFL.mgrOK(mgrOf(e.team_id))) : [];
      if (!list.length && !watch.length && w == null) return;
      const body = section("injuries", wk ? `Week ${wk} key injuries` : "Key injuries",
        "Injuries to players who mattered: early-round picks, projected starters, and weekly starters");
      if (list.length) {
        const grid = document.createElement("div"); grid.className = "inj-grid"; body.appendChild(grid);
        grid.innerHTML = list.map((e) => {
          const m = mgrOf(e.team_id);
          const sev = e.severity === 0 ? "bad" : e.severity === 1 ? "warn" : "";
          const what = (e.type || "Undisclosed injury").replace(" - ", ", ");
          const lost = e.reasons.slice(0, 2).join(" and ");
          const impact = e.severity === 0 ? `${esc(short(m))} lost a ${esc(lost)} for the season`
            : e.severity === 1 ? `${esc(short(m))} lost a ${esc(lost)} to IR`
            : `${esc(short(m))} is without a ${esc(lost)} for now`;
          const cls = FFL.filters.mgr ? (FFL.filters.mgr === m ? " hl" : "") : "";
          return `<div class="card inj${cls}">
            <div class="inj-top">${FFL.headshot({ id: e.id, n: e.n, pos: e.pos, pro: e.pro }, 48)}
              <div class="inj-who"><b>${esc(e.n)}</b><span>${e.pos}${FFL.proAbbr(e.pro) ? " · " + FFL.proAbbr(e.pro) : ""} · ${esc(what)}</span></div>
              <span class="tag ${sev}">${esc(e.label)}</span></div>
            <div class="inj-impact">${impact}</div>
            <div class="inj-meta">${FFL.who(m, team(e.team_id).team, team(e.team_id).logo, 22)}
              <span class="muted">${e.in_game ? `Hurt during the game · ${fmt(e.pts, 1)} pts` : `${fmt(e.pts, 1)} pts in Week ${wk}`}${e.dropped ? " · since dropped" : ""}</span></div>
            ${e.headline ? `<div class="inj-news">“${esc(e.headline)}”</div>` : ""}
          </div>`;
        }).join("");
      } else if (wk && s.weeks_done.includes(wk)) {
        body.insertAdjacentHTML("beforeend", `<div class="card empty">No key injuries in Week ${wk}.</div>`);
      }
      if (watch.length) {
        const c = FFL.card(body, { flush: true, methods:
          "Projected starters for the week in progress who carry an injury designation from ESPN right now. Statuses change through the week; check before kickoff." });
        c.parentNode.style.marginTop = list.length ? "16px" : "0";
        c.insertAdjacentHTML("beforebegin", `<div style="padding:18px 18px 4px"><h3 class="card-title">Week ${liveWeek} injury watch</h3><div class="card-scope">Starters with an injury designation · as of the last update</div></div>`);
        FFL.table(c, [
          { key: "n", label: "Player", cls: "who-cell", asc: true, html: (e) => `<div class="who">${FFL.headshot({ id: e.id, n: e.n, pos: e.pos, pro: e.pro }, 30)}<div class="names"><b style="font-weight:500">${esc(e.n)}</b><span>${e.pos}${FFL.proAbbr(e.pro) ? " · " + FFL.proAbbr(e.pro) : ""}${e.type ? " · " + esc(e.type.replace(" - ", ", ")) : ""}</span></div></div>` },
          { key: "status", label: "Status", nosort: true, html: (e) => injTag(e.id) || esc(e.label) },
          { key: "team_id", label: "Manager", cls: "who-cell", sort: (e) => name(mgrOf(e.team_id)), html: (e) => whoT(e.team_id, 24) },
        ], watch, { nosort: true });
      }
      body.insertAdjacentHTML("beforeend", `<details class="how plain"><summary>How injuries are tracked</summary><p>` +
        "ESPN only shows a player's injury status as of right now, so every refresh saves a snapshot (status, injury, expected return, and the latest news). " +
        "An injury counts for a week if it was first reported within three days after that player's game, and it's marked <b>hurt during the game</b> when the news says he left it, " +
        "or when he started, scored under half his projection, and injury news followed within two days. A player is <b>key</b> if he was a 1st–6th round pick, in his team's best projected lineup, or a weekly starter. " +
        "A player hurt during a game is never the week's Bust, and gets the <b>Injury bug</b> award instead. Tracking starts with the 2026 season; earlier injuries can't be reconstructed.</p></details>");
    }

    // ---------------- at a glance (4 charts) ----------------
    function renderGlance() {
      const wk = selWeek();
      const weeks = wk == null ? doneWeeks : doneWeeks.filter((x) => x === wk);
      const scope = wk == null ? `Season to date · ${doneWeeks.length} weeks` : `Week ${wk}`;
      const body = section("glance", wk == null ? "Season at a glance" : `Week ${wk} at a glance`, scope);
      if (!weeks.length) { body.innerHTML = `<div class="card empty">Charts fill in once Week ${wk} is final.</div>`; return; }
      const grid = document.createElement("div"); grid.className = "grid-2"; body.appendChild(grid);

      // 1. Who scored what
      const scored = tids.map((t) => {
        const xs = weeks.map((w) => results[w] && results[w][t]).filter(Boolean);
        return { tid: t, mgr: mgrOf(t), logo: team(t).logo, value: xs.length ? xs.reduce((a, x) => a + x.pts, 0) / xs.length : null, games: xs.length, dim: dimmed(t) };
      }).filter((r) => r.value != null).sort((a, b) => b.value - a.value);
      const avg = scored.reduce((a, r) => a + r.value, 0) / scored.length;
      const top = scored[0], bot = scored[scored.length - 1];
      const b1 = FFL.card(grid, {
        title: "Who scored what", scope: wk == null ? "Average points per week" : "Points scored",
        methods: `Highest to lowest. The vertical line is the league average of ${fmt(avg, 1)}. ${esc(name(top.mgr))} led with ${fmt(top.value, 1)} and ${esc(name(bot.mgr))} trailed on ${fmt(bot.value, 1)}, a spread of ${fmt(top.value - bot.value, 1)}.`,
        table: () => miniTable(["Manager", "Points"], scored.map((r) => [esc(name(r.mgr)), fmt(r.value, 1)])),
        rebind: (el) => drawScored(el),
      });
      const drawScored = (el) => FFL.barsH(el, scored, { ref: avg, refLabel: `avg ${fmt(avg, 0)}`,
        tip: (r) => ({ title: name(r.mgr), rows: [{ v: fmt(r.value, 1), l: wk == null ? `pts/week over ${r.games}` : "points" }] }) });
      drawScored(b1);

      // 2. Regret tracker
      const lus = lineupsIn(wk);
      const reg = tids.map((t) => {
        const xs = lus.filter((l) => l.team_id === t);
        const regret = xs.reduce((a, l) => a + l.regret, 0);
        const espn = xs.reduce((a, l) => a + (l.projected_lineup != null ? Math.max(0, l.projected_lineup - l.actual) : 0), 0);
        const worst = xs.slice().sort((a, b) => b.regret - a.regret)[0];
        return { tid: t, mgr: mgrOf(t), logo: team(t).logo, value: regret, value2: Math.min(espn, regret), worst, dim: dimmed(t) };
      }).filter((r) => lus.some((l) => l.team_id === r.tid)).sort((a, b) => b.value - a.value);
      const ravg = reg.reduce((a, r) => a + r.value, 0) / (reg.length || 1);
      const rw = reg[0];
      const rwMiss = rw && rw.worst && rw.worst.misses[0];
      const b2 = FFL.card(grid, {
        title: "Regret tracker", scope: wk == null ? "Bench points left, season to date" : "Bench points left",
        methods: "Points a <b>legal</b> swap would have added: a benched player who could have filled a starter's slot and outscored him, measured against the best lineup hindsight allows. " +
          "Bench points that couldn't have been started don't count, so a deep roster isn't a mistake. The thin orange bar is the inexcusable part: what simply starting ESPN's projected lineup would have gained. " +
          (rw ? `${esc(name(rw.mgr))} leads with ${fmt(rw.value, 1)}` + (rwMiss ? ` (worst call: ${esc(rwMiss.start)} sat for ${fmt(rwMiss.start_pts, 1)} while ${esc(rwMiss.sit)} started for ${fmt(rwMiss.sit_pts, 1)})` : "") + `; league average ${fmt(ravg, 1)}.` : ""),
        table: () => miniTable(["Manager", "Regret", "ESPN would have saved"], reg.map((r) => [esc(name(r.mgr)), fmt(r.value, 1), fmt(r.value2, 1)])),
        rebind: (el) => drawReg(el),
      });
      const drawReg = (el) => FFL.barsH(el, reg, { name1: "Hindsight", name2: "Projection said so", ref: ravg, refLabel: `avg ${fmt(ravg, 0)}`,
        tip: (r) => ({ title: name(r.mgr), rows: [{ v: fmt(r.value, 1), l: "left on the bench", color: "var(--accent)" }, { v: fmt(r.value2, 1), l: "ESPN's lineup would have gained", color: "var(--series-2)" }] }) });
      drawReg(b2);

      // 3. Every starter against projection
      const pts = [];
      lus.forEach((l) => l.players.forEach((p) => {
        if (!p.st || p.proj == null) return;
        pts.push({ x: p.proj, y: p.pts, label: `${p.n} (${p.pos})`, sub: `${name(mgrOf(l.team_id))} · Week ${l.week}`, dim: dimmed(l.team_id), d: p.pts - p.proj, mgr: mgrOf(l.team_id) });
      }));
      if (pts.length) {
        const beat = pts.filter((p) => p.d > 0).length;
        const over = pts.slice().sort((a, b) => b.d - a.d)[0], under = pts.slice().sort((a, b) => a.d - b.d)[0];
        const b3 = FFL.card(grid, {
          title: "Every starter against their projection", scope: `${pts.length} starts`,
          methods: `Each dot is one started player: ESPN's projection across, actual points up. The diagonal is the projection exactly met; above it beat the number. ` +
            `${beat} of ${pts.length} starters (${pct100(beat / pts.length)}) beat their projection. Biggest surprise: ${esc(over.label)}, ${signed(over.d, 1)}. Biggest letdown: ${esc(under.label)}, ${signed(under.d, 1)}.`,
          table: () => miniTable(["Player", "Manager", "Projected", "Scored"], pts.slice().sort((a, b) => b.d - a.d).map((p) => [esc(p.label), esc(name(p.mgr)), fmt(p.x, 1), fmt(p.y, 1)])),
          rebind: (el) => FFL.scatter(el, pts, { xLabel: "Projected points", yLabel: "Actual points" }),
        });
        FFL.scatter(b3, pts, { xLabel: "Projected points", yLabel: "Actual points", aria: "Starters: projected vs actual points" });
      }

      // 4. Who the schedule has been kind to (cumulative through the selected week)
      const thru = wk == null ? regWeeks : regWeeks.filter((x) => x <= wk);
      const kind = tids.map((t) => {
        let apw = 0, apg = 0, w = 0, g = 0, l = 0;
        thru.forEach((wkk) => {
          const r = results[wkk]; if (!r || !r[t]) return;
          Object.entries(r).forEach(([o, x]) => { if (+o === t) return; apg++; if (r[t].pts > x.pts) apw++; else if (r[t].pts === x.pts) apw += 0.5; });
          g++; if (r[t].result === "W") w++; else if (r[t].result === "T") w += 0.5; else l++;
        });
        return { tid: t, mgr: mgrOf(t), logo: team(t).logo, value: apg ? (apw / apg) * 100 : 0, mark: g ? (w / g) * 100 : 0,
          w, l, apw: Math.round(apw), apl: apg - Math.round(apw), dim: dimmed(t), label: apg ? `${Math.round((apw / apg) * 100)}%` : "–" };
      }).sort((a, b) => b.value - a.value);
      if (thru.length) {
        const diff = kind.map((r) => ({ ...r, gap: r.mark - r.value })).sort((a, b) => b.gap - a.gap);
        const lucky = diff[0], robbed = diff[diff.length - 1];
        const b4 = FFL.card(grid, {
          title: "Who the schedule has been kind to", scope: `${thru.length} week${thru.length === 1 ? "" : "s"} · all-play vs. actual win rate`,
          methods: "All-play win rate is each manager's record if they played every other team every week, which strips the schedule out. The black tick is the actual head-to-head win rate; " +
            "a tick right of the bar means the schedule has helped, left means it has hurt. " +
            `${esc(name(lucky.mgr))} has gained most (${lucky.w}-${lucky.l} actual vs ${lucky.apw}-${lucky.apl} all-play); ${esc(name(robbed.mgr))} has been hurt most (${robbed.w}-${robbed.l} vs ${robbed.apw}-${robbed.apl}). Over a full season these converge.`,
          table: () => miniTable(["Manager", "All-play", "Actual"], kind.map((r) => [esc(name(r.mgr)), `${r.apw}-${r.apl} (${Math.round(r.value)}%)`, `${r.w}-${r.l} (${Math.round(r.mark)}%)`])),
          rebind: (el) => drawKind(el),
        });
        const drawKind = (el) => FFL.barsH(el, kind, { max: 100, ref: 50, refLabel: "50%", name1: "All-play win rate", markName: "Actual win rate",
          tip: (r) => ({ title: name(r.mgr), rows: [{ v: `${r.apw}-${r.apl}`, l: `all-play (${Math.round(r.value)}%)`, color: "var(--accent)" }, { v: `${r.w}-${r.l}`, l: `actual (${Math.round(r.mark)}%)`, color: "var(--text)" }] }) });
        drawKind(b4);
      }
    }
    const miniTable = (head, rows) => `<div class="tbl-wrap"><table><thead><tr>${head.map((h, i) => `<th class="${i ? "n" : ""}">${h}</th>`).join("")}</tr></thead><tbody>` +
      rows.map((r) => `<tr>${r.map((c, i) => `<td class="${i ? "n" : ""}">${c}</td>`).join("")}</tr>`).join("") + `</tbody></table></div>`;

    // ---------------- standings ----------------
    function renderStandings() {
      const body = section("standings", "Standings", s.median_bonus
        ? "Official ESPN record: one head-to-head game plus a bonus win for a top-half score each week"
        : "Season to date");
      const card = FFL.card(body, { flush: true,
        methods: "Seed order is ESPN's. <b>All-play</b> is the record against every team every week. <b>Luck</b> is head-to-head wins minus all-play expected wins. The line marks the playoff cut." });
      const wrap = FFL.table(card, [
        { key: "seed", label: "Seed", num: true, asc: true },
        { key: "manager", label: "Manager", cls: "who-cell", asc: true, sort: (r) => name(r.manager), html: (r) => FFL.who(r.manager, r.team, r.logo, 30) },
        { key: "w", label: "Record", num: true, sort: (r) => r.w + 0.5 * r.t, html: (r) => `<b>${rec(r.w, r.l, r.t)}</b>` },
        { key: "h2h", label: "H2H", num: true, sort: (r) => r.h2h[0], html: (r) => rec(...r.h2h) },
        s.median_bonus && { key: "median", label: "Median", num: true, sort: (r) => r.median[0], html: (r) => rec(...r.median) },
        { key: "pf", label: "PF", num: true, html: (r) => fmt(r.pf) },
        { key: "pa", label: "PA", num: true, html: (r) => fmt(r.pa) },
        { key: "all_play_pct", label: "All-play", num: true, html: (r) => `${rec(...r.all_play)} <span class="muted">${pct(r.all_play_pct)}</span>` },
        { key: "luck", label: "Luck", num: true, html: (r) => `<span class="${FFL.cls(r.luck)}">${signed(r.luck, 2)}</span>` },
        { key: "form", label: "Last 5", nosort: true, html: (r) => FFL.chips(r.form) },
        { key: "streak", label: "Streak", num: true, nosort: true },
        { key: "moves", label: "Moves", num: true },
        { key: "trades", label: "Trades", num: true },
      ].filter(Boolean), s.standings, { sortKey: "seed", desc: false, rowClass: (r) => FFL.hlClass(r.manager) });
      const rows = wrap.querySelectorAll("tbody tr");
      if (rows[s.playoff_teams - 1]) rows[s.playoff_teams - 1].querySelectorAll("td").forEach((td) => (td.style.borderBottom = "2px solid var(--accent)"));
    }

    // ---------------- power ----------------
    let powerMode = new URLSearchParams(location.search).get("power") === "outlook" ? "outlook" : "results";
    function renderPower() {
      const keys = Object.keys(s.power_history).map(Number).sort((a, b) => a - b);
      if (!keys.length) return;
      const w = selWeek();
      const body = section("power", "Power rankings", "");
      const head = body.closest("section").querySelector(".section-head");
      const modes = {
        results: ["Results so far", "Looking back: how well each team has actually played"],
        outlook: ["Outlook", "Looking ahead: how strong each roster projects for the rest of the season"],
      };
      const ctl = document.createElement("div");
      ctl.style.cssText = "display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px";
      ctl.innerHTML = `<div class="seg" role="group" aria-label="Ranking type">${Object.entries(modes).map(([k, [l]]) =>
        `<button type="button" data-m="${k}" aria-pressed="${powerMode === k}">${l}</button>`).join("")}</div><span class="muted" style="font-size:14px">${modes[powerMode][1]}</span>`;
      body.appendChild(ctl);
      ctl.querySelectorAll("button").forEach((btn) => btn.addEventListener("click", () => {
        powerMode = btn.dataset.m;
        const q = new URLSearchParams(location.search);
        if (powerMode === "outlook") q.set("power", "outlook"); else q.delete("power");
        history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : "") + "#power");
        render();
        document.getElementById("power").scrollIntoView();
      }));
      if (powerMode === "results") {
        const wk = w != null && s.power_history[w] ? w : keys[keys.length - 1];
        const pw = s.power_weights;
        head.insertAdjacentHTML("beforeend", `<div class="scope">Through Week ${wk}</div>`);
        const card = FFL.card(body, { flush: true, methods:
          `Score out of 100 = ${Math.round(pw.all_play * 100)}% season all-play win rate + ${Math.round(pw.win_pct * 100)}% actual win rate (including bonus wins) + ` +
          `${Math.round(pw.recent * 100)}% all-play win rate over the last ${s.recent_weeks} weeks. All-play rewards scoring regardless of opponent, so this measures how well a team has played, not just its record. ` +
          `It only knows what has already happened; switch to <b>Outlook</b> for what the rosters project to do next.` });
        FFL.table(card, [
          { key: "rank", label: "#", num: true, asc: true, html: (r) => `<b>${r.rank}</b>` },
          { key: "change", label: "Move", num: true, html: (r) => moveHTML(r.change) },
          { key: "team_id", label: "Manager", cls: "who-cell", asc: true, sort: (r) => name(mgrOf(r.team_id)), html: (r) => whoT(r.team_id, 30) },
          { key: "score", label: "Score", num: true, html: (r) => `<div class="pbar"><div class="track"><i style="width:${r.score}%"></i></div><b>${fmt(r.score, 1)}</b></div>` },
          { key: "all_play", label: "All-play", num: true, html: (r) => pct(r.all_play) },
          { key: "win_pct", label: "Win %", num: true, html: (r) => pct(r.win_pct) },
          { key: "recent", label: `Last ${s.recent_weeks}`, num: true, html: (r) => pct(r.recent) },
          { key: "history", label: "Trend", nosort: true, html: (r) => FFL.spark(r.history, nTeams) },
        ], s.power_history[wk], { sortKey: "rank", desc: false, rowClass: (r) => FFL.hlClass(mgrOf(r.team_id)) });
        return;
      }
      // Outlook: latest snapshot at or before the selected week
      const snaps = Object.keys(s.outlook || {}).map(Number).sort((a, b) => a - b);
      const usable = w == null ? snaps : snaps.filter((x) => x <= w);
      if (!usable.length) {
        body.insertAdjacentHTML("beforeend", `<div class="card empty">${snaps.length
          ? `The first outlook snapshot is from Week ${snaps[0]}. ESPN only publishes current projections, so earlier weeks can't be reconstructed.`
          : "No outlook snapshot yet. Run a refresh during the season to capture ESPN's rest-of-season projections."}</div>`);
        return;
      }
      const wk = usable[usable.length - 1];
      const rows = s.outlook[wk];
      const resultsWeek = rows[0].results_week;
      head.insertAdjacentHTML("beforeend", `<div class="scope">ESPN projections as of Week ${wk}${resultsWeek ? ` · compared with results through Week ${resultsWeek}` : ""}</div>`);
      const maxW = Math.max(...rows.map((r) => r.weekly)), minW = Math.min(...rows.map((r) => r.weekly));
      const gap = s.outlook_gap;
      const card = FFL.card(body, { flush: true, methods:
        "Each roster's best legal lineup, built from ESPN's <b>rest-of-season projection</b> for every player (projected points per game over the games they have left), skipping anyone on IR. " +
        "<b>Projected pts/week</b> is what that lineup should score in a typical week from here. <b>Bench depth</b> is the top three bench players' projected points per game, which is insurance against injuries and byes. " +
        `<b>Undervalued</b> means the roster projects at least ${gap} spots higher than its results-based rank (better than its record suggests); <b>Overperforming</b> means at least ${gap} spots lower. ` +
        "Projections don't model bye weeks or future injuries, and ESPN refreshes them daily, so this snapshot updates every time the site is refreshed." });
      FFL.table(card, [
        { key: "rank", label: "#", num: true, asc: true, html: (r) => `<b>${r.rank}</b>` },
        { key: "change", label: "Move", num: true, title: "Change since the previous outlook snapshot", html: (r) => moveHTML(r.change) },
        { key: "team_id", label: "Manager", cls: "who-cell", asc: true, sort: (r) => name(mgrOf(r.team_id)), html: (r) => whoT(r.team_id, 30) },
        { key: "weekly", label: "Projected pts/week", num: true, html: (r) => {
          const pctW = 25 + 75 * ((r.weekly - minW) / Math.max(1, maxW - minW));
          return `<div class="pbar"><div class="track"><i style="width:${pctW}%"></i></div><b>${fmt(r.weekly, 1)}</b></div>`; } },
        { key: "gap", label: "vs Results", num: true, title: "Results-based rank, then the move to the outlook rank", sort: (r) => r.gap,
          html: (r) => r.results_rank == null ? "–" : `<span class="muted">#${r.results_rank} →</span> ${moveHTML(r.gap)}` +
            (r.gap >= gap ? ' <span class="tag accent">Undervalued</span>' : r.gap <= -gap ? ' <span class="tag warn">Overperforming</span>' : "") },
        { key: "stars", label: "Projected top starters", nosort: true, html: (r) => `<div style="display:flex;gap:10px">${r.stars.map((p) =>
          `<div class="who" title="${esc(`${p.n} (${p.pos}) · ${fmt(p.avg, 1)} per game`)}">${FFL.headshot(p, 28)}<div class="names"><b style="font-weight:500;font-size:12px">${esc(surname(p.n))}</b><span>${fmt(p.avg, 1)}</span></div></div>`).join("")}</div>` },
        { key: "bench_depth", label: "Bench depth", num: true, html: (r) => fmt(r.bench_depth, 1) },
      ], rows, { sortKey: "rank", desc: false, rowClass: (r) => FFL.hlClass(mgrOf(r.team_id)) });
    }
    // "Kenneth Walker III" -> "Walker", "Amon-Ra St. Brown" -> "St. Brown"
    const surname = (full) => {
      const parts = String(full || "").split(" ").filter((x) => !/^(Jr\.?|Sr\.?|II|III|IV|V)$/.test(x));
      const last = parts[parts.length - 1] || "";
      const prev = parts[parts.length - 2];
      return prev && /^(St\.|Van|Von|De|Le|Da)$/.test(prev) ? `${prev} ${last}` : last;
    };
    const moveHTML = (n) => n > 0 ? `<span class="pos">▲ ${n}</span>` : n < 0 ? `<span class="neg">▼ ${-n}</span>` : '<span class="muted">–</span>';

    // ---------------- schedule swap ----------------
    function renderSwap() {
      const weeks = throughWeeks(regWeeks);
      if (!weeks.length) return;
      const body = section("swap", "Schedule swap", `${weeks.length} regular-season week${weeks.length === 1 ? "" : "s"} · what each record would be on every other schedule`);
      const order = s.standings.map((r) => r.team_id);
      const cell = (a, b) => { // a's scores against b's opponents
        let w = 0, l = 0, t = 0;
        weeks.forEach((wk) => {
          const r = results[wk]; if (!r || !r[a] || !r[b]) return;
          let opp = r[b].opp; if (opp === a) opp = b;
          const me = r[a].pts, them = r[opp].pts;
          if (me > them) w++; else if (me < them) l++; else t++;
        });
        return { w, l, t };
      };
      const real = Object.fromEntries(order.map((a) => [a, cell(a, a)]));
      let best = null, worst = null;
      const rowsHTML = order.map((a) => {
        const cells = order.map((b) => {
          const c = cell(a, b), dv = c.w - real[a].w;
          if (a !== b) {
            if (!best || dv > best.dv) best = { a, b, dv, c };
            if (!worst || dv < worst.dv) worst = { a, b, dv, c };
          }
          const tip = `${name(mgrOf(a))} on ${name(mgrOf(b))}'s schedule: ${rec(c.w, c.l, c.t)}`;
          return `<td class="cell${a === b ? " diag-cell" : ""}" style="${a === b ? "" : FFL.divBg(dv, 3)}" title="${esc(tip)}">${rec(c.w, c.l, c.t)}</td>`;
        }).join("");
        return `<tr class="${FFL.hlClass(mgrOf(a))}"><td>${whoT(a, 26, false)}</td>${cells}</tr>`;
      }).join("");
      const head = order.map((b) => `<th class="colh${FFL.filters.mgr === mgrOf(b) ? " hlc" : ""}" title="${esc(name(mgrOf(b)))}">${avT(b, 24)}${esc(short(mgrOf(b)))}</th>`).join("");
      const card = FFL.card(body, { flush: true, methods:
        "Each row is a manager's actual weekly scores; each column is whose schedule they're played against. The cell is the record that would have resulted. The outlined diagonal is the real record. " +
        "Purple is better than what actually happened, orange worse. When a borrowed schedule would have someone playing themselves, they play that schedule's owner instead. " +
        (best && best.dv > 0 ? `${esc(name(mgrOf(best.a)))} would be ${rec(best.c.w, best.c.l, best.c.t)} on ${esc(name(mgrOf(best.b)))}'s slate. ` : "") +
        (worst && worst.dv < 0 ? `${esc(name(mgrOf(worst.a)))} would be ${rec(worst.c.w, worst.c.l, worst.c.t)} on ${esc(name(mgrOf(worst.b)))}'s.` : "") });
      card.innerHTML = `<div class="tbl-wrap"><table class="heat sticky1"><thead><tr><th>Scores ↓ · Schedule →</th>${head}</tr></thead><tbody>${rowsHTML}</tbody></table></div>`;
    }

    // ---------------- position strength ----------------
    function renderStrength() {
      const wk = selWeek();
      const lus = lineupsIn(wk);
      if (!lus.length) return;
      const SLOTS = ["QB", "RB", "WR", "TE", "FLEX", "D/ST", "K"];
      const agg = {}; // tid -> slot -> {pts, games}
      lus.forEach((l) => l.players.forEach((p) => {
        if (!p.st) return;
        const sl = SLOTS.includes(p.slot) ? p.slot : "FLEX";
        const a = (agg[l.team_id] = agg[l.team_id] || {});
        a[sl] = a[sl] || { pts: 0, games: new Set() };
        a[sl].pts += p.pts; a[sl].games.add(l.week);
      }));
      const per = (t, sl) => { const x = agg[t] && agg[t][sl]; return x ? x.pts / x.games.size : null; };
      const used = SLOTS.filter((sl) => tids.some((t) => per(t, sl) != null));
      const avg = Object.fromEntries(used.map((sl) => { const v = tids.map((t) => per(t, sl)).filter((x) => x != null); return [sl, v.reduce((a, b) => a + b, 0) / v.length]; }));
      let bestCell = null;
      const rows = tids.filter((t) => agg[t]).map((t) => {
        const diffs = used.map((sl) => { const v = per(t, sl); return v == null ? null : v - avg[sl]; });
        diffs.forEach((dv, i) => { if (dv != null && (!bestCell || dv > bestCell.dv)) bestCell = { t, sl: used[i], dv }; });
        return { t, diffs, net: diffs.reduce((a, b) => a + (b || 0), 0) };
      }).sort((a, b) => b.net - a.net);
      const body = section("strength", "Position strength", wk == null ? "Points per game from each starting slot vs. the league average" : `Week ${wk} · points from each starting slot vs. the league average`);
      const card = FFL.card(body, { flush: true, methods:
        "Points from the players <b>started</b> in each slot, per game, minus the league average for that slot. Purple is above the field, orange below; the deeper the tint, the bigger the gap. " +
        "A stud on the bench doesn't show here; a weak spot shows every week. FLEX includes any multi-position slot. " +
        (bestCell ? `${esc(name(mgrOf(bestCell.t)))}'s ${bestCell.sl} is the biggest single edge in the league at ${signed(bestCell.dv, 1)} a game.` : "") });
      card.innerHTML = `<div class="tbl-wrap"><table class="heat sticky1"><thead><tr><th>Manager</th>${used.map((sl) => `<th>${sl}<div class="muted" style="font-weight:400">${fmt(avg[sl], 1)}</div></th>`).join("")}<th>Net</th></tr></thead><tbody>` +
        rows.map((r) => `<tr class="${FFL.hlClass(mgrOf(r.t))}"><td>${whoT(r.t, 26, false)}</td>${r.diffs.map((dv, i) =>
          `<td class="cell" style="${FFL.divBg(dv, 12)}" title="${esc(`${name(mgrOf(r.t))} ${used[i]}: ${dv == null ? "no starts" : fmt(per(r.t, used[i]), 1) + " per game"}`)}">${dv == null ? "–" : signed(dv, 1)}</td>`).join("")}` +
          `<td class="cell ${FFL.cls(r.net)}"><b>${signed(r.net, 1)}</b></td></tr>`).join("") + `</tbody></table></div>`;
    }

    // ---------------- trophy case ----------------
    function renderTrophies() {
      const weeks = throughWeeks(Object.keys(s.awards).map(Number));
      if (!weeks.length) return;
      const tally = {};
      weeks.forEach((w) => s.awards[w].forEach((a) => { const m = mgrOf(a.team_id); tally[m] = tally[m] || {}; tally[m][a.k] = (tally[m][a.k] || 0) + 1; }));
      const rows = tids.map((t) => {
        const m = mgrOf(t), x = tally[m] || {};
        const good = s.award_kinds.filter((k) => k.sign > 0).reduce((a, k) => a + (x[k.k] || 0), 0);
        const bad = s.award_kinds.filter((k) => k.sign < 0).reduce((a, k) => a + (x[k.k] || 0), 0);
        return { t, m, x, net: good - bad };
      });
      const body = section("trophy", "Trophy case", `${weeks.length} week${weeks.length === 1 ? "" : "s"} of awards`);
      const card = FFL.card(body, { flush: true, methods: "Every weekly award, counted per manager. Gold stars are the ones you want, red marks the ones you don't. Lucky, Robbed and Bench hero are neither; they happen to you. Net is stars minus marks." });
      const cups = (n, sign) => n ? `<span class="cups" aria-label="${n}">${`<span class="c ${sign < 0 ? "bad" : sign === 0 ? "neutral" : ""}">${sign < 0 ? "●" : sign === 0 ? "○" : "★"}</span>`.repeat(n)}</span>` : `<span class="cups"><span class="none">·</span></span>`;
      FFL.table(card, [
        { key: "m", label: "Manager", cls: "who-cell", asc: true, sort: (r) => name(r.m), html: (r) => whoT(r.t, 26, false) },
        ...s.award_kinds.map((k) => ({ key: k.k, label: k.label, sort: (r) => r.x[k.k] || 0, html: (r) => cups(r.x[k.k] || 0, k.sign) })),
        { key: "net", label: "Net", num: true, html: (r) => `<b class="${FFL.cls(r.net)}">${r.net > 0 ? "+" : ""}${r.net}</b>` },
      ], rows, { sortKey: "net", rowClass: (r) => FFL.hlClass(r.m) });
    }

    // ---------------- lineup decisions table ----------------
    function renderDecisions() {
      const wk = selWeek();
      const lus = lineupsIn(wk);
      if (!lus.length) return;
      const rows = tids.map((t) => {
        const xs = lus.filter((l) => l.team_id === t);
        if (!xs.length) return null;
        const actual = xs.reduce((a, l) => a + l.actual, 0), optimal = xs.reduce((a, l) => a + l.optimal, 0);
        const proj = xs.filter((l) => l.projected_lineup != null);
        const worst = xs.slice().sort((a, b) => b.regret - a.regret)[0];
        const cost = xs.filter((l) => { const r = results[l.week] && results[l.week][t]; return r && r.result === "L" && l.optimal > r.oppPts; }).length;
        return { t, m: mgrOf(t), regret: optimal - actual, per: (optimal - actual) / xs.length, eff: optimal ? actual / optimal : null,
          perfect: xs.filter((l) => l.regret < 0.01).length, vs: proj.length ? proj.reduce((a, l) => a + l.projected_lineup - l.actual, 0) : null,
          worst, cost, weeks: xs.length };
      }).filter(Boolean);
      const body = section("decisions", "Lineup decisions", wk == null ? "Season to date" : `Week ${wk}`);
      const card = FFL.card(body, { flush: true, methods:
        "<b>Left on bench</b> = best legal lineup minus what was started. <b>Efficiency</b> = started ÷ best possible. <b>Cost a game</b> = losses where the best lineup would have beaten the opponent's actual score. " +
        "<b>vs ESPN</b> = ESPN's projected-best lineup minus what was started: positive means trusting the projections would have helped, negative means the manager beat them." });
      FFL.table(card, [
        { key: "m", label: "Manager", cls: "who-cell", asc: true, sort: (r) => name(r.m), html: (r) => whoT(r.t, 26) },
        { key: "regret", label: "Left on bench", num: true, html: (r) => `<b>${fmt(r.regret, 1)}</b>` },
        { key: "per", label: "Per week", num: true, html: (r) => fmt(r.per, 1) },
        { key: "eff", label: "Efficiency", num: true, html: (r) => r.eff == null ? "–" : (r.eff * 100).toFixed(1) + "%" },
        { key: "perfect", label: "Perfect weeks", num: true },
        { key: "cost", label: "Cost a game", num: true, html: (r) => r.cost ? `<span class="neg">${r.cost}</span>` : "0" },
        { key: "worst", label: "Worst week", num: true, sort: (r) => r.worst.regret, html: (r) => `${fmt(r.worst.regret, 1)} <span class="muted">Wk ${r.worst.week}</span>` },
        { key: "vs", label: "vs ESPN", num: true, html: (r) => `<span class="${r.vs > 0 ? "neg" : r.vs < 0 ? "pos" : ""}">${signed(r.vs, 1)}</span>` },
      ], rows, { sortKey: "regret", rowClass: (r) => FFL.hlClass(r.m) });
    }

    // ---------------- schedule ----------------
    // With no week or manager picked, the schedule opens on the current week
    // (live, else next upcoming, else the last one) and can expand to everything.
    let scheduleFull = false;
    function renderSchedule() {
      const wk = selWeek();
      const currentWeek = s.live_week || (s.weeks.find((w) => w.scheduled) || {}).week || (s.weeks[s.weeks.length - 1] || {}).week;
      const compact = wk == null && !FFL.filters.mgr && !scheduleFull;
      const only = wk != null ? wk : compact ? currentWeek : null;
      const rows = [];
      s.weeks.forEach((w) => w.games.forEach((g) => {
        if (only != null && w.week !== only) return;
        if (!g.sides.some((x) => FFL.mgrOK(mgrOf(x.team_id)))) return;
        rows.push({ wk: w.week, g, h: g.sides[0], a: g.sides[1] });
      }));
      const total = s.weeks.reduce((a, w) => a + w.games.length, 0);
      const scope = compact ? `Week ${currentWeek} · ${rows.length} of ${total} matchups` : `${rows.length} of ${total} matchups`;
      const body = section("schedule", "Schedule", scope);
      const card = FFL.card(body, { flush: true, methods: "The full slate as drawn by ESPN. Playoff matchups appear once ESPN sets the bracket. Pick a week or a manager at the top to narrow it." });
      const sc = (r, x, other) => x.pts == null ? '<span class="muted">–</span>' : `<span class="${r.g.final && x.pts > other.pts ? "" : "muted"}">${r.g.final && x.pts > other.pts ? "<b>" + fmt(x.pts) + "</b>" : fmt(x.pts)}</span>`;
      FFL.table(card, [
        { key: "wk", label: "Week", num: true, asc: true },
        { key: "home", label: "Home", cls: "who-cell", sort: (r) => name(mgrOf(r.h.team_id)), html: (r) => whoT(r.h.team_id, 24, false) },
        { key: "hs", label: "", num: true, nosort: true, html: (r) => sc(r, r.h, r.a) },
        { key: "as", label: "", num: true, nosort: true, html: (r) => sc(r, r.a, r.h) },
        { key: "away", label: "Away", cls: "who-cell", sort: (r) => name(mgrOf(r.a.team_id)), html: (r) => whoT(r.a.team_id, 24, false) },
        { key: "st", label: "Status", nosort: true, html: (r) => r.g.final ? (r.g.type === "regular" ? '<span class="muted">Final</span>' : `<span class="tag accent">${r.g.type}</span>`) : r.g.scheduled ? '<span class="muted">Upcoming</span>' : '<span class="tag live">Live</span>' },
      ], rows, { sortKey: "wk", desc: false, sticky: false });
      if (wk == null && !FFL.filters.mgr) {
        const btn = document.createElement("button");
        btn.type = "button"; btn.className = "tbl-more" + (scheduleFull ? " open" : "");
        btn.setAttribute("aria-expanded", String(scheduleFull));
        btn.textContent = scheduleFull ? `Show Week ${currentWeek} only` : `Show full schedule (${total} matchups)`;
        btn.addEventListener("click", () => {
          scheduleFull = !scheduleFull;
          render();
          document.getElementById("schedule").scrollIntoView({ block: "start" });
        });
        card.appendChild(btn);
      }
    }

    // ---------------- rosters ----------------
    function renderRosters() {
      const w = selWeek();
      const periods = s.lineups.map((l) => l.week);
      const wk = w != null && periods.includes(w) ? w : Math.max(...periods);
      if (!isFinite(wk)) return;
      const lus = s.lineups.filter((l) => l.week === wk && FFL.mgrOK(mgrOf(l.team_id)));
      const live = !(s.weeks.find((x) => x.week === wk) || {}).final;
      const body = section("rosters", "Rosters", `Week ${wk}${live ? " · in progress" : ""} · starters above bench`);
      const grid = document.createElement("div"); grid.className = "grid-3"; body.appendChild(grid);
      const order = s.standings.map((r) => r.team_id);
      lus.sort((a, b) => order.indexOf(a.team_id) - order.indexOf(b.team_id)).forEach((l) => {
        const row = (p) => `<tr><td style="width:36px;padding-right:0">${FFL.headshot(p, 30)}</td><td><b style="font-weight:500">${esc(p.n)}</b>${injTag(p.id)}<span class="sub2">${p.pos}${FFL.proAbbr(p.pro) ? " · " + FFL.proAbbr(p.pro) : ""}${p.st ? "" : " · " + p.slot}</span></td>` +
          `<td class="n">${fmt(p.pts, 1)}<span class="sub2">${p.proj != null ? "proj " + fmt(p.proj, 1) : ""}</span></td></tr>`;
        const st = l.players.filter((p) => p.st), bn = l.players.filter((p) => !p.st);
        const c = FFL.card(grid, { flush: true });
        c.innerHTML = `<div style="padding:16px 16px 6px">${whoT(l.team_id, 36)}</div>` +
          `<table><tbody>${st.map(row).join("")}</tbody></table>` +
          `<details class="how" style="margin:0 16px 14px"><summary>Bench (${bn.length})</summary><table><tbody>${bn.map(row).join("")}</tbody></table></details>`;
      });
    }

    // ---------------- draft ----------------
    function renderDraft() {
      const rows = s.draft.filter((p) => FFL.mgrOK(mgrOf(p.team_id)));
      if (!rows.length) return;
      // Production + verdict from the league-wide draft analysis, joined by pick
      const dr = d.draft || { picks: [], grades: [], min_games: 6 };
      const prod = Object.fromEntries(dr.picks.filter((p) => p.season === s.season).map((p) => [p.pick, p]));
      const grades = dr.grades.filter((g) => g.season === s.season);
      const early = !grades.length || grades.every((g) => !g.grade);
      const body = section("draft", `${s.season} draft board`, early
        ? `${rows.length} picks · steals and busts are called once players have ${dr.min_games} games`
        : `${rows.length} picks · judged on points per game played vs. a typical pick at that spot`);
      const verdictTag = (v) => ({ Steal: '<span class="tag accent">Steal</span>', Bust: '<span class="tag warn">Bust</span>',
        "Missed time": '<span class="tag">Missed time</span>', "On par": '<span class="muted">On par</span>', "Too early": '<span class="muted">Too early</span>' }[v] || "");
      const logoOf = (m) => { const t = Object.values(s.teams).find((x) => x.manager === m); return t && t.logo; };
      if (!early) {
        const gs = grades.filter((g) => FFL.mgrOK(g.mgr)).sort((a, b) => (b.rate || 0) - (a.rate || 0));
        body.insertAdjacentHTML("beforeend", `<div class="grade-strip card card-pad">${gs.map((g) =>
          `<div class="grade-chip">${FFL.avatar(logoOf(g.mgr), name(g.mgr), 28)}<div><b>${FFL.mgrLink(g.mgr, short(g.mgr))}</b><span>${signed(g.poe, 0)} vs avg draft</span></div><span class="grade g${g.grade}">${g.grade}</span></div>`).join("")}</div>`);
      }
      const card = FFL.card(body, { flush: true, methods:
        "<b>Pts/game</b> counts only games the player actually played. <b>Typical</b> is what players at that position drafted around that spot usually score in this league. " +
        `A pick needs ${dr.min_games}+ games to be called a <b>Steal</b> or <b>Bust</b>; anyone who has missed more than half the possible games is <b>Missed time</b>, so injuries are not held against the pick. ` +
        "Grades compare each manager's points over expected with every past draft in the league; the record book has the full history." });
      if (!early) card.parentNode.style.marginTop = "12px";
      const P = (r) => prod[r.pick];
      FFL.table(card, [
        { key: "pick", label: "Pick", num: true, asc: true },
        { key: "round", label: "Rd", num: true, asc: true },
        { key: "player", label: "Player", asc: true, cls: "who-cell", html: (r) => `<div class="who">${FFL.headshot({ id: r.player_id, n: r.player || "?", pos: r.pos, pro: r.pro }, 30)}<div class="names"><b style="font-weight:500">${esc(r.player || "Unknown player")}${injTag(r.player_id)}</b><span>${r.pos || ""}${FFL.proAbbr(r.pro) ? " · " + FFL.proAbbr(r.pro) : ""}${r.keeper ? " · keeper" : ""}</span></div></div>` },
        { key: "team_id", label: "Manager", cls: "who-cell", sort: (r) => name(mgrOf(r.team_id)), html: (r) => whoT(r.team_id, 24, false) },
        { key: "ppg", label: "Pts/game", num: true, sort: (r) => P(r) && P(r).ppg, html: (r) => P(r) ? fmt(P(r).ppg, 1) : "–" },
        { key: "games", label: "Games", num: true, sort: (r) => P(r) && P(r).games, html: (r) => P(r) ? P(r).games : "–" },
        { key: "exp", label: "Typical", num: true, sort: (r) => P(r) && P(r).exp, html: (r) => P(r) && P(r).exp != null ? fmt(P(r).exp, 1) : "–" },
        { key: "value", label: "vs Typical", num: true, sort: (r) => P(r) && P(r).value, html: (r) => P(r) && P(r).value != null ? `<span class="${FFL.cls(P(r).value)}">${signed(P(r).value, 1)}</span>` : "–" },
        { key: "verdict", label: "Verdict", sort: (r) => P(r) && P(r).z, html: (r) => P(r) ? verdictTag(P(r).verdict) : "" },
      ], rows, { sortKey: "pick", desc: false, limit: FFL.filters.mgr ? 0 : nTeams, limitNoun: "picks" });  // one full round; a single manager's picks show in full
    }

    // ---------------- coming in ----------------
    function renderComingIn() {
      const rows = s.coming_in.filter((r) => r.seasons);
      if (!rows.length) return;
      const body = section("coming-in", "Coming in", `Career form before ${s.season}`);
      const card = FFL.card(body, { flush: true, methods: "Regular-season head-to-head record across every prior season each manager played, with their most recent finish. Context for this season, not part of it." });
      FFL.table(card, [
        { key: "manager", label: "Manager", cls: "who-cell", asc: true, sort: (r) => name(r.manager), html: (r) => whoT(r.team_id, 26, false) },
        { key: "seasons", label: "Seasons", num: true },
        { key: "win_pct", label: "Record", num: true, html: (r) => `${rec(r.w, r.l, r.t)} <span class="muted">${pct(r.win_pct)}</span>` },
        { key: "titles", label: "Titles", num: true, html: (r) => r.titles ? `<span class="star">${"★".repeat(r.titles)}</span>` : '<span class="muted">–</span>' },
        { key: "last", label: "Last season", sort: (r) => r.last ? r.last.rank : 99, asc: true, html: (r) => r.last ? `${r.last.season}: ${r.last.record}, finished ${FFL.ordinal(r.last.rank)} of ${r.last.teams}` : "–" },
      ], rows, { sortKey: "win_pct", rowClass: (r) => FFL.hlClass(r.manager) });
    }

    FFL.onFilter(render);
    render();
  });
})();
