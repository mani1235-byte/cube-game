
window.player = window.player || {xp:0, level:1, trophies:0, rewards:[]};

// Guarded against double-inclusion (was a bare `const`, which throws a fatal
// "already declared" SyntaxError — and kills this whole script's parse —
// if trophies.js ever ends up on the page twice).
window.trophyMilestones = window.trophyMilestones || [
  { amount: 100, reward: "trophy_red" },
  { amount: 300, reward: "trophy_blue" },
  { amount: 600, reward: "trophy_fire" },
  { amount: 1000, reward: "trophy_legend" }
];

function addTrophies(amount){
  player.trophies += amount;
  checkTrophyRewards();
}

function checkTrophyRewards(){
  window.trophyMilestones.forEach(m=>{
    if(player.trophies >= m.amount && !player.rewards.includes(m.reward)){
      unlockReward(m.reward);
    }
  });
}
