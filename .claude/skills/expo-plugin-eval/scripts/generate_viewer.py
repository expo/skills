#!/usr/bin/env python3
"""Generate the self-contained HTML viewer for an expo-plugin-eval run.

Usage: generate_viewer.py <workspace-root> [--artifact]
  <workspace-root>  Run root, e.g. /private/tmp/expo-plugin-eval-recipe-app.
                    Iteration dirs (iteration-*) live under it; viewer.html is
                    written there and opened in the browser.
  --artifact        Emit viewer_artifact.html (page-content only, no
                    <!DOCTYPE>/<html>/<head>/<body>) for the Artifact tool, and
                    do NOT open a browser.

Unlike the single-skill viewer, this renders the WHOLE-PLUGIN eval: per config
(with_plugin / optionally without_plugin) it shows a per-route screenshot
gallery (one row per route, a screenshot per platform) plus a skill/MCP usage
panel parsed from the executor stream. Reads per eval:
  eval-<id>/<config>/{grading.json,static.json,skill_usage.json,routes.json,
                      outputs/<platform>/<slug>.png}
Screenshots are embedded as base64 data: URIs so the file is self-contained.
"""

import base64
import html
import json
import sys
import webbrowser
from pathlib import Path

CONFIG_ORDER = ["with_plugin", "without_plugin"]
CONFIG_LABEL = {"with_plugin": "With Plugin", "without_plugin": "Without Plugin"}


def esc(value):
    """HTML-escape an untrusted string before interpolating it into element text.

    Route labels/paths, grading evidence/summaries, skill and MCP tool names,
    and the eval prompt all come from model-generated JSON (routes.json,
    grading.json, skill_usage.json, evals.json), so they must be escaped to
    keep injected markup inert in the local viewer and any published Artifact.
    """
    return html.escape("" if value is None else str(value))


def b64_img(path):
    if not path:
        return None
    p = Path(path)
    if not p.exists() or not p.is_file():
        return None
    with open(p, "rb") as f:
        data = base64.b64encode(f.read()).decode()
    ext = p.suffix.lower().lstrip(".")
    mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg"}.get(ext, "image/png")
    return f"data:{mime};base64,{data}"


def score_color(score, max_score):
    if not max_score:
        return "#888"
    pct = score / max_score
    if pct >= 0.85:
        return "#4ade80"
    elif pct >= 0.65:
        return "#fbbf24"
    return "#f87171"


def load_json(path, default=None):
    p = Path(path)
    if not p.exists():
        return default
    try:
        with open(p) as f:
            return json.load(f)
    except Exception:
        return default


def route_slug(path):
    r = (path or "/").lstrip("/").replace("/", "-").rstrip("-")
    return r or "index"


def routes_for(cfg_dir, eval_case):
    """Routes captured for a config: executor manifest first, then the eval
    case hint, then root-only."""
    manifest = load_json(cfg_dir / "routes.json")
    if isinstance(manifest, dict):
        manifest = manifest.get("routes")
    if isinstance(manifest, list) and manifest:
        return manifest
    if eval_case.get("routes"):
        return eval_case["routes"]
    return [{"path": "/", "label": "Home"}]


def render_expectations(expectations):
    if not expectations:
        return ""
    html = '<ul class="exp-list">'
    for exp in expectations:
        if isinstance(exp, dict):
            passed = exp.get("passed", None)
            text = exp.get("text", str(exp))
            evidence = exp.get("evidence", "")
            if passed is True:
                badge = '<span class="badge pass">PASS</span>'
            elif passed is False:
                badge = '<span class="badge fail">FAIL</span>'
            else:
                badge = '<span class="badge unknown">?</span>'
            ev_html = f'<div class="evidence">{esc(evidence)}</div>' if evidence else ""
            html += f'<li>{badge} {esc(text)}{ev_html}</li>'
        else:
            html += f'<li><span class="badge unknown">?</span> {esc(exp)}</li>'
    html += "</ul>"
    return html


