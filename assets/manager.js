/* Manager profiles. ?mgr=<id> shows one profile; no manager shows the directory. */
(function () {
  const { esc, fmt, pct, signed, rec, name, short } = FFL;

  FFL.boot("manager", (d) => ({ managers: d.record_book.managers.map((m) => m.manager) }), (d) => {
    const rb = d.record_book;
    const seasons = rb.seasons;
    const lastSeason = seasons[seasons.length - 1];
    const currentMgrs = new Set(lastSeason.standings.map((r) => r.manager));
    const mgrLogo = {};
    seasons.forEach((s) => s.standings.forEach((r) => { if (r.logo) mgrLogo[r.manager] = r.logo; }));
    const career = Object.fromEntries(rb.managers.map((m) => [m.manager, m]));
    const app = FFL.$("#app");
    const section = (id, title, scope) => {
      app.insertAdjacentHTML("beforeend", FFL.section(id, title, scope));
      return app.lastElementChild.querySelector(".section-body");
    };

    function render() {
      FFL.tip.hide();
      app.innerHTML = "";
      const m = FFL.filters.mgr;
      if (!m || !career[m]) return renderDirectory();
      document.title = `${name(m)} · ${d.league_name}`;
      renderProfile(m);
      window.scrollTo(0, 0);
    }

    // ---------------- directory ----------------
    function renderDirectory() {
      document.title = `Managers · ${d.league_name}`;
      app.insertAdjacentHTML("beforeend", `<div class="hero"><h1>Managers</h1><p>${rb.managers.length} managers since ${d.first_season}. Pick one for their full career, rivalries, and records.</p></div>`);
      const groups = [["Current managers", rb.managers.filter((m) => currentMgrs.has(m.manager))], ["Former managers", rb.managers.filter((m) => !currentMgrs.has(m.manager))]];
      groups.forEach(([title, list], gi) => {
        if (!list.length) return;
        const body = section(gi ? "former" : "current", title, `${list.length}`);
        const grid = document.createElement("div"); grid.className = "dir-grid"; body.appendChild(grid);
        grid.innerHTML = list.slice().sort((a, b) => name(a.manager).localeCompare(name(b.manager))).map((c) =>
          `<a class="card dir-card" href="${esc(FFL.mgrHref(c.manager))}">${FFL.avatar(mgrLogo[c.manager], name(c.manager), 52)}
            <div><b>${esc(name(c.manager))}</b><span>${c.first_season}–${c.last_season} · ${c.seasons} season${c.seasons === 1 ? "" : "s"}</span>
            <span>${rec(c.w, c.l, c.t)} · ${c.titles ? `<span class="star">${"★".repeat(c.titles)}</span>` : "no titles yet"}</span></div></a>`).join("");
      });
    }

    // ---------------- profile ----------------
    function renderProfile(m) {
      const c = career[m];
      const rows = seasons.map((s) => ({ s, r: s.standings.find((x) => x.manager === m) })).filter((x) => x.r);
      const teamNames = rows.map((x) => x.r.team);
      const isCurrent = currentMgrs.has(m);
      const otherNames = [...new Set(teamNames)].filter((n) => n !== teamNames[teamNames.length - 1]);

      // Hero
      app.insertAdjacentHTML("beforeend", `<div class="hero profile-hero">${FFL.avatar(mgrLogo[m], name(m), 88)}
        <div><h1>${esc(name(m))}</h1><p>${c.first_season}–${c.last_season} · ${c.seasons} season${c.seasons === 1 ? "" : "s"}${isCurrent ? "" : " · former manager"}</p>
        <p class="team-history" title="${esc(otherNames.join(" · "))}">${esc(teamNames[teamNames.length - 1])}${otherNames.length ? ` <span class="muted">· also ${otherNames.length} other team name${otherNames.length > 1 ? "s" : ""}</span>` : ""}</p></div></div>`);
      const tile = (k, v, sub) => `<div class="card tile"><div class="k">${k}</div><div class="v">${v}</div><div class="d">${sub}</div></div>`;
      const rankOf = (key, asc) => {
        const list = rb.managers.filter((x) => x.seasons >= 3 && x[key] != null).sort((a, b) => asc ? a[key] - b[key] : b[key] - a[key]);
        const i = list.findIndex((x) => x.manager === m);
        return i < 0 ? "" : `${FFL.ordinal(i + 1)} of ${list.length}`;
      };
      // Luck per season is ranked among current managers only (any number of seasons)
      const luckRank = () => {
        const list = rb.managers.filter((x) => currentMgrs.has(x.manager) && x.luck_per_season != null).sort((a, b) => b.luck_per_season - a.luck_per_season);
        const i = list.findIndex((x) => x.manager === m);
        return i < 0 ? "" : `${FFL.ordinal(i + 1)} of ${list.length} current`;
      };
      app.insertAdjacentHTML("beforeend", `<div class="tiles">` + [
        tile("Titles", c.titles ? `<span class="star">${"★".repeat(c.titles)}</span>` : "0", c.titles ? rows.filter((x) => x.r.final_rank === 1).map((x) => x.s.season).join(", ") : `${c.runner_up} runner-up finish${c.runner_up === 1 ? "" : "es"}`),
        tile("Career record", rec(c.w, c.l, c.t), `${pct(c.win_pct)} · ${rankOf("win_pct")}`),
        tile("Playoffs", `${c.playoffs}`, `${rec(c.playoff_w, c.playoff_l)} in playoff games`),
        tile("Avg finish", fmt(c.avg_finish, 1), `Best: ${FFL.ordinal(c.best_finish)} · ${rankOf("avg_finish", true)}`),
        tile("Points per week", fmt(c.ppg, 1), rankOf("ppg")),
        tile("Luck per season", signed(c.luck_per_season, 2), `${c.seasons} season${c.seasons === 1 ? "" : "s"} · ${isCurrent ? luckRank() : "former managers aren't ranked"}`),
      ].join("") + `</div>`);

      renderFinishChart(m, rows);
      renderSeasonTable(m, rows);
      renderProfileRivals(m);
      renderHighsLows(m);
      renderProfileDraft(m);
      renderRecordsHeld(m);
      if (isCurrent) {
        const r = lastSeason.standings.find((x) => x.manager === m);
        const body = section("now", `${lastSeason.season} so far`, "");
        body.innerHTML = `<div class="card card-pad" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          ${FFL.who(m, r.team, r.logo, 40)}<div><b>${rec(r.w, r.l, r.t)}</b> <span class="muted">· seed ${r.seed} · ${fmt(r.pf, 1)} pts</span></div>
          <a href="season.html?mgr=${encodeURIComponent(m)}">Open the season tracker filtered to ${esc(short(m))} ›</a></div>`;
      }
    }

    // Finish by season: rank 1 at the top, gold dot for titles.
    function renderFinishChart(m, rows) {
      const done = rows.filter((x) => x.r.final_rank);
      if (done.length < 2) return;
      const body = section("finishes", "Finish by season", "");
      const card = FFL.card(body, {
        title: "Final placement", scope: "1st is the champion · gold marks a title",
        methods: "Final placement each season, in completed seasons. Hover or tab to a point for the team name and record.",
        table: () => `<div class="tbl-wrap"><table><thead><tr><th>Season</th><th class="n">Finish</th><th class="n">Teams</th></tr></thead><tbody>${done.map((x) => `<tr><td>${x.s.season}</td><td class="n">${FFL.ordinal(x.r.final_rank)}</td><td class="n">${x.s.teams}</td></tr>`).join("")}</tbody></table></div>`,
        rebind: (el) => draw(el),
      });
      const draw = (el) => {
        // Draw at the card's real width so text stays 11px on every screen
        const W = Math.max(300, el.clientWidth || 720), H = 220, L = 38, R = 16, T = 14, B = 28;
        const maxRank = Math.max(...done.map((x) => x.s.teams));
        const sx = (i) => L + (done.length === 1 ? 0 : (i * (W - L - R)) / (done.length - 1));
        const sy = (r) => T + ((r - 1) * (H - T - B)) / (maxRank - 1);
        let g = "";
        [1, Math.round(maxRank / 2), maxRank].forEach((r) => {
          g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${sy(r)}" y2="${sy(r)}"/><text class="axis-label" x="${L - 8}" y="${sy(r) + 4}" text-anchor="end">${FFL.ordinal(r)}</text>`;
        });
        const every = W < 500 ? 2 : 1;
        done.forEach((x, i) => { if (i % every === 0 || i === done.length - 1) g += `<text class="axis-label" x="${sx(i)}" y="${H - 6}" text-anchor="middle">${W < 500 ? "'" + String(x.s.season).slice(2) : x.s.season}</text>`; });
        const path = done.map((x, i) => `${i ? "L" : "M"}${sx(i).toFixed(1)},${sy(x.r.final_rank).toFixed(1)}`).join("");
        const dots = done.map((x, i) => `<circle class="fdot${x.r.final_rank === 1 ? " gold" : ""}" data-tip="${i}" tabindex="0" cx="${sx(i)}" cy="${sy(x.r.final_rank)}" r="${x.r.final_rank === 1 ? 6.5 : 5}"/>` +
          `<circle data-tip="${i}" cx="${sx(i)}" cy="${sy(x.r.final_rank)}" r="14" fill="transparent"/>`).join("");
        el.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Finish by season">${g}<path class="fline" d="${path}"/>${dots}</svg>`;
        FFL.bindTips(el, (i) => {
          const x = done[i];
          return { title: `${x.s.season} · ${x.r.team}`, rows: [{ v: FFL.ordinal(x.r.final_rank), l: `of ${x.s.teams}` }, { v: rec(x.r.w, x.r.l, x.r.t), l: "record" }] };
        });
      };
      draw(card);
    }

    function renderSeasonTable(m, rows) {
      const body = section("seasons", "Season by season", "");
      const card = FFL.card(body, { flush: true });
      FFL.table(card, [
        { key: "season", label: "Season", num: true, sort: (x) => x.s.season, html: (x) => x.s.season },
        { key: "team", label: "Team", cls: "who-cell", sort: (x) => x.r.team, asc: true, html: (x) => `<div class="who">${FFL.avatar(x.r.logo, x.r.team, 28)}<div class="names"><b style="font-weight:500">${esc(x.r.team)}</b></div></div>` },
        { key: "finish", label: "Finish", num: true, asc: true, sort: (x) => x.r.final_rank || 99, html: (x) => x.r.final_rank === 1 ? '<span class="star">★</span> 1st' : x.r.final_rank ? FFL.ordinal(x.r.final_rank) : `<span class="muted">seed ${x.r.seed}</span>` },
        { key: "rec", label: "Record", num: true, sort: (x) => x.r.w / Math.max(1, x.r.w + x.r.l), html: (x) => rec(x.r.w, x.r.l, x.r.t) },
        { key: "pf", label: "PF", num: true, sort: (x) => x.r.ppg, html: (x) => fmt(x.r.pf, 1) },
        { key: "pa", label: "PA", num: true, sort: (x) => x.r.pa, html: (x) => fmt(x.r.pa, 1) },
        { key: "ap", label: "All-play", num: true, sort: (x) => x.r.all_play_pct, html: (x) => pct(x.r.all_play_pct) },
        { key: "luck", label: "Luck", num: true, sort: (x) => x.r.luck, html: (x) => `<span class="${FFL.cls(x.r.luck)}">${signed(x.r.luck, 1)}</span>` },
        { key: "po", label: "Playoffs", num: true, nosort: true, html: (x) => x.r.playoff[0] + x.r.playoff[1] ? rec(...x.r.playoff) : '<span class="muted">–</span>' },
        { key: "regret", label: "Regret", num: true, sort: (x) => x.r.regret, html: (x) => fmt(x.r.regret, 1) },
        { key: "moves", label: "Moves", num: true, sort: (x) => x.r.moves, html: (x) => x.r.moves },
        { key: "trades", label: "Trades", num: true, sort: (x) => x.r.trades, html: (x) => x.r.trades },
      ], rows.slice().reverse(), { sortKey: "season" });
    }

    function renderProfileRivals(m) {
      const r = FFL.rivals(m);
      const body = section("rivals", "Rivalries", "Record against every opponent, regular season and playoffs");
      const big = (label, tone, s, blurb) => `<div class="card card-pad riv-hero"><div class="riv-label ${tone}">${label}</div>` +
        (s ? `${FFL.who(s.opp, blurb(s), mgrLogo[s.opp], 44)}<div class="riv-big">${rec(s.w, s.l, s.t)}</div>` : `<div class="muted">Not enough meetings yet</div>`) + `</div>`;
      body.insertAdjacentHTML("beforeend", `<div class="grid-3" style="margin-bottom:16px">` +
        big("Nemesis", "bad", r.nemesis, (s) => `${pct(s.pct)} in ${s.games} meetings`) +
        big("Favorite victim", "good", r.victim, (s) => `${pct(s.pct)} in ${s.games} meetings`) +
        big("Arch-rival", "accent", r.arch, (s) => `${s.games} meetings${s.po.length ? ` · ${s.po.length} in the playoffs` : ""}`) + `</div>`);
      const card = FFL.card(body, { flush: true });
      FFL.table(card, [
        { key: "opp", label: "Opponent", cls: "who-cell", asc: true, sort: (s) => name(s.opp), html: (s) => FFL.who(s.opp, currentMgrs.has(s.opp) ? null : "former", mgrLogo[s.opp], 28) },
        { key: "games", label: "Meetings", num: true },
        { key: "pct", label: "Record", num: true, html: (s) => `${rec(s.w, s.l, s.t)} <span class="muted">${pct(s.pct)}</span>` },
        { key: "diff", label: "Avg margin", num: true, sort: (s) => (s.pf - s.pa) / s.games, html: (s) => `<span class="${FFL.cls(s.pf - s.pa)}">${signed((s.pf - s.pa) / s.games, 1)}</span>` },
        { key: "po", label: "Playoff meetings", num: true, sort: (s) => s.po.length, html: (s) => s.po.length ? `${s.po.length} <span class="muted">(${s.po.filter((x) => x.res === "W").length}-${s.po.filter((x) => x.res === "L").length})</span>` : '<span class="muted">0</span>' },
        { key: "streak", label: "Streak", num: true, sort: (s) => s.streak ? (s.streak.res === "W" ? s.streak.n : -s.streak.n) : 0, html: (s) => s.streak ? `<span class="${s.streak.res === "W" ? "pos" : s.streak.res === "L" ? "neg" : ""}">${s.streak.res}${s.streak.n}</span>` : "" },
        { key: "best", label: "Biggest win", num: true, sort: (s) => s.bestWin ? s.bestWin.me - s.bestWin.them : -1, html: (s) => s.bestWin ? `+${fmt(s.bestWin.me - s.bestWin.them, 1)} <span class="muted">${s.bestWin.season}</span>` : '<span class="muted">–</span>' },
        { key: "last", label: "Last meeting", num: true, sort: (s) => s.last.season * 100 + s.last.week, html: (s) => `<span class="${s.last.res === "W" ? "pos" : s.last.res === "L" ? "neg" : ""}">${s.last.res}</span> ${fmt(s.last.me, 1)}–${fmt(s.last.them, 1)} <span class="muted">${s.last.season} Wk ${s.last.week}</span>` },
      ], r.list, { sortKey: "games" });
    }

    function renderHighsLows(m) {
      // From the game log (single-week games only, so two-week playoff totals don't count)
      const mine = rb.games.filter((g) => !g[7] && (g[3] === m || g[4] === m)).map((g) => {
        const home = g[3] === m;
        return { season: g[0], week: g[1], po: g[2] === "p", opp: home ? g[4] : g[3], me: home ? g[5] : g[6], them: home ? g[6] : g[5] };
      });
      if (!mine.length) return;
      const best = mine.slice().sort((a, b) => b.me - a.me)[0];
      const worst = mine.slice().sort((a, b) => a.me - b.me)[0];
      const wins = mine.filter((x) => x.me > x.them), losses = mine.filter((x) => x.me < x.them);
      const bigW = wins.sort((a, b) => (b.me - b.them) - (a.me - a.them))[0];
      const bigL = losses.sort((a, b) => (a.me - a.them) - (b.me - b.them))[0];
      const heartbreak = mine.filter((x) => x.me < x.them).sort((a, b) => b.me - a.me)[0];
      const steal = mine.filter((x) => x.me > x.them).sort((a, b) => a.me - b.me)[0];
      const body = section("highs", "Career highs and lows", "Single-week games, regular season and playoffs");
      const tile = (k, v, g, txt) => g ? `<div class="card tile"><div class="k">${k}</div><div class="v">${v}</div><div class="d">${txt} · ${g.season} Wk ${g.week}${g.po ? " · playoffs" : ""}</div></div>` : "";
      body.innerHTML = `<div class="tiles" style="margin-top:0">` + [
        tile("Best week", fmt(best.me), best, `vs ${esc(name(best.opp))}`),
        tile("Worst week", fmt(worst.me), worst, `vs ${esc(name(worst.opp))}`),
        tile("Biggest win", bigW ? "+" + fmt(bigW.me - bigW.them, 1) : "", bigW, bigW ? `over ${esc(name(bigW.opp))}` : ""),
        tile("Worst loss", bigL ? "−" + fmt(bigL.them - bigL.me, 1) : "", bigL, bigL ? `to ${esc(name(bigL.opp))}` : ""),
        tile("Heartbreaker", heartbreak ? fmt(heartbreak.me) : "", heartbreak, heartbreak ? `most points in a loss, to ${esc(name(heartbreak.opp))}` : ""),
        tile("Highway robbery", steal ? fmt(steal.me) : "", steal, steal ? `fewest points in a win, over ${esc(name(steal.opp))}` : ""),
      ].join("") + `</div>`;
    }

    function renderProfileDraft(m) {
      const dr = d.draft;
      if (!dr) return;
      const mine = dr.picks.filter((p) => p.mgr === m);
      const grades = dr.grades.filter((g) => g.mgr === m).sort((a, b) => a.season - b.season);
      if (!mine.length) return;
      const body = section("drafting", "Drafting", `${dr.seasons[0]} on · judged on points per game played vs. a typical pick at that spot`);
      body.insertAdjacentHTML("beforeend", `<div class="card card-pad" style="margin-bottom:16px"><div class="card-scope" style="margin:0 0 10px">Draft grade by season</div>
        <div class="grade-strip-inline">${grades.map((g) => `<div class="grade-year">${g.grade ? `<span class="grade g${g.grade}">${g.grade}</span>` : '<span class="grade gC">–</span>'}<span>${g.season}</span></div>`).join("")}</div></div>`);
      const grid = document.createElement("div"); grid.className = "grid-2"; body.appendChild(grid);
      const row = (p) => `<tr><td style="width:40px;padding-right:0">${FFL.headshot({ id: p.id, n: p.n, pos: p.pos, pro: p.pro }, 32)}</td>
        <td><b style="font-weight:500">${esc(p.n || "Unknown")}</b> <span class="muted">${p.pos}</span><span class="sub2">${p.season} · Rd ${p.round}, pick ${p.pick}</span></td>
        <td class="n"><b>${fmt(p.ppg, 1)}</b><span class="sub2">vs ${fmt(p.exp, 1)} typical</span></td></tr>`;
      const SHOW = 5;
      [["Best picks", "steals", mine.filter((p) => p.verdict === "Steal").sort((a, b) => b.z - a.z)],
        ["Worst picks", "busts", mine.filter((p) => p.verdict === "Bust").sort((a, b) => a.z - b.z)]].forEach(([title, noun, rows]) => {
        const c = FFL.card(grid, { flush: true });
        const more = rows.length > SHOW;
        c.innerHTML = `<div style="padding:18px 18px 6px"><h3 class="card-title">${title}</h3>${more ? `<div class="card-scope">${rows.length} ${noun} in all</div>` : ""}</div>` +
          (rows.length ? `<table class="draft-list"><tbody>${rows.map((p, i) => row(p).replace("<tr>", `<tr${i >= SHOW ? ' class="extra"' : ""}>`)).join("")}</tbody></table>` : `<div class="empty">None yet</div>`) +
          (more ? `<button type="button" class="tbl-more" aria-expanded="false">Show all ${rows.length} ${noun}</button>` : "");
        const btn = c.querySelector(".tbl-more");
        if (btn) btn.addEventListener("click", () => {
          const open = c.classList.toggle("open-list");
          btn.classList.toggle("open", open);
          btn.setAttribute("aria-expanded", String(open));
          btn.textContent = open ? "Show fewer" : `Show all ${rows.length} ${noun}`;
          if (!open && c.getBoundingClientRect().top < 0) c.scrollIntoView({ block: "start" });
        });
      });
    }

    function renderRecordsHeld(m) {
      const held = [];
      rb.records.forEach((R) => R.rows.forEach((x, i) => {
        const who = x.manager || (R.kind === "game_loser" ? x.loser : x.winner);
        if (who !== m) return;
        const value = { score: fmt(x.pts), game: fmt(R.id === "shootout" || R.id === "snoozer" ? x.combined : x.margin), game_loser: fmt(x.lpts), game_winner: fmt(x.wpts),
          season: { ppg: fmt(x.ppg), win_pct: x.h2h ? rec(...x.h2h) : "", luck: signed(x.luck, 2), regret: fmt(x.regret, 1) }[R.stat], streak: `${x.len} games`, regret: fmt(x.regret, 1) }[R.kind];
        const when = x.from ? `${x.from[0]} Wk ${x.from[1]} → ${x.to[0]} Wk ${x.to[1]}` : x.week ? `${x.season} Wk ${x.week}` : `${x.season}`;
        held.push({ rank: i + 1, title: R.title, value, when });
      }));
      const body = section("records", "In the record book", held.length ? `${held.length} spot${held.length === 1 ? "" : "s"} on the all-time top-10 lists` : "");
      if (!held.length) { body.innerHTML = `<div class="card empty">Not on any all-time top-10 list yet.</div>`; return; }
      held.sort((a, b) => a.rank - b.rank);
      const card = FFL.card(body, { flush: true });
      FFL.table(card, [
        { key: "rank", label: "Rank", num: true, asc: true, html: (h) => h.rank === 1 ? '<span class="star">★</span> 1' : h.rank },
        { key: "title", label: "Record", asc: true },
        { key: "value", label: "Value", num: true, nosort: true },
        { key: "when", label: "When", nosort: true, html: (h) => `<span class="muted">${esc(h.when)}</span>` },
      ], held, { sortKey: "rank", desc: false, sticky: false });
    }

    FFL.onFilter(render);
    render();
  });
})();
