import React from "react";

function Stat({label, value}) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function StatsPanel() {
  return (
    <section className="panel stats" aria-label="Quick stats">
      <h2>Quick Stats</h2>
      <div className="panel-body qs">
        <Stat label="Open Threads" value="3" />
        <Stat label="Last Major Event" value="Duke’s Betrayal" />
        <Stat label="Current Location" value="Greywatch" />
        <Stat label="Weather" value="Fog" />
        <Stat label="Time" value="Nightfall" />
      </div>
    </section>
  );
}
