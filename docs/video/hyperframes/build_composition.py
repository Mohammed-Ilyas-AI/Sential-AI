"""Writes the HyperFrames composition for the SENTINEL AI demo from scenes.json and the narration WAVs."""
import json
import struct
from pathlib import Path

HERE = Path(__file__).parent
PROJECT = HERE
SCENES = json.loads(Path(r"D:\singapore\Sential AI\docs\video\scenes.json").read_text(encoding="utf-8"))
PAD_BEFORE = 0.45  # silence before the voice starts in each scene
PAD_AFTER = 0.75


def wav_seconds(path: Path) -> float:
    data = path.read_bytes()
    byte_rate = struct.unpack("<I", data[28:32])[0]
    return (len(data) - 44) / byte_rate


# Per scene: the frame(s) on screen, where to zoom, and which UI elements to outline (pixel boxes on 1920x1080).
VISUALS = {
    "02-control-tower": [{"frame": "02-control-tower", "focus": (1250, 250, 1890, 560), "zoom": 1.45, "at": 0.45,
                          "boxes": [(1552, 312, 1735, 378)]}],
    "03-live-transactions": [{"frame": "03-live-transactions", "focus": (290, 250, 1530, 520), "zoom": 1.25, "at": 0.4,
                              "boxes": [(291, 279, 1527, 329)]}],
    "04-hold": [{"frame": "04-hold", "focus": (1545, 165, 1900, 660), "zoom": 1.85, "at": 0.3,
                 "boxes": [(1574, 396, 1880, 520), (1572, 532, 1882, 606)]}],
    "05-investigation": [{"frame": "05-investigation", "focus": (275, 270, 790, 700), "zoom": 1.75, "at": 0.3,
                          "boxes": [(283, 338, 784, 660)]}],
    "06-gemini": [{"frame": "06-gemini", "focus": (585, 130, 1340, 950), "zoom": 1.22, "at": 0.25,
                   "boxes": [(604, 430, 1316, 882), (604, 900, 1320, 940)]}],
    "07-network": [{"frame": "07-network", "focus": (780, 280, 1560, 780), "zoom": 1.55, "at": 0.35,
                    "boxes": [(1190, 292, 1552, 344), (1125, 700, 1490, 760)]}],
    "08-intervene": [{"frame": "08-intervene", "focus": (1490, 460, 1890, 940), "zoom": 1.9, "at": 0.3,
                      "boxes": [(1500, 560, 1880, 668), (1500, 694, 1880, 910)]}],
    "09-case-report": [{"frame": "09-case-report", "focus": (630, 190, 1890, 760), "zoom": 1.38, "at": 0.35,
                        "boxes": [(641, 314, 1275, 342)]}],
    "10-lens-audit": [
        {"frame": "10-audit", "focus": (282, 320, 1530, 700), "zoom": 1.3, "at": 0.25, "until": 0.5,
         "boxes": [(284, 350, 1520, 496), (284, 604, 1520, 680)]},
        {"frame": "10-lens", "focus": (1505, 0, 1915, 215), "zoom": 2.2, "at": 0.0, "from": 0.5,
         "boxes": [(1522, 30, 1898, 72)]},
    ],
}


def transform_for(focus, zoom):
    x0, y0, x1, y1 = focus
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    tx = min(0.0, max(1920 - 1920 * zoom, 960 - cx * zoom))
    ty = min(0.0, max(1080 - 1080 * zoom, 470 - cy * zoom))
    return round(tx, 1), round(ty, 1)


