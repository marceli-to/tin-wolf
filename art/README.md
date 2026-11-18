# Tinfox assets

| Folder / file | What |
|---|---|
| `MISSING.md` | **Start here:** what is still missing, in order, and who does it (Marcel: sheets; generator: GLBs) |
| `GENERATOR.md` | What the game-pack-generator needs to turn the sheets into Tinfox characters (read first) |
| `characters/sheets/` | The approved character sheets (01 guard … 09 practice dummy) |
| `characters/prompts/` | The ChatGPT prompts that made them, same numbers |
| `weapons/prompts/` | Prompts for the weapon sheets; how to use them in `weapons/README.txt` |
| `weapons/sheets/` | Approved weapon sheets go here |
| `props/prompts/` | Prompts for the prop sheets: 01–04 first props, 05–08 generic cover, 09–20 Halvard Depot interior kit, 21–31 pickups, power-ups, chest and dish, 32 alarm panel, 33–39 Snowfort kit; how to use them in `props/README.txt` |
| `COVER-AND-DEPOT.md` | Handoff for the generator: the cover and depot props as GLBs (sizes, axes, budgets) |
| `PICKUPS-AND-POWERUPS.md` | Handoff for the generator: pickups, power-ups, chest and satellite dish as GLBs |
| `PRACTICE-DUMMY.md` | Brief for the generator: the practice dummy (09) as a rigged figure |
| `SNOWFORT.md` | Handoff for the generator: the Snowfort kit (33–39) as GLBs |
| `props/sheets/` | Approved prop sheets go here |
| `_archive/` | Rejected versions, kept for reference |

## Making a character sheet
`characters/prompts/01-guard.txt` was generated without a reference. For 02–08: start a new
ChatGPT message, attach `characters/sheets/01-guard.png`, paste the whole prompt file.
