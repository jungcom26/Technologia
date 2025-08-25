import React from "react";

export default function CharacterDock() {
  const names = ["Divyansh","Mukul","Adil","Com", "Akshat"];
  return (
    <footer className="dock" aria-label="Character dock">
      <div className="dock-row">
        {names.map((name,i)=>(
          <div className="c-card" key={i} tabIndex={0}>
            <div className="c-head">
              <div className="token">{name[0]}</div>
              <div className="head-line">
                <strong>{name}</strong>
                <span className="pill">AC 16</span>
                <span className="pill">HP 25</span>
                <span className="pill">Temp 5</span>
              </div>
            </div>
            <div className="c-details">
              <div className="grid">
                <div><span className="dt">Race</span><span className="dd">Elf</span></div>
                <div><span className="dt">Class</span><span className="dd">Ranger</span></div>
                <div><span className="dt">STR</span><span className="dd">14</span></div>
                <div><span className="dt">DEX</span><span className="dd">18</span></div>
                <div><span className="dt">CON</span><span className="dd">12</span></div>
                <div><span className="dt">INT</span><span className="dd">10</span></div>
                <div><span className="dt">WIS</span><span className="dd">12</span></div>
                <div><span className="dt">CHA</span><span className="dd">10</span></div>
              </div>
              <p className="desc">A pact-bound seeker whose whispers pull at unseen threads.</p>
            </div>
          </div>
        ))}
      </div>
    </footer>
  );
}