html_scenes, tweens = [], []
t = 0.0
number = 0
app_scenes = [s for s in SCENES if s["id"] not in ("01-title", "11-close")]
for scene in SCENES:
    sid = scene["id"]
    voice = wav_seconds(PROJECT / "assets" / "audio" / f"{sid}.wav")
    duration = round(PAD_BEFORE + voice + PAD_AFTER, 2)
    start = round(t, 2)
    el = f"sc-{sid}"
    audio = (f'<audio id="vo-{sid}" class="clip" src="assets/audio/{sid}.wav" data-start="{round(start + PAD_BEFORE, 2)}" '
             f'data-duration="{round(voice, 2)}" data-volume="1"></audio>')
    tweens.append(f'tl.fromTo("#{el}", {{opacity: 0}}, {{opacity: 1, duration: 0.5, ease: "power1.out"}}, {start});')
    tweens.append(f'tl.to("#{el}", {{opacity: 0, duration: 0.45, ease: "power1.in"}}, {round(start + duration - 0.45, 2)});')

    if sid == "01-title":
        html_scenes.append(f"""
    <section id="{el}" class="clip scene card" data-start="{start}" data-duration="{duration}">
      <div class="card-bg"></div><div class="card-veil"></div>
      <div class="card-content">
        <img class="card-logo" src="assets/brand/sentinel-logo.webp" alt="SENTINEL AI" />
        <div class="kicker">AI Builder Cup 2026 · BFSI</div>
        <h1 class="card-title"><span class="w">Real-time</span> <span class="w">fraud</span> <span class="w">operations</span><br /><span class="w grad">control</span> <span class="w grad">tower</span></h1>
        <p class="card-line">Rules decide. AI explains. Humans authorize.</p>
        <div class="chips"><span class="chip">Pre-transaction decision API</span><span class="chip">Gemini on Vertex AI</span><span class="chip">Synthetic data</span></div>
      </div>
      {audio}
    </section>""")
        tweens += [
            f'tl.fromTo("#{el} .card-bg", {{scale: 1.18}}, {{scale: 1.02, duration: {duration}, ease: "none"}}, {start});',
            f'tl.fromTo("#{el} .card-logo", {{opacity: 0, y: 30, scale: 0.92}}, {{opacity: 1, y: 0, scale: 1, duration: 0.9, ease: "power3.out"}}, {start + 0.2});',
            f'tl.fromTo("#{el} .kicker", {{opacity: 0, x: -30}}, {{opacity: 1, x: 0, duration: 0.6, ease: "power2.out"}}, {start + 0.7});',
            f'tl.fromTo("#{el} .card-title .w", {{opacity: 0, y: 40}}, {{opacity: 1, y: 0, duration: 0.6, stagger: 0.12, ease: "power3.out"}}, {start + 0.9});',
            f'tl.fromTo("#{el} .card-line", {{opacity: 0}}, {{opacity: 1, duration: 0.8}}, {start + 2.0});',
            f'tl.fromTo("#{el} .chip", {{opacity: 0, y: 16}}, {{opacity: 1, y: 0, duration: 0.5, stagger: 0.15, ease: "power2.out"}}, {start + 2.6});',
        ]
    elif sid == "11-close":
        html_scenes.append(f"""
    <section id="{el}" class="clip scene card" data-start="{start}" data-duration="{duration}">
      <div class="card-bg"></div><div class="card-veil"></div>
      <div class="card-content">
        <img class="card-logo" src="assets/brand/sentinel-logo.webp" alt="SENTINEL AI" />
        <div class="kicker">Detect. Explain. Intervene. Investigate.</div>
        <h1 class="card-title"><span class="w">Rules decide.</span> <span class="w grad">AI explains.</span><br /><span class="w">Humans authorize.</span></h1>
        <div class="stack">
          <span class="chip">Cloud Run</span><span class="chip">Pub/Sub</span><span class="chip">Vertex AI Gemini</span><span class="chip">MongoDB Atlas</span>
        </div>
        <div class="stat"><b class="count" data-to="405">0</b> automated tests passing · <b>0</b> model calls in the decision path</div>
        <p class="fine">Designed as a multi-tenant platform; demonstrated as a single deployment on synthetic data.</p>
      </div>
      {audio}
    </section>""")
        tweens += [
            f'tl.fromTo("#{el} .card-bg", {{scale: 1.02}}, {{scale: 1.16, duration: {duration}, ease: "none"}}, {start});',
            f'tl.fromTo("#{el} .card-logo", {{opacity: 0, scale: 0.9}}, {{opacity: 1, scale: 1, duration: 0.8, ease: "power3.out"}}, {start + 0.2});',
            f'tl.fromTo("#{el} .kicker", {{opacity: 0, x: -30}}, {{opacity: 1, x: 0, duration: 0.9, ease: "power2.out"}}, {start + 0.5});',
            f'tl.fromTo("#{el} .card-title .w", {{opacity: 0, y: 40}}, {{opacity: 1, y: 0, duration: 0.7, stagger: 0.35, ease: "power3.out"}}, {start + 0.9});',
            f'tl.fromTo("#{el} .stack .chip", {{opacity: 0, y: 16}}, {{opacity: 1, y: 0, duration: 0.45, stagger: 0.25, ease: "power2.out"}}, {start + 2.6});',
            f'tl.fromTo("#{el} .stat", {{opacity: 0}}, {{opacity: 1, duration: 0.6}}, {start + 4.2});',
            f'tl.fromTo("#{el} .count", {{textContent: 0}}, {{textContent: 405, duration: 2.2, ease: "power2.out", snap: {{textContent: 1}}}}, {start + 4.2});',
            f'tl.fromTo("#{el} .fine", {{opacity: 0}}, {{opacity: 1, duration: 0.8}}, {start + 6.0});',
        ]
    else:
        number += 1
        beats = VISUALS[sid]
        layers = []
        for i, beat in enumerate(beats):
            lid = f"{el}-b{i}"
            boxes = "".join(
                f'<div class="hl" style="left:{x0 - 6}px;top:{y0 - 6}px;width:{x1 - x0 + 12}px;height:{y1 - y0 + 12}px"></div>'
                for (x0, y0, x1, y1) in beat["boxes"]
            )
            layers.append(f'<div id="{lid}" class="stage"><img src="assets/frames/{beat["frame"]}.png" alt="" />{boxes}</div>')
            b_from = start + duration * beat.get("from", 0.0)
            b_until = start + duration * beat.get("until", 1.0)
            zoom_at = round(b_from + (b_until - b_from) * beat["at"], 2)
            tx, ty = transform_for(beat["focus"], beat["zoom"])
            if i > 0:
                tweens.append(f'tl.fromTo("#{lid}", {{opacity: 0}}, {{opacity: 1, duration: 0.6, ease: "power1.inOut"}}, {round(b_from - 0.3, 2)});')
            else:
                tweens.append(f'tl.set("#{lid}", {{opacity: 1}}, {start});')
            if beat.get("until", 1.0) < 1.0:
                tweens.append(f'tl.to("#{lid}", {{opacity: 0, duration: 0.6}}, {round(b_until - 0.3, 2)});')
            if zoom_at - b_from > 0.2:
                tweens.append(f'tl.fromTo("#{lid}", {{x: 0, y: 0, scale: 1}}, {{x: 0, y: 0, scale: 1.03, duration: {round(zoom_at - b_from, 2)}, ease: "none"}}, {round(b_from, 2)});')
            else:
                tweens.append(f'tl.set("#{lid}", {{x: 0, y: 0, scale: 1}}, {round(b_from - 0.3, 2)});')
            tweens.append(f'tl.to("#{lid}", {{x: {tx}, y: {ty}, scale: {beat["zoom"]}, duration: 1.6, ease: "power2.inOut"}}, {zoom_at});')
            tweens.append(f'tl.to("#{lid}", {{x: {round(tx * 1.02, 1)}, y: {round(ty * 1.02, 1)}, scale: {round(beat["zoom"] * 1.02, 3)}, duration: {round(max(0.5, b_until - zoom_at - 1.6), 2)}, ease: "none"}}, {round(zoom_at + 1.6, 2)});')
            tweens.append(f'tl.fromTo("#{lid} .hl", {{opacity: 0, scale: 1.08}}, {{opacity: 1, scale: 1, duration: 0.5, stagger: 0.6, ease: "back.out(2)"}}, {round(zoom_at + 1.5, 2)});')
        html_scenes.append(f"""
    <section id="{el}" class="clip scene" data-start="{start}" data-duration="{duration}">
      {''.join(layers)}
      <div class="tag">Synthetic data · demo</div>
      <div class="lower">
        <div class="num">{number:02d}<span>/{len(app_scenes):02d}</span></div>
        <div class="text"><div class="lt-title">{scene['title']}</div><div class="lt-line">{scene['caption']}</div></div>
        <div class="bar"><i></i></div>
      </div>
      {audio}
    </section>""")
        tweens += [
            f'tl.fromTo("#{el} .lower", {{opacity: 0, y: 40}}, {{opacity: 1, y: 0, duration: 0.55, ease: "power3.out"}}, {start + 0.35});',
            f'tl.fromTo("#{el} .lt-line", {{opacity: 0, x: -20}}, {{opacity: 1, x: 0, duration: 0.5, ease: "power2.out"}}, {start + 0.7});',
            f'tl.fromTo("#{el} .bar i", {{scaleX: 0}}, {{scaleX: 1, duration: {duration}, ease: "none"}}, {start});',
            f'tl.fromTo("#{el} .tag", {{opacity: 0}}, {{opacity: 1, duration: 0.5}}, {start + 0.5});',
        ]
    t += duration

