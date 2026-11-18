# Alarm panel (32): `alarm_panel` / `start_panel`

New `props/glb/alarm-panel.glb` (39.8 KB, sha256 `143f7377…07f5b83e`), built from `props/sheets/32-alarm-panel.png`.
Previews: `props/glb/alarm-panel-preview.png` (three.js), `props/glb/alarm-panel-vs-sheet.png` (top: sheet; middle:
model front / side / top; bottom: silhouette overlap). Paths are relative to `art/` in the Tin Fox repo.

| | |
|---|---|
| Size (GLB bounding box) | 0.500 × 0.700 × 0.160 m (X × Y × Z), exact |
| Origin | bottom centre of the box: x 0, y 0, z from −0.080 (back) to +0.080 (front) |
| Front | +Z (button and lamp); the back is flat, at z −0.08: put the origin 0.08 m off the wall |
| Triangles | 392 (limit 400) |
| Materials | `M_Palette` (box, collar, bolts, lamp base, stripes), `M_Button`, `M_Lamp`; same palette texture, NEAREST, vertex AO in `COLOR_0` |
| Nodes | `alarm-panel` (the box), `button`, `lamp`, all at the scene root, identity transforms |

- **`button`**: only the red mushroom button (8 sides, 3 cm proud of its dark grey collar), all faces on `M_Button`.
  Tint it green for `start_panel`.
- **`lamp`**: the red beacon on top, all faces on `M_Lamp`. Flash it for the alarm.
- Both nodes keep their origin at the prop origin (not at their own centre), so a tint or flash needs no transform.
  If you want to press the button in, move `button` along −Z by 1–2 cm (it sits in the collar from z 0.050 to 0.080).

Deviations from the sheet:
- **No clear dome over the lamp.** An opaque light-grey dome would hide the red lamp the game flashes, and the
  brief allows no third material. The beacon fills the dome's size instead (up to the 0.70 m top). If you want the
  glass dome back, I can add it as its own material (`M_Dome`, made translucent by the game like `M_Bubble`).
- The sheet draws the box 2.4× deeper and 1.2× taller than 0.50 × 0.70 × 0.16; the box wins (hence the low side/top
  overlap in the vs-sheet image). The lamp is elliptical (17 cm across, 10 cm deep) to fit the 16 cm depth.
- Hazard stripes on the front only (not round the sides), to stay under 400 triangles.

Checked here: Khronos glTF validator 0 errors / 0 warnings, three.js loads it, bounding box read from the GLB.

Please check: the panel on a depot wall at a few metres (reads as an alarm button?), the lamp flashing, and the
green button on the training `start_panel`.