def render_quality(quality):
    if not quality:
        return ""
    dims = quality.get("dimensions", [])
    subtotal = quality.get("subtotal", 0)
    max_total = quality.get("max", 0)
    summary = quality.get("summary", "")
    html = '<div class="quality-block">'
    html += f'<div class="quality-header">Design Quality: <b>{subtotal}/{max_total}</b></div>'
    for d in dims:
        name = d.get("name", "")
        score = d.get("score", 0)
        mx = d.get("max", 3)
        evidence = d.get("evidence", "")
        pct = (score / mx * 100) if mx else 0
        color = score_color(score, mx)
        html += f'''<div class="quality-dim">
  <div class="dim-label">{esc(name)} <span style="color:{color}">{score}/{mx}</span></div>
  <div class="dim-bar-wrap"><div class="dim-bar" style="width:{pct:.0f}%;background:{color}"></div></div>
  {f'<div class="dim-evidence">{esc(evidence)}</div>' if evidence else ""}
</div>'''
    if summary:
        html += f'<div class="quality-summary">{esc(summary)}</div>'
    html += "</div>"
    return html


def render_usage(usage, expected_skills):
    """Skill/MCP usage panel from skill_usage.json."""
    if not usage and not expected_skills:
        return ""
    skills = usage.get("skills", []) if usage else []
    mcp_tools = usage.get("mcp_tools", []) if usage else []
    mcp_available = usage.get("mcp_available") if usage else None
    forced = usage.get("forced") if usage else False

    html = '<div class="usage-block">'

    # MCP availability
    if mcp_available is True:
        html += '<div class="usage-row"><span class="usage-key">MCP</span><span class="badge pass">reachable</span></div>'
    elif mcp_available is False:
        html += '<div class="usage-row"><span class="usage-key">MCP</span><span class="badge fail">unavailable</span></div>'

    # Skills used (mark expected coverage). When forced, the skills reflect an
    # instructed invocation, not natural recall — label the row so it isn't misread.
    expected = set(expected_skills or [])
    used = set(skills)
    skills_key = "Skills (forced)" if forced else "Skills"
    if skills or expected:
        html += f'<div class="usage-row"><span class="usage-key">{skills_key}</span><span class="chips">'
        for s in sorted(used | expected):
            short = s.split(":")[-1]
            cls = "chip used" if s in used or short in {u.split(":")[-1] for u in used} else "chip miss"
            mark = "" if cls == "chip used" else " (not used)"
            html += f'<span class="{cls}">{esc(short)}{mark}</span>'
        if not (used | expected):
            html += '<span class="chip none">none</span>'
        html += '</span></div>'

    # MCP tools called
    if mcp_tools:
        html += '<div class="usage-row"><span class="usage-key">MCP tools</span><span class="chips">'
        for t in sorted(set(mcp_tools)):
            html += f'<span class="chip mcp">{esc(t.split("__")[-1])}</span>'
        html += '</span></div>'

    html += '</div>'
    return html


def render_route_gallery(cfg_dir, eval_case, routes):
    platforms = eval_case.get("runtime", {}).get("platforms", ["ios"])
    html = '<div class="route-gallery">'
    for r in routes:
        path = r.get("path", "/")
        label = r.get("label", path)
        slug = route_slug(path)
        html += '<div class="route-row">'
        html += f'<div class="route-label">{esc(label)} <span class="route-path">{esc(path)}</span></div>'
        html += '<div class="route-shots">'
        for plat in platforms:
            img = b64_img(cfg_dir / "outputs" / plat / f"{slug}.png")
            if img:
                html += (
                    f'<div class="shot"><div class="plat-label">{plat}</div>'
                    f'<img src="{img}" class="screenshot" onclick="this.classList.toggle(\'zoomed\')" /></div>'
                )
            else:
                html += (
                    f'<div class="shot"><div class="plat-label">{plat}</div>'
                    f'<div class="no-screenshot">no shot</div></div>'
                )
        html += '</div></div>'
    html += '</div>'
    return html


