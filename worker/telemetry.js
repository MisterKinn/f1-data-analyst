// Distance alignment for two laps of telemetry (used by openf1_lap_telemetry).
export function distanceDelta(laps){
 if(laps.length!==2||laps.some(l=>!l.complete_coverage||!Array.isArray(l.samples)||l.samples.length<3))return null;
 const [a,b]=laps.map(l=>l.samples),max=Math.min(a.at(-1)[1],b.at(-1)[1]);
 const timeAt=(rows,d)=>{let i=rows.findIndex(r=>r[1]>=d);if(i<1)return null;const x=rows[i-1],y=rows[i];if(y[1]<=x[1]||y[0]-x[0]>1.5)return null;return x[0]+(y[0]-x[0])*(d-x[1])/(y[1]-x[1]);};
 const points=[];for(let d=25;d<=max;d+=25){const t=timeAt(a,d),u=timeAt(b,d);points.push([d,t===null||u===null?null:Number((u-t).toFixed(3))]);}
 return {reference_driver:laps[0].driver_number,comparison_driver:laps[1].driver_number,columns:['distance_m','comparison_minus_reference_s'],positive_means:'comparison driver slower',method:'Linear time interpolation within common observed speed-integrated distance only. Approximate; boundary residuals and different paths can shift the curve.',points};
}
