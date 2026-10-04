/* Record book. Re-renders when the season or manager filter changes. */
(function () {
  const { esc, fmt, pct, signed, rec, name, short } = FFL;

  FFL.boot("record", (d) => ({
    managers: d.record_book.managers.map((m) => m.manager),
    seasons: d.record_book.seasons.map((s) => ({ season: s.season, live: !s.complete })),
  }), (d) => {
    const rb = d.record_book;
    const seasons = rb.seasons;
    const completed = seasons.filter((s) => s.complete);
    const lastSeason = seasons[seasons.length - 1];
    const currentMgrs = new Set(lastSeason.standings.map((r) => r.manager));
    // Latest known logo per manager (for avatars outside a specific season)
    const mgrLogo = {};
    seasons.forEach((s) => s.standings.forEach((r) => { if (r.logo) mgrLogo[r.manager] = r.logo; }));
    const whoM = (m, sub, size = 30) => FFL.who(m, sub, mgrLogo[m], size);
    const app = FFL.$("#app");
    let h2hMode = "all", onlyCurrent = true, careersCurrent = true, seasonPick = String(lastSeason.season), showAllRecords = {};
    const selSeason = () => FFL.filters.season && FFL.filters.season !== "all"
      ? seasons.find((s) => String(s.season) === FFL.filters.season) || null : null;

    const section = (id, title, scope) => {
      app.insertAdjacentHTML("beforeend", FFL.section(id, title, scope));
      return app.lastElementChild.querySelector(".section-body");
    };

    function render() {
      FFL.tip.hide();
      app.innerHTML = "";
      const sel = selSeason();
      renderHero(sel);
      renderChampions(sel);
      if (sel) renderStandings(sel); else renderCareers();
      renderRecords(sel);
      renderH2H(sel);
      renderDraft(sel);
      renderRivalries(sel);
      renderFinishes(sel);
      if (!sel) renderStandings(null);
    }

    // ---------- hero ----------
    function renderHero(sel) {
      const tile = (k, v, s) => `<div class="card tile"><div class="k">${k}</div><div class="v">${v}</div><div class="d">${s}</div></div>`;
      if (sel) {
        const recs = rb.records_by_season[sel.season] || [];
        const hi = (recs.find((r) => r.id === "high_score") || { rows: [] }).rows[0];
        const lo = (recs.find((r) => r.id === "low_score") || { rows: [] }).rows[0];
        const best = sel.standings.slice().sort((a, b) => b.h2h[0] - a.h2h[0] || b.pf - a.pf)[0];
        const notes = [`${sel.teams} teams`, `${sel.regular_season_weeks}-week regular season`, `${sel.playoff_teams}-team playoff`];
        if (sel.median_bonus) notes.push("top-half bonus win each week");
        app.insertAdjacentHTML("beforeend", `<div class="hero"><h1>${sel.season} Season</h1><p>${notes.join(" · ")}${sel.complete ? "" : " · in progress"}</p><div class="tiles">` + [
          sel.complete ? tile("Champion", esc(name(sel.champion)), esc(sel.champion_team)) : tile("In progress", "TBD", `<a href="season.html">Open the season tracker ›</a>`),
          tile("Best regular season", rec(...best.h2h), `${esc(name(best.manager))} · head-to-head`),
          hi ? tile("Highest score", fmt(hi.pts), `${esc(name(hi.manager))} · Wk ${hi.week}`) : "",
          lo ? tile("Lowest score", fmt(lo.pts), `${esc(name(lo.manager))} · Wk ${lo.week}`) : "",
        ].join("") + `</div></div>`);
        return;
      }
      const byTitles = rb.managers.slice().sort((a, b) => b.titles - a.titles);
      const topTitles = byTitles.filter((m) => m.titles === byTitles[0].titles);
      // New leagues: the win % minimum drops to the longest tenure (3 seasons at most)
      const minSeasons = Math.min(3, Math.max(...rb.managers.map((m) => m.seasons)));
      const bestPct = rb.managers.filter((m) => m.seasons >= minSeasons).sort((a, b) => b.win_pct - a.win_pct)[0];
      const hi = rb.records.find((r) => r.id === "high_score").rows[0];
      const lo = rb.records.find((r) => r.id === "low_score").rows[0];
      const sub = FFL.filters.mgr ? `Highlighting ${esc(name(FFL.filters.mgr))}` : `${completed.length} complete seasons · ${rb.managers.length} managers`;
      app.insertAdjacentHTML("beforeend", `<div class="hero"><h1>Record Book</h1><p>${d.first_season}–${d.last_season} · ${sub}</p><div class="tiles">` +
        [topTitles[0].titles ? tile("Most titles", topTitles[0].titles, topTitles.map((m) => esc(name(m.manager))).join(", "))
            : tile("Most titles", "None yet", "The first title is decided this season"),
          tile("Best career win %", pct(bestPct.win_pct), `${esc(name(bestPct.manager))} · ${minSeasons > 1 ? `min. ${minSeasons} seasons` : "this season"}`),
          tile("Highest score", fmt(hi.pts), `${esc(name(hi.manager))} · ${hi.season} Wk ${hi.week}`),
          tile("Lowest score", fmt(lo.pts), `${esc(name(lo.manager))} · ${lo.season} Wk ${lo.week}`),
        ].join("") + `</div></div>`);
    }

    // ---------- champions ----------
    function renderChampions(sel) {
      if (sel && !sel.complete) return;
      const body = section("champions", sel ? `${sel.season} finish` : "Champions", "Title winner, runner-up, regular-season top seed, and last place");
      const grid = document.createElement("div"); grid.className = "champs"; body.appendChild(grid);
      const f = FFL.filters.mgr;
      grid.innerHTML = (sel ? [sel] : seasons.slice().reverse()).map((s) => {
        if (!s.complete) {
          const lead = s.standings.slice().sort((a, b) => (a.seed || 99) - (b.seed || 99))[0];
          return `<div class="card champ live">
            <div class="yr"><span>${s.season}</span><span class="tag live">In progress</span></div>
            ${whoM(lead.manager, "Current leader", 40)}<div class="more"><a href="season.html">Open the season tracker ›</a></div></div>`;
        }
        const hl = f && [s.champion, s.runner_up].includes(f) ? " hl" : "";
        return `<div class="card champ${hl}"><div class="yr"><span>${s.season}</span><span>${s.teams} teams</span></div>
          ${FFL.who(s.champion, s.champion_team, s.champion_logo, 40)}
          <div class="more">Runner-up · ${FFL.mgrLink(s.runner_up)}<br>Top seed · ${FFL.mgrLink(s.top_seed)}<br>Last place · ${FFL.mgrLink(s.last)}</div></div>`;
      }).join("");
    }

    // ---------- careers ----------
    function renderCareers() {
      const body = section("managers", "Manager careers", "Regular-season head-to-head unless noted. Tap a column to sort.");
      const controls = document.createElement("div");
      controls.style.cssText = "margin-bottom:12px";
      const nFormer = rb.managers.filter((m) => !currentMgrs.has(m.manager)).length;
      controls.innerHTML = `<div class="seg" role="group" aria-label="Which managers"><button type="button" data-c="1" aria-pressed="${careersCurrent}">Current managers</button>` +
        `<button type="button" data-c="0" aria-pressed="${!careersCurrent}">Everyone (+${nFormer} former)</button></div>`;
      body.appendChild(controls);
      controls.querySelectorAll("[data-c]").forEach((b) => b.addEventListener("click", () => {
        careersCurrent = b.dataset.c === "1"; render(); document.getElementById("managers").scrollIntoView();
      }));
      const careerRows = careersCurrent ? rb.managers.filter((m) => currentMgrs.has(m.manager)) : rb.managers;
      const card = FFL.card(body, { flush: true, methods:
        "<b>Years</b> shows first and most recent season. <b>Record</b> is regular-season head-to-head; ESPN's top-half bonus wins (2024 on) are shown separately as <b>Median</b> so every era compares fairly. " +
        "<b>All-play</b> is the record if you'd played every team every week. <b>Luck/season</b> is actual wins minus all-play expected wins, averaged per season so long careers aren't inflated; only current managers are ranked, with their season count underneath (a season in progress counts as the share played). " +
        "<b>Regret/wk</b> is average bench points a better legal lineup would have added (weeks where ESPN's lineup data is reliable: most of 2017–18 and all of 2019 on). " +
        "<b>Playoffs</b> counts appearances in completed seasons. Pick a season at the top to see just that year." });
      FFL.table(card, [
        { key: "manager", label: "Manager", sort: (r) => name(r.manager), asc: true, cls: "who-cell",
          html: (r) => whoM(r.manager, `${r.first_season}–${r.last_season}${currentMgrs.has(r.manager) ? "" : " · former"}`) },
        { key: "seasons", label: "Yrs", num: true },
        { key: "titles", label: "Titles", num: true, html: (r) => r.titles ? `<span class="star">${"★".repeat(r.titles)}</span>` : '<span class="muted">–</span>' },
        { key: "runner_up", label: "2nd", num: true },
        { key: "playoffs", label: "Playoffs", num: true },
        { key: "win_pct", label: "Record", num: true, html: (r) => `${rec(r.w, r.l, r.t)} <span class="muted">${pct(r.win_pct)}</span>` },
        { key: "median_w", label: "Median", num: true, html: (r) => r.median_w + r.median_l ? rec(r.median_w, r.median_l) : '<span class="muted">–</span>' },
        { key: "playoff_w", label: "Playoff W-L", num: true, html: (r) => rec(r.playoff_w, r.playoff_l) },
        { key: "ppg", label: "Pts/wk", num: true, html: (r) => fmt(r.ppg) },
        { key: "all_play_pct", label: "All-play", num: true, html: (r) => pct(r.all_play_pct) },
        { key: "luck_per_season", label: "Luck/season", num: true, title: "Wins above all-play expectation, averaged per season played. Current managers only.",
          sort: (r) => currentMgrs.has(r.manager) ? r.luck_per_season : null,
          html: (r) => currentMgrs.has(r.manager)
            ? `<span class="${FFL.cls(r.luck_per_season)}" title="${esc(`${signed(r.luck, 1)} wins total`)}">${signed(r.luck_per_season, 2)}</span><span class="sub2">${r.seasons} season${r.seasons === 1 ? "" : "s"}</span>`
            : '<span class="muted" title="Former managers are not ranked">–</span>' },
        { key: "avg_finish", label: "Avg finish", num: true, asc: true, html: (r) => fmt(r.avg_finish, 1) },
        { key: "best_finish", label: "Best", num: true, asc: true, html: (r) => FFL.ordinal(r.best_finish) },
        { key: "last_places", label: "Last place", num: true },
        { key: "regret_per_week", label: "Regret/wk", num: true, asc: true, html: (r) => fmt(r.regret_per_week, 1) },
        { key: "moves", label: "Moves", num: true },
        { key: "trades", label: "Trades", num: true },
      ], careerRows, { sortKey: "titles", rowClass: (r) => FFL.hlClass(r.manager) });
    }

    // ---------- records ----------
    function renderRecords(sel) {
      const list = sel ? (rb.records_by_season[sel.season] || []) : rb.records;
      const body = section("records", sel ? `${sel.season} records` : "All-time records", "Regular season and playoffs · consolation games excluded");
      const f = FFL.filters.mgr;
      const tag = (type) => type === "playoff" ? ' <span class="tag accent">Playoff</span>' : "";
      const when = (r) => sel ? `Wk ${r.week}` : `${r.season} Wk ${r.week}`;
      const involves = (r) => [r.manager, r.winner, r.loser].includes(f);
      const rows = {
        score: (r) => [whoM(r.manager, `vs ${name(r.opp)} · ${when(r)}`, 26) + tag(r.type), fmt(r.pts)],
        game: (r, R) => [`<b>${FFL.mgrLink(r.winner)}</b> <span class="muted">def.</span> ${FFL.mgrLink(r.loser)}<span class="sub2">${fmt(r.wpts)}–${fmt(r.lpts)} · ${when(r)}${tag(r.type)}</span>`,
          fmt(R.id === "shootout" || R.id === "snoozer" ? r.combined : r.margin)],
        game_loser: (r) => [whoM(r.loser, `lost to ${name(r.winner)} (${fmt(r.wpts)}) · ${when(r)}`, 26), fmt(r.lpts)],
        game_winner: (r) => [whoM(r.winner, `beat ${name(r.loser)} (${fmt(r.lpts)}) · ${when(r)}`, 26), fmt(r.wpts)],
        season: (r, R) => [whoM(r.manager, sel ? r.team : `${r.season} · ${r.team}`, 26),
          { ppg: fmt(r.ppg), win_pct: `${rec(...r.h2h)}`, luck: signed(r.luck, 2), regret: fmt(r.regret, 1) }[R.stat]],
        streak: (r) => [whoM(r.manager, sel ? `Wk ${r.from[1]} → Wk ${r.to[1]}` : `${r.from[0]} Wk ${r.from[1]} → ${r.to[0]} Wk ${r.to[1]}`, 26), r.len],
        regret: (r) => {
          const m = r.misses[0];
          const miss = m ? `Benched ${m.start} (${fmt(m.start_pts, 1)}) for ${m.sit} (${fmt(m.sit_pts, 1)})` : "";
          return [whoM(r.manager, `${when(r)} · ${miss}`, 26), fmt(r.regret, 1)];
        },
      };
      const SHOW = 5;
      const shown = list.filter((R) => R.rows.length);
      if (!shown.length) { body.innerHTML = `<div class="card empty">No completed games yet.</div>`; return; }
      const grid = document.createElement("div"); grid.className = "records"; body.appendChild(grid);
      grid.innerHTML = shown.map((R) => {
        const open = showAllRecords[R.id];
        const trs = R.rows.map((x, i) => {
          const [a, b] = rows[R.kind](x, R);
          const cls = [i >= SHOW ? "extra" : "", f ? (involves(x) ? "hl" : "") : ""].join(" ");
          return `<tr class="${cls}"><td>${i + 1}</td><td>${a}</td><td class="n">${b}</td></tr>`;
        }).join("");
        const more = R.rows.length > SHOW ? `<button type="button" class="more-btn" data-r="${R.id}">${open ? "Show less" : `Show all ${R.rows.length}`}</button>` : "";
        return `<div class="card record${open ? " open" : ""}"><h3 class="card-title">${esc(R.title.replace(" (regular season)", sel ? "" : " (regular season)"))}</h3><table><tbody>${trs}</tbody></table>${more}</div>`;
      }).join("");
      grid.querySelectorAll(".more-btn").forEach((b) => b.addEventListener("click", () => {
        showAllRecords[b.dataset.r] = !showAllRecords[b.dataset.r];
        const card = b.closest(".record");
        card.classList.toggle("open");
        b.textContent = card.classList.contains("open") ? "Show less" : `Show all ${card.querySelectorAll("tr").length}`;
      }));
    }

    // ---------- head-to-head ----------
    function renderH2H(sel) {
      const body = section("h2h", "Head-to-head", sel ? `${sel.season} only · row manager's record against each column manager` : "Row manager's record against each column manager");
      const controls = document.createElement("div");
      controls.style.cssText = "display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px";
      controls.innerHTML = `<div class="seg" role="group" aria-label="Games">${[["all", "All games"], ["reg", "Regular season"], ["po", "Playoffs"]]
        .map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${h2hMode === v}">${l}</button>`).join("")}</div>` +
        (sel ? "" : `<div class="seg" role="group" aria-label="Managers"><button type="button" data-c="1" aria-pressed="${onlyCurrent}">Current managers</button><button type="button" data-c="0" aria-pressed="${!onlyCurrent}">Everyone</button></div>`);
      body.appendChild(controls);
      controls.querySelectorAll("[data-v]").forEach((b) => b.addEventListener("click", () => { h2hMode = b.dataset.v; render(); location.hash = "h2h"; }));
      controls.querySelectorAll("[data-c]").forEach((b) => b.addEventListener("click", () => { onlyCurrent = b.dataset.c === "1"; render(); location.hash = "h2h"; }));
      // Tally from the game log so any season slice works: [w, l, t, pf, pa]
      const tally = {};
      rb.games.forEach((g) => {
        if (sel && g[0] !== sel.season) return;
        if (h2hMode === "reg" && g[2] !== "r") return;
        if (h2hMode === "po" && g[2] !== "p") return;
        [[g[3], g[4], g[5], g[6]], [g[4], g[3], g[6], g[5]]].forEach(([a, b, pa, pb]) => {
          const c = ((tally[a] = tally[a] || {})[b] = tally[a][b] || [0, 0, 0, 0, 0]);
          c[pa > pb ? 0 : pa < pb ? 1 : 2]++; c[3] += pa; c[4] += pb;
        });
      });
      const mgrs = (sel ? sel.standings.map((r) => r.manager) : rb.managers.map((m) => m.manager).filter((m) => !onlyCurrent || currentMgrs.has(m)))
        .sort((a, b) => name(a).localeCompare(name(b)));
      const f = FFL.filters.mgr;
      const head = mgrs.map((m) => `<th class="colh${f === m ? " hlc" : ""}" title="${esc(name(m))}">${FFL.avatar(mgrLogo[m], name(m), 24)}${esc(short(m))}</th>`).join("");
      const rowsHTML = mgrs.map((a) => {
        let tw = 0, tl = 0, tt = 0;
        const tds = mgrs.map((b) => {
          if (a === b) return `<td class="self"></td>`;
          const s = tally[a] && tally[a][b];
          if (!s) return `<td class="cell muted">–</td>`;
          tw += s[0]; tl += s[1]; tt += s[2];
          const p = (s[0] + 0.5 * s[2]) / (s[0] + s[1] + s[2]);
          const tip = `${name(a)} vs ${name(b)}: ${rec(s[0], s[1], s[2])} · points ${fmt(s[3], 1)}–${fmt(s[4], 1)}`;
          return `<td class="cell" style="${FFL.divBg(p - 0.5, 0.5)}" title="${esc(tip)}">${rec(s[0], s[1], s[2])}</td>`;
        }).join("");
        return `<tr class="${FFL.hlClass(a)}"><td>${whoM(a, null, 26)}</td>${tds}<td class="cell"><b>${rec(tw, tl, tt)}</b></td></tr>`;
      }).join("");
      const card = FFL.card(body, { flush: true, methods: "Purple cells are winning records, orange losing; the deeper the tint, the more lopsided. Hover or long-press a cell for points for and against." });
      card.innerHTML = `<div class="tbl-wrap"><table class="heat matrix sticky1"><thead><tr><th></th>${head}<th>Total</th></tr></thead><tbody>${rowsHTML}</tbody></table></div>`;
    }

    // ---------- draft steals & busts ----------
    function renderDraft(sel) {
      const dr = d.draft;
      if (!dr || !dr.seasons.length) return;
      const body = section("draft", sel ? `${sel.season} draft: steals and busts` : "Draft steals and busts",
        `${sel ? "" : `${dr.seasons[0]}–${dr.seasons[dr.seasons.length - 1]} · `}judged on points per game played vs. a typical pick at that spot`);
      if (sel && !dr.seasons.includes(sel.season)) {
        body.innerHTML = `<div class="card empty">ESPN doesn't provide player stats for the ${sel.season} draft. Draft analysis starts in ${dr.seasons[0]}.</div>`;
        return;
      }
      const picks = dr.picks.filter((p) => !sel || p.season === sel.season);
      const f = FFL.filters.mgr;
      const pickRow = (p) => `<tr class="${f ? (p.mgr === f ? "hl" : "") : ""}"><td style="width:40px;padding-right:0">${FFL.headshot({ id: p.id, n: p.n, pos: p.pos, pro: p.pro }, 32)}</td>
        <td><b style="font-weight:500">${esc(p.n || "Unknown")}</b> <span class="muted">${p.pos}</span>${p.keeper ? ' <span class="tag gold">Keeper</span>' : ""}
          <span class="sub2">${sel ? "" : p.season + " · "}Rd ${p.round}, pick ${p.pick} · ${FFL.mgrLink(p.mgr)}</span></td>
        <td class="n"><b>${fmt(p.ppg, 1)}</b><span class="sub2">vs ${fmt(p.exp, 1)} typical</span></td></tr>`;
      const list = (verdict, sign) => picks.filter((p) => p.verdict === verdict).sort((a, b) => sign * (b.z - a.z)).slice(0, 10);
      const steals = list("Steal", 1), busts = list("Bust", -1);
      const grid = document.createElement("div"); grid.className = "grid-2"; body.appendChild(grid);
      [["Biggest steals", steals], ["Biggest busts", busts]].forEach(([title, rows]) => {
        const c = FFL.card(grid, { flush: true });
        c.innerHTML = `<div style="padding:18px 18px 6px"><h3 class="card-title">${title}</h3></div>` +
          (rows.length ? `<table class="draft-list"><tbody>${rows.map(pickRow).join("")}</tbody></table>`
            : `<div class="empty">Nobody has played ${dr.min_games}+ games yet.</div>`);
      });

      // Draft grades: one season, or each manager's history
      const gradeBadge = (g) => g ? `<span class="grade g${g}">${g}</span>` : '<span class="muted">–</span>';
      const gCard = FFL.card(body, { flush: true, title: "", methods:
        `Each pick is compared with what players at the same position, drafted around the same spot, typically score per game in this league (${dr.seasons[0]} on). ` +
        `A pick needs <b>${dr.min_games}+ games played</b> to be judged: <b>Steal</b> or <b>Bust</b> means well above or below that bar for the position (about the top and bottom sixth). ` +
        "A player who missed more than half the possible games is marked <b>Missed time</b>, not a bust, so injuries aren't held against anyone. " +
        "<b>Points vs. average draft</b> adds up every pick's (points per game − typical) × games played, so missed games count as zero, not against you, then compares that with the league's average draft (0 = average). " +
        "<b>Grade</b> compares that per possible game with every completed draft in league history: A top 15%, B next 25%, C middle, D next 20%, F bottom 15%. Keepers are included." });
      gCard.parentNode.style.marginTop = "16px";
      if (sel) {
        const gs = dr.grades.filter((g) => g.season === sel.season);
        gCard.insertAdjacentHTML("beforebegin", `<div style="padding:18px 18px 4px"><h3 class="card-title">${sel.season} draft grades</h3>${gs.some((g) => !g.grade) ? `<div class="card-scope">Grades appear once ${dr.min_games} weeks have been played</div>` : ""}</div>`);
        FFL.table(gCard, [
          { key: "grade", label: "Grade", sort: (g) => g.rate, html: (g) => gradeBadge(g.grade) },
          { key: "mgr", label: "Manager", cls: "who-cell", asc: true, sort: (g) => name(g.mgr), html: (g) => whoM(g.mgr, null, 26) },
          { key: "poe", label: "Pts vs avg draft", num: true, html: (g) => `<span class="${FFL.cls(g.poe)}">${signed(g.poe, 1)}</span>` },
          { key: "steals", label: "Steals", num: true },
          { key: "busts", label: "Busts", num: true },
          { key: "missed", label: "Missed time", num: true },
          { key: "best", label: "Best pick", nosort: true, html: (g) => g.best ? `${esc(g.best.n)} <span class="muted">#${g.best.pick} · ${signed(g.best.value, 1)}</span>` : "–" },
          { key: "worst", label: "Worst pick", nosort: true, html: (g) => g.worst ? `${esc(g.worst.n)} <span class="muted">#${g.worst.pick} · ${signed(g.worst.value, 1)}</span>` : "–" },
        ], gs, { sortKey: "grade", rowClass: (g) => FFL.hlClass(g.mgr) });
      } else {
        const by = {};
        dr.grades.filter((g) => g.grade).forEach((g) => { (by[g.mgr] = by[g.mgr] || []).push(g); });
        const rows = Object.entries(by).map(([m, gs]) => {
          const avg = gs.reduce((a, g) => a + g.rate, 0) / gs.length;
          const counts = {}; gs.forEach((g) => (counts[g.grade] = (counts[g.grade] || 0) + 1));
          const bestPick = dr.picks.filter((p) => p.mgr === m && p.verdict === "Steal").sort((a, b) => b.z - a.z)[0];
          return { m, n: gs.length, avg, counts, steals: gs.reduce((a, g) => a + g.steals, 0), busts: gs.reduce((a, g) => a + g.busts, 0),
            history: gs.slice().sort((a, b) => a.season - b.season), bestPick };
        });
        gCard.insertAdjacentHTML("beforebegin", `<div style="padding:18px 18px 4px"><h3 class="card-title">Best drafters</h3><div class="card-scope">Pick a season at the top for that year's grades</div></div>`);
        FFL.table(gCard, [
          { key: "m", label: "Manager", cls: "who-cell", asc: true, sort: (r) => name(r.m), html: (r) => whoM(r.m, `${r.n} graded draft${r.n === 1 ? "" : "s"}`, 26) },
          { key: "avg", label: "vs avg draft, per week", num: true, html: (r) => `<span class="${FFL.cls(r.avg)}">${signed(r.avg, 2)}</span>` },
          { key: "history", label: "Grades by season", nosort: true, html: (r) => `<span class="grade-run">${r.history.map((g) => `<span title="${g.season}">${gradeBadge(g.grade)}</span>`).join("")}</span>` },
          { key: "steals", label: "Steals", num: true },
          { key: "busts", label: "Busts", num: true },
          { key: "best", label: "Best pick ever", nosort: true, html: (r) => r.bestPick ? `${esc(r.bestPick.n)} <span class="muted">${r.bestPick.season} · #${r.bestPick.pick}</span>` : "–" },
        ], rows, { sortKey: "avg", rowClass: (r) => FFL.hlClass(r.m) });
      }
    }

    // ---------- rivalries ----------
    function renderRivalries(sel) {
      const body = section("rivalries", "Rivalries", `All-time${sel ? " (not affected by the season filter)" : ""} · regular season and playoffs · minimum ${FFL.RIVAL_MIN_GAMES} meetings`);
      const streakTxt = (s) => s.streak ? `${s.streak.res === "W" ? "Won" : s.streak.res === "L" ? "Lost" : "Tied"} last ${s.streak.n}` : "";
      const row = (label, tone, s) => s ? `<div class="riv-row"><span class="riv-label ${tone}">${label}</span>
          ${FFL.avatar(mgrLogo[s.opp], name(s.opp), 26)}<div class="riv-who">${FFL.mgrLink(s.opp)}<span>${streakTxt(s)}</span></div>
          <span class="riv-rec">${rec(s.w, s.l, s.t)}</span></div>`
        : `<div class="riv-row"><span class="riv-label ${tone}">${label}</span><span class="muted" style="font-size:13px">None yet</span></div>`;
      const pool = sel ? new Set(sel.standings.map((r) => r.manager)) : currentMgrs;
      const mgrs = (FFL.filters.mgr ? [FFL.filters.mgr] : [...pool]).sort((a, b) => name(a).localeCompare(name(b)));
      const grid = document.createElement("div"); grid.className = "riv-grid"; body.appendChild(grid);
      grid.innerHTML = mgrs.map((m) => {
        const r = FFL.rivals(m);
        return `<div class="card card-pad riv-card">${whoM(m, null, 36)}<div class="riv-rows">${row("Nemesis", "bad", r.nemesis)}${row("Favorite victim", "good", r.victim)}${row("Arch-rival", "accent", r.arch)}</div></div>`;
      }).join("");

      // League's best rivalries: lots of meetings, close series (playoff games count double)
      const all = rb.managers.map((m) => m.manager);
      const pairs = [];
      all.forEach((a, i) => all.slice(i + 1).forEach((b) => {
        const s = FFL.series(a, b);
        if (s.games < 6) return;
        pairs.push({ a, b, s, heat: (s.games + s.po.length) * (1 - Math.abs(s.pct - 0.5) * 2) });
      }));
      pairs.sort((x, y) => y.heat - x.heat);
      const top = pairs.filter((p) => !FFL.filters.mgr || p.a === FFL.filters.mgr || p.b === FFL.filters.mgr).slice(0, 10);
      const card = FFL.card(body, { flush: true, title: "", methods:
        `<b>Nemesis</b> is the opponent a manager has the worst record against, <b>Favorite victim</b> the best (each needs ${FFL.RIVAL_MIN_GAMES}+ meetings and a losing or winning record). ` +
        "<b>Arch-rival</b> and this table rank pairs by how often they've met (playoff meetings count double) and how close the series is." });
      card.parentNode.style.marginTop = "16px";
      card.insertAdjacentHTML("beforebegin", `<div style="padding:18px 18px 4px"><h3 class="card-title">Best rivalries in the league</h3></div>`);
      FFL.table(card, [
        { key: "pair", label: "Rivalry", cls: "who-cell", nosort: true, html: (p) => `<div style="display:flex;align-items:center;gap:8px;white-space:nowrap">${FFL.avatar(mgrLogo[p.a], name(p.a), 24)}${FFL.mgrLink(p.a, short(p.a))} <span class="muted">vs</span> ${FFL.avatar(mgrLogo[p.b], name(p.b), 24)}${FFL.mgrLink(p.b, short(p.b))}</div>` },
        { key: "games", label: "Meetings", num: true, sort: (p) => p.s.games, html: (p) => p.s.games },
        { key: "series", label: "Series", num: true, nosort: true, html: (p) => p.s.w === p.s.l ? `Tied ${rec(p.s.w, p.s.l, p.s.t)}` : `${esc(short(p.s.w > p.s.l ? p.a : p.b))} ${p.s.w > p.s.l ? rec(p.s.w, p.s.l, p.s.t) : rec(p.s.l, p.s.w, p.s.t)}` },
        { key: "po", label: "Playoff meetings", num: true, sort: (p) => p.s.po.length, html: (p) => p.s.po.length || '<span class="muted">0</span>' },
        { key: "streak", label: "Streak", num: true, nosort: true, html: (p) => p.s.streak ? `${esc(short(p.s.streak.res === "W" ? p.a : p.b))} ${p.s.streak.n}` : "" },
        { key: "last", label: "Last meeting", num: true, nosort: true, html: (p) => { const l = p.s.last; return `${l.season} Wk ${l.week} · ${esc(short(l.res === "W" ? p.a : p.b))} ${fmt(Math.max(l.me, l.them), 1)}–${fmt(Math.min(l.me, l.them), 1)}`; } },
      ], top, { nosort: true });
    }

    // ---------- finish history ----------
    function renderFinishes(sel) {
      const body = section("finishes", "Finish history", "Final placement each season · gold is a title");
      const mgrs = rb.managers.slice().sort((a, b) => (a.avg_finish || 99) - (b.avg_finish || 99));
      const yrs = seasons.map((s) => s.season);
      const on = (y) => sel && sel.season === y ? " selcol" : "";
      const card = FFL.card(body, { flush: true, methods: "Shaded by placement: purple toward the top of the league, orange toward the bottom. Seasons in progress show the current seed in parentheses." });
      card.innerHTML = `<div class="tbl-wrap"><table class="heat finish sticky1"><thead><tr><th>Manager</th>${yrs.map((y) => `<th class="${on(y)}">${y}</th>`).join("")}<th>Avg</th></tr></thead><tbody>` +
        mgrs.map((m) => {
          const fh = rb.finishes[m.manager] || {};
          return `<tr class="${FFL.hlClass(m.manager)}"><td>${whoM(m.manager, null, 26)}</td>` + yrs.map((y) => {
            const x = fh[y];
            if (!x) return `<td class="${on(y)}"></td>`;
            const tip = `${y}: ${x.team} (${x.record})${x.rank ? ", finished " + FFL.ordinal(x.rank) : ", seed " + x.seed}`;
            if (!x.rank) return `<td class="cell muted${on(y)}" title="${esc(tip)}">(${x.seed})</td>`;
            const t = 0.5 - (x.rank - 1) / Math.max(1, x.teams - 1);
            return `<td class="cell${x.rank === 1 ? " f1" : ""}${on(y)}" style="${x.rank === 1 ? "" : FFL.divBg(t, 0.5)}" title="${esc(tip)}">${x.rank === 1 ? "★" : x.rank}</td>`;
          }).join("") + `<td class="cell"><b>${fmt(m.avg_finish, 1)}</b></td></tr>`;
        }).join("") + `</tbody></table></div>`;
    }

    // ---------- season standings ----------
    function renderStandings(sel) {
      const body = section("standings", sel ? `${sel.season} standings` : "Season standings", "");
      const s = sel || seasons.find((x) => String(x.season) === seasonPick) || lastSeason;
      if (!sel) {
        const controls = document.createElement("div");
        controls.style.cssText = "margin-bottom:12px";
        controls.innerHTML = `<div class="seg" role="group" aria-label="Season">${seasons.slice().reverse().map((x) =>
          `<button type="button" data-s="${x.season}" aria-pressed="${String(x.season) === String(s.season)}">${x.season}${x.complete ? "" : '<span class="dot"></span>'}</button>`).join("")}</div>`;
        body.appendChild(controls);
        controls.querySelectorAll("[data-s]").forEach((b) => b.addEventListener("click", () => { seasonPick = b.dataset.s; render(); location.hash = "standings"; }));
        const notes = [`${s.teams} teams`, `${s.regular_season_weeks}-week regular season`, `${s.playoff_teams}-team playoff`];
        if (s.median_bonus) notes.push("top-half bonus win each week");
        body.closest("section").querySelector(".section-head").insertAdjacentHTML("beforeend", `<div class="scope">${s.season} · ${notes.join(" · ")}</div>`);
      }
      const card = FFL.card(body, { flush: true, methods: s.lineup_weeks === 0 ? "Regret isn't available this season: ESPN's lineup data for it doesn't add up to the real scores." : "" });
      FFL.table(card, [
        { key: "final_rank", label: s.complete ? "Finish" : "Seed", num: true, asc: true, sort: (r) => r.final_rank || r.seed,
          html: (r) => r.final_rank === 1 ? '<span class="star">★</span> 1' : (r.final_rank || r.seed) },
        { key: "manager", label: "Manager", cls: "who-cell", asc: true, sort: (r) => name(r.manager), html: (r) => FFL.who(r.manager, r.team, r.logo, 30) },
        { key: "seed", label: "Seed", num: true, asc: true },
        { key: "w", label: "Record", num: true, sort: (r) => r.w + 0.5 * r.t, html: (r) => rec(r.w, r.l, r.t) },
        { key: "h2h", label: "H2H", num: true, sort: (r) => r.h2h[0], html: (r) => rec(...r.h2h) },
        { key: "pf", label: "PF", num: true, html: (r) => fmt(r.pf) },
        { key: "pa", label: "PA", num: true, html: (r) => fmt(r.pa) },
        { key: "all_play_pct", label: "All-play", num: true, html: (r) => `${rec(...r.all_play)} <span class="muted">${pct(r.all_play_pct)}</span>` },
        { key: "luck", label: "Luck", num: true, html: (r) => `<span class="${FFL.cls(r.luck)}">${signed(r.luck, 1)}</span>` },
        { key: "playoff", label: "Playoffs", num: true, sort: (r) => r.playoff[0], html: (r) => r.playoff[0] + r.playoff[1] ? rec(...r.playoff) : '<span class="muted">–</span>' },
        { key: "regret", label: "Regret", num: true, asc: true, html: (r) => fmt(r.regret, 1) },
        { key: "moves", label: "Moves", num: true },
        { key: "trades", label: "Trades", num: true },
      ], s.standings, { sortKey: "final_rank", desc: false, rowClass: (r) => FFL.hlClass(r.manager) });
    }

    FFL.onFilter(render);
    render();
  });
})();