def render_config_card(iter_dir, eval_id, config, eval_case):
    cfg_dir = iter_dir / f"eval-{eval_id}" / config
    grading = load_json(cfg_dir / "grading.json")
    static_result = load_json(cfg_dir / "static.json")
    usage = load_json(cfg_dir / "skill_usage.json")
    routes = routes_for(cfg_dir, eval_case)

    static_pass = static_result and static_result.get("exit_code") == 0
    static_badge = '<span class="badge pass">BUILD OK</span>' if static_pass else '<span class="badge fail">BUILD FAIL</span>'

    score = grading.get("score") if grading else None
    max_score = grading.get("max_score", 1) if grading else 1
    score_html = ""
    if score is not None:
        score_html = f'<div class="score" style="color:{score_color(score, max_score)}">{score}/{max_score}</div>'

    klass = "with" if config == "with_plugin" else "without"
    html = f'<div class="config-card {klass}">'
    html += (
        f'<div class="config-header"><span class="config-label {klass}">'
        f'{CONFIG_LABEL.get(config, config)}</span>{static_badge}{score_html}</div>'
    )
    html += render_usage(usage, eval_case.get("expected_skills", []))
    html += render_route_gallery(cfg_dir, eval_case, routes)

    if grading:
        html += render_expectations(grading.get("expectations", []))
        ref_match = grading.get("reference_match")
        if ref_match:
            rm_score = ref_match.get("score", 0)
            rm_max = ref_match.get("max", 10)
            html += (
                f'<div class="ref-match"><b>Reference Match:</b> '
                f'<span style="color:{score_color(rm_score, rm_max)}">{rm_score}/{rm_max}</span>'
            )
            if ref_match.get("evidence"):
                html += f'<div class="evidence">{esc(ref_match["evidence"])}</div>'
            html += '</div>'
        html += render_quality(grading.get("quality"))
        notes = grading.get("user_notes_summary", {})
        if notes and notes.get("notes"):
            html += f'<div class="reviewer-notes"><b>Notes:</b> {esc(notes["notes"])}</div>'

    html += '</div>'
    return html


def present_configs(iter_dir, eval_id):
    present = []
    for cfg in CONFIG_ORDER:
        if (iter_dir / f"eval-{eval_id}" / cfg).is_dir():
            present.append(cfg)
    return present or ["with_plugin"]


def render_iteration(iter_dir):
    evals = load_json(iter_dir / "evals.json")
    if not evals:
        return f"<p>No evals.json found in {iter_dir}</p>"

    totals = {c: [0, 0] for c in CONFIG_ORDER}  # [scored, max]
    body = ""
    total_evals = 0

    for ev in evals:
        eid = ev["id"]
        total_evals += 1
        configs = present_configs(iter_dir, eid)

        for cfg in configs:
            g = load_json(iter_dir / f"eval-{eid}" / cfg / "grading.json")
            if g and g.get("max_score"):
                totals[cfg][0] += g.get("score", 0)
                totals[cfg][1] += g.get("max_score", 0)

        ref_img = b64_img(ev.get("reference_image", ""))
        body += '<div class="eval-case">'
        body += f'<div class="eval-header">Eval #{eid}</div>'
        body += f'<div class="eval-prompt">{esc(ev.get("prompt", "")[:400])}</div>'
        if ref_img:
            body += '<div class="ref-image-wrap"><div class="ref-label">Target Reference</div>'
            body += f'<img src="{ref_img}" class="ref-image" onclick="this.classList.toggle(\'zoomed\')" /></div>'

        cols = "1fr 1fr" if len(configs) > 1 else "1fr"
        body += f'<div class="configs-row" style="grid-template-columns:{cols}">'
        for cfg in configs:
            body += render_config_card(iter_dir, eid, cfg, ev)
        body += '</div></div>'

    # Summary
    items = ""
    pcts = {}
    for cfg in CONFIG_ORDER:
        scored, mx = totals[cfg]
        if mx:
            pct = scored / mx * 100
            pcts[cfg] = pct
            items += (
                f'<div class="summary-item">{CONFIG_LABEL[cfg]}: '
                f'<span style="color:{score_color(scored, mx)}">{pct:.0f}%</span></div>'
            )
    if "with_plugin" in pcts and "without_plugin" in pcts:
        delta = pcts["with_plugin"] - pcts["without_plugin"]
        dcolor = "#4ade80" if delta > 0 else "#f87171" if delta < 0 else "#888"
        items += f'<div class="summary-item">Delta: <span style="color:{dcolor}">{delta:+.0f}pp</span></div>'
    items += f'<div class="summary-item">Evals: {total_evals}</div>'
    summary = f'<div class="summary-bar">{items}</div>'

    return summary + body