TOTAL = round(t, 2)
html = f"""<!doctype html>
<html lang="en" data-resolution="landscape">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="assets/vendor/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ width: 1920px; height: 1080px; overflow: hidden; background: #04070d; }}
      #root {{ position: relative; width: 1920px; height: 1080px; overflow: hidden; font-family: "Segoe UI", Inter, system-ui, sans-serif; color: #eef4fb; }}
      .clip {{ position: absolute; inset: 0; }}
      .scene {{ opacity: 0; overflow: hidden; background: #04070d; }}
      audio.clip {{ display: none; }}
      .stage {{ position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; transform-origin: 0 0; opacity: 0; }}
      .stage img {{ position: absolute; inset: 0; width: 1920px; height: 1080px; display: block; }}
      .hl {{ position: absolute; border: 4px solid #38b6ff; border-radius: 14px; box-shadow: 0 0 0 6px rgba(56,182,255,.22), 0 0 36px rgba(56,182,255,.55); opacity: 0; }}
      .tag {{ position: absolute; top: 26px; right: 30px; padding: 9px 18px; border-radius: 999px; background: rgba(6,12,24,.86); color: #bfe9ff; font-size: 17px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; }}
      .lower {{ position: absolute; left: 48px; bottom: 44px; width: 1180px; display: flex; align-items: center; gap: 26px; padding: 22px 30px 26px; border-radius: 20px; background: linear-gradient(90deg, rgba(6,12,24,.94), rgba(10,22,44,.88)); box-shadow: 0 18px 50px rgba(0,0,0,.35); border-left: 6px solid #38b6ff; overflow: hidden; }}
      .num {{ font-size: 56px; font-weight: 800; color: #38b6ff; line-height: 1; min-width: 108px; }}
      .num span {{ font-size: 22px; color: #6f8aa6; font-weight: 600; margin-left: 4px; }}
      .lt-title {{ font-size: 38px; font-weight: 700; letter-spacing: -.01em; }}
      .lt-line {{ font-size: 25px; color: #c9d7e6; margin-top: 4px; }}
      .bar {{ position: absolute; left: 0; right: 0; bottom: 0; height: 5px; background: rgba(255,255,255,.08); }}
      .bar i {{ display: block; height: 100%; background: linear-gradient(90deg, #38b6ff, #7c4ddb); transform-origin: 0 50%; }}
      .card-bg {{ position: absolute; inset: -40px; background: url("assets/brand/singapore-network-map.webp") center / cover no-repeat; opacity: .6; transform-origin: 60% 50%; }}
      .card-veil {{ position: absolute; inset: 0; background: radial-gradient(ellipse at 30% 50%, rgba(4,7,13,.3), rgba(4,7,13,.93) 72%), linear-gradient(90deg, rgba(4,7,13,.95), rgba(4,7,13,.5) 55%, rgba(4,7,13,.2)); }}
      .card-content {{ position: absolute; left: 140px; top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center; max-width: 1240px; }}
      .card-logo {{ width: 520px; margin-bottom: 30px; filter: drop-shadow(0 8px 30px rgba(56,182,255,.35)); }}
      .kicker {{ font-size: 26px; letter-spacing: .32em; text-transform: uppercase; color: #7fd3ff; margin-bottom: 22px; font-weight: 600; }}
      .card-title {{ font-size: 82px; line-height: 1.08; font-weight: 800; letter-spacing: -.01em; margin-bottom: 28px; }}
      .card-title .w {{ display: inline-block; }}
      .grad {{ background: linear-gradient(90deg, #38b6ff, #7c4ddb); -webkit-background-clip: text; background-clip: text; color: transparent; }}
      .card-line {{ font-size: 36px; color: #c8d6e5; margin-bottom: 42px; }}
      .chips, .stack {{ display: flex; gap: 14px; flex-wrap: wrap; }}
      .chip {{ display: inline-block; padding: 10px 22px; border: 1px solid rgba(127,211,255,.5); border-radius: 999px; color: #d6f1ff; font-size: 24px; background: rgba(8,20,40,.5); }}
      .stat {{ margin-top: 34px; font-size: 32px; color: #c8d6e5; }}
      .stat b {{ color: #fff; font-size: 40px; }}
      .fine {{ margin-top: 26px; font-size: 22px; color: #8aa0b6; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{TOTAL}" data-width="1920" data-height="1080">
{''.join(html_scenes)}
    </div>
    <script>
      window.__timelines = window.__timelines || {{}};
      const tl = gsap.timeline({{ paused: true }});
      {chr(10).join('      ' + line for line in tweens).strip()}
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
"""
(PROJECT / "index.html").write_text(html, encoding="utf-8")
print(f"scenes: {len(SCENES)}  total: {TOTAL}s  tweens: {len(tweens)}")
