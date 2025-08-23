import React from "react";

export default function TimelinePanel() {
  return (
    <section className="panel timeline" aria-label="Session timeline">
      <h2>Timeline</h2>
      <div className="panel-body t-scroll">
        {Array.from({ length: 40 }).map((_, i) => (
          <article className="t-item" key={i}>
            <time>19:{String(i).padStart(2,'0')}</time>
            <div><span className="chip">Event</span> Sample event {i+1}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
