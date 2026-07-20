"use client";

// Print-optimized playbook document (15g). Self-contained styles (scoped
// <style>) so the print output is a clean formatted handout, independent of
// the app theme. Auto-opens the print dialog once.
import { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { normalizeMd } from "./PlaybookApp";

const CALLOUT = {
  CONTENT_IDEA: "💡 Content Idea",
  REEL_IDEA: "🎥 Reel Idea",
  SHOOT_HERE: "📍 Shoot Here",
  WHY_IT_WORKS: "📈 Why it Works",
  DONT_DO_THIS: "⚠️ Don't Do This",
  PRO_TIP: "⭐ Pro Tip",
  NOTE: "🗂 Note",
};
const strip = (s) => String(s || "").replace(/\*\*/g, "");
const body = (t) => { const s = strip(t); const i = s.indexOf(":"); return i > 0 && i < 30 ? s.slice(i + 1).trim() : s; };

export default function PlaybookExport({ pillars, total }) {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="pbExportDoc">
      <style>{`
        .pbExportDoc { max-width: 800px; margin: 0 auto; padding: 40px 32px; color: #2b2620; font-family: Georgia, 'Times New Roman', serif; background: #fff; }
        .pbExportDoc h1 { font-size: 30px; margin: 0 0 4px; }
        .pbExportDoc .lede { color: #6e6357; font-size: 14px; margin-bottom: 4px; font-family: -apple-system, 'Segoe UI', sans-serif; }
        .pbExportDoc .rule { border: none; border-top: 2px solid #b25e3f; margin: 16px 0 28px; }
        .pbExportDoc h2 { font-size: 22px; margin: 30px 0 6px; color: #b25e3f; page-break-after: avoid; }
        .pbExportDoc h3 { font-size: 17px; margin: 18px 0 4px; page-break-after: avoid; }
        .pbExportDoc .quote { font-style: italic; color: #6e6357; margin: 2px 0 10px; }
        .pbExportDoc .desc { font-family: -apple-system, 'Segoe UI', sans-serif; font-size: 13px; line-height: 1.5; margin: 4px 0 8px; }
        .pbExportDoc .callout { font-family: -apple-system, 'Segoe UI', sans-serif; font-size: 13px; line-height: 1.5; margin: 5px 0; padding: 8px 12px; border-left: 3px solid #d8ccb6; background: #faf6ee; page-break-inside: avoid; }
        .pbExportDoc .callout b { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #8a7d6c; margin-bottom: 2px; }
        .pbExportDoc .desc p { margin: 4px 0; }
        .pbExportDoc .desc ol, .pbExportDoc .desc ul { margin: 4px 0 4px 18px; }
        .pbExportDoc .desc li { margin: 2px 0; }
        .pbExportDoc .desc table { border-collapse: collapse; width: 100%; margin: 6px 0; font-size: 12px; page-break-inside: avoid; }
        .pbExportDoc .desc th, .pbExportDoc .desc td { border: 1px solid #d8ccb6; padding: 5px 8px; text-align: left; vertical-align: top; }
        .pbExportDoc .desc th { background: #f3ece0; }
        .pbExportDoc .section { page-break-inside: avoid; }
        .pbExportDoc .printbar { position: fixed; top: 12px; right: 12px; }
        .pbExportDoc .printbar button { font-family: -apple-system, sans-serif; background: #b25e3f; color: #fff; border: none; border-radius: 8px; padding: 8px 14px; font-weight: 700; cursor: pointer; }
        @media print { .printbar { display: none !important; } .pbExportDoc { padding: 0; } }
      `}</style>

      <div className="printbar"><button onClick={() => window.print()}>⭳ Save as PDF</button></div>

      <h1>Julie&apos;s Content Playbook</h1>
      <p className="lede">Fairmount &amp; Brewerytown · {total} content ideas across {pillars.length} pillars</p>
      <p className="lede">Plan smarter. Create with purpose. Connect deeper.</p>
      <hr className="rule" />

      {pillars.map((p) => (
        <div key={p.id}>
          <h2>{p.emoji} {p.name}</h2>
          {p.sections.map((s) => (
            <div key={s.id} className="section">
              <h3>{s.title}</h3>
              {s.subtitle && <p className="quote">&ldquo;{strip(s.subtitle)}&rdquo;</p>}
              {s.blocks.map((b) => (
                <div key={b.id}>
                  <h3 style={{ fontSize: 15 }}>{b.emoji} {strip(b.heading)}</h3>
                  {b.body && (
                    <div className="desc">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{normalizeMd(b.body)}</ReactMarkdown>
                    </div>
                  )}
                  {b.callouts.map((c) => (
                    <div key={c.id} className="callout">
                      <b>{CALLOUT[c.type] || "Note"}</b>
                      {body(c.text)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