CSS = """\
:root {
  --ground:#090C14; --surface:#0E1320; --surface-hi:#131929; --border:#1A2238;
  --text:#D9E2F5; --text-muted:#6B7A9E; --text-dim:#3A4560; --accent:#7B6FD3;
  --accent-glow:rgba(123,111,211,0.12); --pass:#4DB87C; --pass-bg:rgba(77,184,124,0.10);
  --fail:#E05555; --fail-bg:rgba(224,85,85,0.10); --score-with:#9B8EE8; --score-without:#5A6480;
  --mcp:#5FB8D6;
}
* { box-sizing:border-box; margin:0; padding:0; }
body { background:var(--ground); color:var(--text); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; font-size:14px; line-height:1.5; padding:20px 24px; }
h1 { font-size:15px; font-weight:500; letter-spacing:0.06em; text-transform:uppercase; color:var(--text-muted); margin-bottom:20px; }

.tabs { display:flex; gap:6px; margin-bottom:20px; }
.tab { background:var(--surface); border:1px solid var(--border); color:var(--text-muted); padding:5px 14px; border-radius:5px; cursor:pointer; font-size:12px; font-weight:500; }
.tab:hover { color:var(--text); border-color:#2A3558; }
.tab.active { background:var(--surface-hi); border-color:var(--accent); color:var(--text); }

.summary-bar { display:flex; gap:0; background:var(--surface); border:1px solid var(--border); border-radius:8px; overflow:hidden; margin-bottom:20px; }
.summary-item { flex:1; padding:12px 16px; border-right:1px solid var(--border); font-size:11px; letter-spacing:0.04em; text-transform:uppercase; color:var(--text-muted); }
.summary-item:last-child { border-right:none; }
.summary-item span { display:block; font-size:22px; font-weight:700; font-variant-numeric:tabular-nums; letter-spacing:-0.02em; color:var(--text); margin-top:2px; }

.eval-case { background:var(--surface); border:1px solid var(--border); border-radius:10px; margin-bottom:24px; overflow:hidden; }
.eval-header { padding:10px 16px; font-size:11px; font-weight:600; letter-spacing:0.07em; text-transform:uppercase; color:var(--text-muted); border-bottom:1px solid var(--border); }
.eval-prompt { padding:12px 16px; font-size:13px; color:var(--text); border-bottom:1px solid var(--border); line-height:1.55; }

.ref-image-wrap { padding:16px; background:#07090F; border-bottom:1px solid var(--border); }
.ref-label { font-size:10px; font-weight:600; letter-spacing:0.09em; text-transform:uppercase; color:var(--text-dim); margin-bottom:8px; }
.ref-image { max-height:260px; width:auto; border-radius:10px; border:1px solid #1E2840; cursor:zoom-in; display:block; }
.ref-image.zoomed { max-height:none; cursor:zoom-out; }

.configs-row { display:grid; }
.config-card { padding:16px; border-right:1px solid var(--border); position:relative; }
.config-card:last-child { border-right:none; }
.config-card.with::before { content:""; position:absolute; top:0; left:0; right:0; height:180px; background:radial-gradient(ellipse 80% 120px at 50% 0,var(--accent-glow),transparent 70%); pointer-events:none; }
.config-header { display:flex; align-items:center; gap:8px; margin-bottom:14px; flex-wrap:wrap; }
.config-label { font-size:10px; font-weight:700; letter-spacing:0.07em; text-transform:uppercase; padding:3px 8px; border-radius:4px; }
.config-label.with { background:rgba(123,111,211,0.15); color:var(--accent); border:1px solid rgba(123,111,211,0.25); }
.config-label.without { background:var(--surface-hi); color:var(--text-muted); border:1px solid var(--border); }
.score { font-size:22px; font-weight:700; font-variant-numeric:tabular-nums; margin-left:auto; }
.config-card.with .score { color:var(--score-with); }
.config-card.without .score { color:var(--score-without); }

.badge { display:inline-flex; align-items:center; font-size:9px; font-weight:700; padding:2px 7px; border-radius:3px; letter-spacing:0.05em; text-transform:uppercase; }
.badge.pass { background:var(--pass-bg); color:var(--pass); border:1px solid rgba(77,184,124,0.2); }
.badge.fail { background:var(--fail-bg); color:var(--fail); border:1px solid rgba(224,85,85,0.2); }
.badge.unknown { background:var(--surface-hi); color:var(--text-dim); border:1px solid var(--border); }

/* Usage panel */
.usage-block { background:var(--surface-hi); border:1px solid var(--border); border-radius:6px; padding:10px 12px; margin-bottom:14px; }
.usage-row { display:flex; gap:8px; align-items:flex-start; padding:4px 0; }
.usage-key { font-size:10px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:var(--text-dim); min-width:74px; padding-top:2px; }
.chips { display:flex; flex-wrap:wrap; gap:5px; }
.chip { font-size:10px; padding:2px 8px; border-radius:10px; border:1px solid var(--border); }
.chip.used { background:rgba(123,111,211,0.15); color:var(--accent); border-color:rgba(123,111,211,0.3); }
.chip.miss { background:var(--fail-bg); color:var(--fail); border-color:rgba(224,85,85,0.2); }
.chip.mcp { background:rgba(95,184,214,0.12); color:var(--mcp); border-color:rgba(95,184,214,0.25); }
.chip.none { color:var(--text-dim); }

/* Route gallery */
.route-gallery { display:flex; flex-direction:column; gap:14px; }
.route-row { border:1px solid var(--border); border-radius:8px; padding:10px; background:#0B0F1A; }
.route-label { font-size:12px; font-weight:600; color:var(--text); margin-bottom:8px; }
.route-path { font-size:10px; font-weight:500; color:var(--text-dim); font-family:ui-monospace,monospace; margin-left:6px; }
.route-shots { display:flex; flex-wrap:wrap; gap:10px; }
.shot { display:flex; flex-direction:column; gap:4px; }
.plat-label { font-size:9px; font-weight:600; letter-spacing:0.09em; text-transform:uppercase; color:var(--text-dim); }
.screenshot { max-width:100%; max-height:320px; width:auto; border-radius:12px; border:1px solid #1A2540; cursor:zoom-in; display:block; box-shadow:0 4px 24px rgba(0,0,0,0.5); }
.screenshot.zoomed { max-height:none; cursor:zoom-out; }
.no-screenshot { color:var(--text-dim); font-size:11px; padding:16px; background:var(--surface-hi); border-radius:6px; text-align:center; border:1px dashed var(--border); }

.exp-list { list-style:none; margin-top:12px; }
.exp-list li { padding:6px 0; border-bottom:1px solid var(--border); font-size:12px; color:var(--text-muted); display:flex; flex-wrap:wrap; gap:6px; align-items:flex-start; }
.exp-list li:last-child { border-bottom:none; }
.evidence { font-size:10px; color:var(--text-dim); width:100%; line-height:1.5; margin-top:2px; }

.ref-match { margin-top:12px; font-size:12px; color:var(--text-muted); background:var(--surface-hi); padding:10px 12px; border-radius:6px; border-left:2px solid var(--accent); }
.ref-match b { color:var(--text); }
.quality-block { margin-top:12px; background:var(--surface-hi); border:1px solid var(--border); border-radius:6px; padding:12px; }
.quality-header { font-size:11px; font-weight:600; letter-spacing:0.05em; text-transform:uppercase; color:var(--text-muted); margin-bottom:10px; }
.quality-dim { margin-bottom:10px; }
.dim-label { font-size:10px; color:var(--text-muted); margin-bottom:4px; display:flex; justify-content:space-between; }
.dim-bar-wrap { height:3px; background:var(--border); border-radius:2px; overflow:hidden; }
.dim-bar { height:100%; border-radius:2px; }
.dim-evidence { font-size:10px; color:var(--text-dim); margin-top:3px; line-height:1.45; }
.quality-summary { font-size:11px; color:var(--text-dim); margin-top:8px; padding-top:8px; border-top:1px solid var(--border); }
.reviewer-notes { margin-top:10px; font-size:11px; color:var(--text-dim); background:var(--ground); padding:8px 10px; border-radius:4px; }
"""

