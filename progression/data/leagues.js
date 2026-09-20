// data/leagues.js
// Trophy-based league ladder (Bronze I -> Masters). Purely a presentation
// layer over the existing trophy count — no new currency, just thresholds.
window.LEAGUES = [
  { name: "Bronze I",    min: 0,    color: "#cd7f32", bg: "#1a1200" },
  { name: "Bronze II",   min: 25,   color: "#cd7f32", bg: "#1a1200" },
  { name: "Bronze III",  min: 50,   color: "#cd7f32", bg: "#1a1200" },
  { name: "Silver I",    min: 100,  color: "#c8d3dc", bg: "#15171c" },
  { name: "Silver II",   min: 150,  color: "#c8d3dc", bg: "#15171c" },
  { name: "Silver III",  min: 250,  color: "#c8d3dc", bg: "#15171c" },
  { name: "Gold I",      min: 400,  color: "#ffd700", bg: "#1a1500" },
  { name: "Gold II",     min: 600,  color: "#ffd700", bg: "#1a1500" },
  { name: "Gold III",    min: 800,  color: "#ffd700", bg: "#1a1500" },
  { name: "Diamond I",   min: 1000, color: "#9fe8ff", bg: "#071a1f" },
  { name: "Diamond II",  min: 1500, color: "#9fe8ff", bg: "#071a1f" },
  { name: "Diamond III", min: 2000, color: "#9fe8ff", bg: "#071a1f" },
  { name: "Masters",     min: 3000, color: "#ff4d8d", bg: "#1f0712" }
];
