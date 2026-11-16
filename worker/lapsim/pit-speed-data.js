// Pit lane speed limits (km/h). Series rule first; an event value from the Race Director's notes overrides it for that track.
// Edit by hand with a source for every value. Known evidence (layer 1): official regulations and event documents.
export const lapsimPitSpeed = {
  series: {
    f1: {kph: 80, src: 'FIA F1 Sporting Regulations B1.6.3 a)', note: 'the Race Director may set another limit for an event'},
    wec: {kph: 60, src: 'FIA WEC Sporting Regulations art. 12.1.4'},
    imsa: {kph: 60, src: 'IMSA driver briefings 2025–26'},
  },
  tracks: {}, // {trackId: {f1: {kph, src}}} from the event's Race Director notes; none recorded yet
};
