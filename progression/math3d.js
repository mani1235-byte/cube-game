// Raw math helpers
window.Math3D={lerp:(a,b,t)=>a+(b-a)*t,float:(time,h=0.15,s=2)=>Math.sin(time*s)*h,spiral:(t,r)=>({x:Math.cos(t)*r,z:Math.sin(t)*r})};