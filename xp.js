
window.player = window.player || {xp:0, level:1, trophies:0, rewards:[]};

const xpLevels = [
  { level: 1, xpRequired: 0 },
  { level: 2, xpRequired: 100 },
  { level: 3, xpRequired: 250 },
  { level: 4, xpRequired: 500 },
  { level: 5, xpRequired: 900 }
];

function addXP(amount){
  player.xp += amount;
  checkLevelUp();
}

function checkLevelUp(){
  xpLevels.forEach(lvl=>{
    if(player.xp >= lvl.xpRequired && player.level < lvl.level){
      player.level = lvl.level;
      giveXPReward(lvl.level);
    }
  });
}

function giveXPReward(level){
  const rewards = {
    2: "xp_green",
    3: "xp_light",
    4: "xp_speed",
    5: "xp_god"
  };

  const reward = rewards[level];
  if(reward && !player.rewards.includes(reward)){
    unlockReward(reward);
  }
}