JS = """\
function showTab(i) {
  var panels = document.querySelectorAll('.panel');
  var tabs = document.querySelectorAll('.tab');
  panels.forEach(function(p, idx) { p.style.display = idx === i ? 'block' : 'none'; });
  tabs.forEach(function(t, idx) { t.classList.toggle('active', idx === i); });
  try { localStorage.setItem('expo-plugin-eval-tab', i); } catch(e) {}
}
(function() {
  var panels = document.querySelectorAll('.panel');
  try {
    var saved = parseInt(localStorage.getItem('expo-plugin-eval-tab') || '0', 10);
    if (saved > 0 && saved < panels.length) showTab(saved);
  } catch(e) {}
})();
"""


def build_page(ws, title, artifact=False):
    iterations = sorted(p for p in ws.glob("iteration-*") if p.is_dir())
    if not iterations:
        return f"<p>No iteration directories found under {ws}.</p>"

    tabs_html = ""
    panels_html = ""
    for i, it in enumerate(iterations):
        active = "active" if i == 0 else ""
        tabs_html += f'<button class="tab {active}" onclick="showTab({i})" id="tab-{i}">{esc(it.name)}</button>'
        panels_html += f'<div class="panel" id="panel-{i}" style="display:{"block" if i == 0 else "none"}">{render_iteration(it)}</div>'

    safe_title = esc(title)
    body = f'<h1>{safe_title}</h1>\n<div class="tabs">{tabs_html}</div>\n{panels_html}'
    if artifact:
        return f'<title>{safe_title}</title>\n<style>\n{CSS}</style>\n{body}\n<script>\n{JS}</script>'
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{safe_title}</title>
<style>
{CSS}
</style>
</head>
<body>
{body}
<script>
{JS}
</script>
</body>
</html>'''


def main():
    args = [a for a in sys.argv[1:] if a != "--artifact"]
    artifact = "--artifact" in sys.argv
    if not args:
        print("usage: generate_viewer.py <workspace-root> [--artifact]", file=sys.stderr)
        sys.exit(1)

    ws = Path(args[0]).resolve()
    name = ws.name.replace("expo-plugin-eval-", "")
    title = f"{name} — Expo Plugin Eval"
    html = build_page(ws, title, artifact=artifact)

    if artifact:
        out = ws / "viewer_artifact.html"
        out.write_text(html)
        print(f"Artifact viewer written: {out}")
    else:
        out = ws / "viewer.html"
        out.write_text(html)
        print(f"Viewer written: {out}")
        webbrowser.open("file://" + str(out))


if __name__ == "__main__":
    main()
